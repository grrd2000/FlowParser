from __future__ import annotations

from datetime import datetime
from typing import List, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.engine import (
    Algorithm,
    RecurringPaymentEngine,
)
from app.recurring import detect_recurring_payments
from app.tfidf import preprocess_texts, suggest_rule_token

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


class TrainSampleRequest(BaseModel):
    algorithm: Algorithm = Field("lightgbm", description="Model family to use for sample training")


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


class ModelStatusResponse(BaseModel):
    algorithm: Algorithm
    trained: bool


class RecurringScoreOut(BaseModel):
    transaction_id: str | int
    score: float


class RecurringGroupOut(BaseModel):
    id: str
    name: str
    cadence: Literal["miesięczne", "tygodniowe"]
    next_date: datetime
    average_amount: float
    transaction_ids: List[str | int]
    confidence: float


class RecurringDetectionResponse(BaseModel):
    algorithm: str
    scores: List[RecurringScoreOut]
    groups: List[RecurringGroupOut]


class RecurringDetectionRequest(BaseModel):
    transactions: List[Transaction]

    class Config:
        json_schema_extra = {
            "example": {
                "transactions": [
                    {
                        "transaction_id": 1,
                        "date": "2024-01-05",
                        "amount": -19.99,
                        "description": "Netflix subscription",
                    }
                ]
            }
        }
class PreprocessTextsRequest(BaseModel):
    texts: List[str] = Field(default_factory=list, description="Teksty do normalizacji/tokenizacji")


class PreprocessTextFeatures(BaseModel):
    normalized: str
    tokens: List[str]


class PreprocessTextsResponse(BaseModel):
    items: List[PreprocessTextFeatures]


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/model-status", response_model=ModelStatusResponse)
def model_status(algorithm: Algorithm = "lightgbm"):
    return ModelStatusResponse(algorithm=algorithm, trained=True)


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


@app.post("/recurring/detect", response_model=RecurringDetectionResponse)
def detect_recurring(req: RecurringDetectionRequest):
    result = detect_recurring_payments([tx.model_dump() for tx in req.transactions])

    return RecurringDetectionResponse(
        algorithm=result.algorithm,
        scores=[RecurringScoreOut(**score.__dict__) for score in result.scores],
        groups=[
            RecurringGroupOut(
                id=group.id,
                name=group.name,
                cadence=group.cadence,
                next_date=group.next_date,
                average_amount=group.average_amount,
                transaction_ids=group.transaction_ids,
                confidence=group.confidence,
            )
            for group in result.groups
        ],
    )


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


@app.post("/text/preprocess", response_model=PreprocessTextsResponse)
def preprocess(req: PreprocessTextsRequest):
    feats = preprocess_texts(req.texts)
    return PreprocessTextsResponse(items=[PreprocessTextFeatures(**f) for f in feats])
