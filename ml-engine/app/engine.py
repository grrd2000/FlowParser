from __future__ import annotations

from dataclasses import dataclass
from typing import List, Literal

import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

try:  # Optional heavy dependencies – gracefully degraded if unavailable
    from lightgbm import LGBMClassifier  # type: ignore
except ImportError:  # pragma: no cover - fallback used in offline envs
    LGBMClassifier = None

try:
    from xgboost import XGBClassifier  # type: ignore
except ImportError:  # pragma: no cover
    XGBClassifier = None

try:
    from catboost import CatBoostClassifier  # type: ignore
except ImportError:  # pragma: no cover
    CatBoostClassifier = None

Algorithm = Literal["lightgbm", "xgboost", "catboost", "torch_mlp"]


class TorchMLPClassifier:
    """
    Lightweight feed-forward network implemented directly in PyTorch.

    This implementation keeps the training loop explicit to allow easy
    customization while remaining dependency-light.
    """

    def __init__(
        self,
        input_dim: int,
        hidden_dim: int = 64,
        lr: float = 1e-3,
        weight_decay: float = 1e-4,
        epochs: int = 75,
        batch_size: int = 64,
    ) -> None:
        self.model = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.BatchNorm1d(hidden_dim),
            nn.Dropout(p=0.1),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, 1),
        )
        self.lr = lr
        self.weight_decay = weight_decay
        self.epochs = epochs
        self.batch_size = batch_size
        self._fitted = False

    def fit(self, X: pd.DataFrame, y: pd.Series):
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        X_tensor = torch.tensor(np.asarray(X, dtype=np.float32))
        y_tensor = torch.tensor(np.asarray(y, dtype=np.float32)).unsqueeze(-1)

        dataset = TensorDataset(X_tensor, y_tensor)
        loader = DataLoader(dataset, batch_size=self.batch_size, shuffle=True)

        self.model.to(device)
        criterion = nn.BCEWithLogitsLoss()
        optimizer = torch.optim.Adam(
            self.model.parameters(), lr=self.lr, weight_decay=self.weight_decay
        )

        self.model.train()
        for _ in range(self.epochs):
            for batch_X, batch_y in loader:
                batch_X, batch_y = batch_X.to(device), batch_y.to(device)
                optimizer.zero_grad()
                logits = self.model(batch_X)
                loss = criterion(logits, batch_y)
                loss.backward()
                optimizer.step()

        self.model.eval()
        self._fitted = True
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        if not self._fitted:
            raise RuntimeError("Model not fitted")

        device = next(self.model.parameters()).device
        X_tensor = torch.tensor(np.asarray(X, dtype=np.float32)).to(device)
        with torch.no_grad():
            logits = self.model(X_tensor).cpu().numpy().reshape(-1)
        probs = 1 / (1 + np.exp(-logits))
        return np.vstack([1 - probs, probs]).T

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return (self.predict_proba(X)[:, 1] >= 0.5).astype(int)


class SimpleBoostingFallback:
    """Lightweight fallback model used when dedicated libraries are unavailable."""

    def __init__(self) -> None:
        self._coeffs: np.ndarray | None = None

    def fit(self, X: pd.DataFrame, y: pd.Series):
        design = np.hstack([np.ones((len(X), 1)), np.asarray(X, dtype=float)])
        self._coeffs, *_ = np.linalg.lstsq(design, np.asarray(y, dtype=float), rcond=None)
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        if self._coeffs is None:
            raise RuntimeError("Model not fitted")
        design = np.hstack([np.ones((len(X), 1)), np.asarray(X, dtype=float)])
        logits = design @ self._coeffs
        probs = 1 / (1 + np.exp(-logits))
        return np.vstack([1 - probs, probs]).T

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return (self.predict_proba(X)[:, 1] >= 0.5).astype(int)


def _simple_train_test_split(
    features: pd.DataFrame, labels: pd.Series, test_size: float = 0.25, random_state: int = 42
):
    rng = np.random.default_rng(seed=random_state)
    indices = np.arange(len(features))
    rng.shuffle(indices)
    split = int(len(indices) * (1 - test_size))
    train_idx, test_idx = indices[:split], indices[split:]
    return (
        features.iloc[train_idx].reset_index(drop=True),
        features.iloc[test_idx].reset_index(drop=True),
        labels.iloc[train_idx].reset_index(drop=True),
        labels.iloc[test_idx].reset_index(drop=True),
    )


def _classification_report(y_true: pd.Series, y_pred: np.ndarray) -> dict:
    y_true = np.asarray(y_true, dtype=int)
    y_pred = np.asarray(y_pred, dtype=int)

    def metrics_for(label: int) -> dict:
        tp = int(np.sum((y_true == label) & (y_pred == label)))
        fp = int(np.sum((y_true != label) & (y_pred == label)))
        fn = int(np.sum((y_true == label) & (y_pred != label)))
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
        support = int(np.sum(y_true == label))
        return {"precision": precision, "recall": recall, "f1-score": f1, "support": support}

    metrics_zero = metrics_for(0)
    metrics_one = metrics_for(1)
    macro_avg = {
        "precision": (metrics_zero["precision"] + metrics_one["precision"]) / 2,
        "recall": (metrics_zero["recall"] + metrics_one["recall"]) / 2,
        "f1-score": (metrics_zero["f1-score"] + metrics_one["f1-score"]) / 2,
        "support": metrics_zero["support"] + metrics_one["support"],
    }
    accuracy = float(np.mean(y_true == y_pred))

    return {
        "0": metrics_zero,
        "1": metrics_one,
        "macro avg": macro_avg,
        "accuracy": accuracy,
    }


@dataclass
class TrainingResult:
    algorithm: Algorithm
    metrics: dict
    model: object


class RecurringPaymentEngine:
    """Simple helper that turns raw transactions into ML-friendly features and fits a model."""

    def __init__(self) -> None:
        self._models: dict[Algorithm, object] = {}

    def has_model(self, algorithm: Algorithm) -> bool:
        return algorithm in self._models

    @staticmethod
    def _build_features(df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["date"] = pd.to_datetime(df["date"])
        df["day"] = df["date"].dt.day
        df["weekday"] = df["date"].dt.weekday
        df["amount_abs"] = df["amount"].abs()
        df["amount_mag"] = np.log1p(df["amount_abs"])
        normalized_desc = df["description"].fillna("").str.lower()
        keyword_patterns = [
            "subscription",
            "abonament",
            "subskrypc",
            "plan",
            "membership",
            "rent",
            "gym",
            "spotify",
            "netflix",
        ]
        df["has_keyword"] = normalized_desc.apply(
            lambda text: int(any(token in text for token in keyword_patterns))
        )
        df["desc_len"] = normalized_desc.str.len()
        return df[["day", "weekday", "amount_abs", "amount_mag", "has_keyword", "desc_len"]]


    @staticmethod
    def _create_model(algorithm: Algorithm, n_features: int):
        if algorithm == "lightgbm":
            if LGBMClassifier:
                return LGBMClassifier(
                        n_estimators=200,
                        learning_rate=0.05,
                        max_depth=-1,
                        num_leaves=31,
                        subsample=0.9,
                        colsample_bytree=0.9,
                        random_state=42,
                    )
            return SimpleBoostingFallback()
        if algorithm == "xgboost":
            if XGBClassifier:
                return XGBClassifier(
                    n_estimators=300,
                    max_depth=4,
                    learning_rate=0.05,
                    subsample=0.9,
                    colsample_bytree=0.9,
                    eval_metric="logloss",
                    random_state=42,
                    use_label_encoder=False,
                )
            return SimpleBoostingFallback()
        if algorithm == "catboost":
            if CatBoostClassifier:
                return CatBoostClassifier(
                    depth=6,
                    learning_rate=0.05,
                    iterations=300,
                    loss_function="Logloss",
                    verbose=False,
                    random_seed=42,
                )
            return SimpleBoostingFallback()
        if algorithm == "torch_mlp":
            return TorchMLPClassifier(input_dim=n_features)
        raise ValueError(f"Unsupported algorithm: {algorithm}")

    def train(self, data: pd.DataFrame, algorithm: Algorithm = "lightgbm") -> TrainingResult:
        if "label" not in data.columns:
            raise ValueError("Input data must contain a 'label' column for training")

        features = self._build_features(data)
        labels = data["label"].astype(int)

        X_train, X_test, y_train, y_test = _simple_train_test_split(
            features, labels, test_size=0.25, random_state=42
        )

        model = self._create_model(algorithm, n_features=features.shape[1])
        model.fit(X_train, y_train)

        y_pred = model.predict(X_test)
        report = _classification_report(y_test, y_pred)

        self._models[algorithm] = model

        return TrainingResult(algorithm=algorithm, metrics=report, model=model)

    def predict(self, data: pd.DataFrame, algorithm: Algorithm = "lightgbm") -> np.ndarray:
        if algorithm not in self._models:
            raise ValueError(
                f"Model for algorithm '{algorithm}' not trained yet. Call train() first."
            )
        model = self._models[algorithm]
        features = self._build_features(data)
        return model.predict_proba(features)[:, 1]

    @staticmethod
    def build_dataframe(transactions: List[dict], include_label: bool) -> pd.DataFrame:
        normalized = []
        for tx in transactions:
            normalized.append(
                {
                    "transaction_id": tx.get("transaction_id", tx.get("id")),
                    "date": tx["date"],
                    "amount": float(tx["amount"]),
                    "description": tx.get("description", ""),
                    **({"label": int(tx["label"])} if include_label and "label" in tx else {}),
                }
            )
        return pd.DataFrame(normalized)
