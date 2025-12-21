from __future__ import annotations

from typing import List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.engine import (
    Algorithm,
    RecurringPaymentEngine,
    # build_dataframe,
    # load_sample_dataset,
)

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
    # xd = r'data/sample_transactions.csv'
    df = engine.load_sample_dataset()
    print (df.head())
    result = engine.train(df, algorithm=algorithm)
    return {"algorithm": algorithm, "metrics": result.metrics}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    df = engine.build_dataframe([tx.model_dump() for tx in req.transactions], include_label=False)
    try:
        scores = engine.predict(df, algorithm=req.algorithm)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"algorithm": req.algorithm, "predictions": list(scores)}
