from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Sequence

from sqlalchemy.orm import Session, joinedload

from app.models import (
    RecurringDetection,
    RecurringGroup,
    RecurringGroupTransaction,
    RecurringScoreEntry,
)
from app.schemas import RecurringDetectionResponse, RecurringGroupOut, RecurringScore


RecurringGroupPayload = RecurringGroupOut


def _ensure_tz(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def get_latest_detection(db: Session, user_id: int) -> RecurringDetection | None:
    return (
        db.query(RecurringDetection)
        .options(
            joinedload(RecurringDetection.scores),
            joinedload(RecurringDetection.groups).joinedload(RecurringGroup.transactions),
        )
        .filter(RecurringDetection.user_id == user_id)
        .order_by(RecurringDetection.run_at.desc())
        .first()
    )


def save_detection(
    db: Session,
    *,
    user_id: int,
    algorithm: str,
    scores: Sequence[RecurringScore],
    groups: Sequence[RecurringGroupPayload],
    status: str = "completed",
) -> RecurringDetection:
    detection = RecurringDetection(
        user_id=user_id,
        algorithm=algorithm,
        status=status,
        run_at=datetime.now(timezone.utc),
    )
    db.add(detection)
    db.flush()

    for score in scores:
        detection.scores.append(
            RecurringScoreEntry(
                transaction_id=score.transaction_id,
                score=float(score.score),
            )
        )

    for group in groups:
        tx_ids = list(group.transaction_ids or [])
        if not tx_ids:
            continue

        avg_amount = Decimal(str(group.average_amount or 0))
        group_obj = RecurringGroup(
            detection_id=detection.id,
            name=group.name or "Powtarzalna transakcja",
            cadence=group.cadence,
            external_id=group.id,
            next_date=_ensure_tz(group.next_date),
            average_amount=avg_amount,
            confidence=group.confidence,
        )
        db.add(group_obj)
        db.flush()

        for tx_id in tx_ids:
            group_obj.transactions.append(
                RecurringGroupTransaction(transaction_id=tx_id)
            )

    db.commit()
    db.refresh(detection)

    return detection


def detection_to_response(
    detection: RecurringDetection,
    *,
    status: str | None = None,
) -> RecurringDetectionResponse:
    groups_out: list[RecurringGroupOut] = []
    for group in detection.groups:
        tx_ids = [rel.transaction_id for rel in group.transactions]
        groups_out.append(
            RecurringGroupOut(
                id=group.external_id or str(group.id),
                name=group.name,
                cadence=group.cadence,
                next_date=_ensure_tz(group.next_date),
                average_amount=float(group.average_amount or 0),
                transaction_ids=tx_ids,
                confidence=group.confidence,
            )
        )

    scores_out = [
        RecurringScore(transaction_id=score.transaction_id, score=float(score.score))
        for score in detection.scores
    ]

    return RecurringDetectionResponse(
        algorithm=detection.algorithm,
        scores=scores_out,
        groups=groups_out,
        run_at=_ensure_tz(detection.run_at),
        status=status or detection.status,
    )
