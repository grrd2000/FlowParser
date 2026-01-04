from __future__ import annotations

from typing import List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.engine import (
    Algorithm,
    RecurringPaymentEngine,
)
from app.tfidf import suggest_rule_token

app = FastAPI(title="FlowParser ML Engine", version="0.1.0")
engine = RecurringPaymentEngine()


class Transaction(BaseModel):
    transaction_id: str | int = Field(..., description="Unique transaction identifier")
    date: str = Field(..., description="Transaction date in ISO format")
    amount: float = Field(..., description="Signed amount")
    description: str = Field("", description="Free-text description")


class LabeledTransaction(Transaction):
    label: int = Field(..., description="1 for recurring payment, 0 otherwise")


class TrainRequest(BaseModel):
    algorithm: Algorithm = Field("lightgbm", description="Model family to use")
    transactions: List[LabeledTransaction]


class TrainResponse(BaseModel):
    algorithm: Algorithm
    metrics: dict


class PredictRequest(BaseModel):
    algorithm: Algorithm = Field("lightgbm", description="Model family to use for inference")
    transactions: List[Transaction]


class PredictResponse(BaseModel):
    algorithm: Algorithm
    predictions: List[float]


class TokenSuggestionRequest(BaseModel):
    description: str = Field(..., description="Opis transakcji do zasugerowania tokenu reguły")
    all_descriptions: List[str] = Field(
        default_factory=list, description="Zbiór opisów do policzenia DF/IDF"
    )
    uncategorized_descriptions: List[str] = Field(
        default_factory=list, description="Opisy transakcji bez kategorii"
    )
    min_similar_for_suggestion: int = Field(
        10, description="Minimalna liczba podobnych transakcji do wygenerowania sugestii"
    )
    max_token_ratio: float = Field(
        0.35, description="Maksymalny udział tokenu w korpusie, powyżej którego odrzucamy"
    )


class TokenSuggestionResponse(BaseModel):
    token: str | None
    similar_count: int


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/train", response_model=TrainResponse)
def train(req: TrainRequest):
    df = engine.build_dataframe([tx.model_dump() for tx in req.transactions], include_label=True)
    try:
        result = engine.train(df, algorithm=req.algorithm)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"algorithm": req.algorithm, "metrics": result.metrics}


@app.post("/train-sample", response_model=TrainResponse)
def train_sample(algorithm: Algorithm = "lightgbm"):
    raise HTTPException(status_code=410, detail="Sample training dataset is no longer available.")


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    df = engine.build_dataframe([tx.model_dump() for tx in req.transactions], include_label=False)
    try:
        scores = engine.predict(df, algorithm=req.algorithm)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"algorithm": req.algorithm, "predictions": list(scores)}


@app.post("/tfidf/rule-suggestion", response_model=TokenSuggestionResponse)
def suggest_token(req: TokenSuggestionRequest):
    result = suggest_rule_token(
        description=req.description,
        all_descriptions=req.all_descriptions,
        uncategorized_descriptions=req.uncategorized_descriptions,
        min_similar_for_suggestion=req.min_similar_for_suggestion,
        max_token_ratio=req.max_token_ratio,
    )
    if not result:
        return TokenSuggestionResponse(token=None, similar_count=0)

    return TokenSuggestionResponse(token=result["token"], similar_count=result["similar_count"])
