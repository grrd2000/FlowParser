from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Iterable, Literal


RECURRING_STOPWORDS = {
    "platnosc",
    "płatność",
    "oplata",
    "opłata",
    "przelew",
    "rachunek",
    "faktura",
    "faktury",
    "invoice",
    "za",
    "do",
    "nr",
    "numer",
    "id",
}


def _strip_diacritics(text: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFD", text) if unicodedata.category(ch) != "Mn")


def normalize_description(description: str | None) -> str | None:
    if not description:
        return None

    lowered = _strip_diacritics(description).lower()
    scrubbed = re.sub(r"\b(?:nr|numer|id|ref|fv|invoice)\s*[\w/-]*", " ", lowered)
    scrubbed = re.sub(r"\d{2,}", " ", scrubbed)
    scrubbed = re.sub(r"[.,;:]", " ", scrubbed)

    tokens = [
        tok.strip()
        for tok in re.split(r"[^a-z]+", scrubbed)
        if tok.strip()
    ]
    tokens = [t for t in tokens if len(t) >= 3 and t not in RECURRING_STOPWORDS]
    if not tokens:
        return None

    unique = sorted(set(tokens))
    return " ".join(unique)


def is_amount_stable(values: Iterable[float]) -> bool:
    values = list(values)
    if not values:
        return False

    abs_values = [abs(v) for v in values]
    avg = sum(abs_values) / len(abs_values)
    spread = max(abs_values) - min(abs_values)
    tolerance = max(2.0, avg * 0.08)
    return spread <= tolerance


def cadence_from_intervals(intervals: list[int]) -> dict[str, int | str] | None:
    if not intervals:
        return None

    sorted_intervals = sorted(intervals)
    median = sorted_intervals[len(sorted_intervals) // 2]

    def within_jitter(tolerance: int) -> bool:
        return all(abs(v - median) <= tolerance for v in intervals)

    def near(target: int, tolerance: int) -> bool:
        return abs(median - target) <= tolerance

    if near(7, 2) and within_jitter(2):
        return {"cadence": "tygodniowe", "cadence_days": 7}

    if (near(30, 5) or near(28, 3) or near(31, 4)) and within_jitter(6):
        return {"cadence": "miesięczne", "cadence_days": int(round(median))}

    return None


@dataclass
class RecurringGroup:
    id: str
    name: str
    cadence: Literal["miesięczne", "tygodniowe"]
    next_date: datetime
    average_amount: float
    transaction_ids: list[int | str]


@dataclass
class RecurringScore:
    transaction_id: int | str
    score: float


@dataclass
class RecurringDetectionResult:
    algorithm: str
    scores: list[RecurringScore]
    groups: list[RecurringGroup]


def detect_recurring_payments(transactions: list[dict]) -> RecurringDetectionResult:
    if not transactions:
        return RecurringDetectionResult(algorithm="heuristic_v1", scores=[], groups=[])

    parsed: list[dict] = []
    for tx in transactions:
        try:
            parsed.append(
                {
                    "transaction_id": tx.get("transaction_id", tx.get("id")),
                    "date": datetime.fromisoformat(str(tx["date"])),
                    "amount": float(tx["amount"]),
                    "description": tx.get("description") or "",
                }
            )
        except Exception:
            continue

    buckets: dict[str, list[dict]] = {}
    for tx in parsed:
        normalized = normalize_description(tx["description"])
        if not normalized:
            continue
        direction = "in" if tx["amount"] >= 0 else "out"
        key = f"{normalized}|{direction}"
        buckets.setdefault(key, []).append(tx)

    groups: list[RecurringGroup] = []
    for key, txs in buckets.items():
        if len(txs) < 2:
            continue

        sorted_txs = sorted(txs, key=lambda t: (t["date"], t["transaction_id"]))
        if not is_amount_stable(t["amount"] for t in sorted_txs):
            continue

        intervals: list[int] = []
        for i in range(1, len(sorted_txs)):
            delta = sorted_txs[i]["date"] - sorted_txs[i - 1]["date"]
            intervals.append(int(round(delta.total_seconds() / 86400)))

        cadence_info = cadence_from_intervals(intervals)
        if not cadence_info:
            continue
        if len(intervals) < 2 and len(sorted_txs) < 3:
            continue

        cadence_days = int(cadence_info["cadence_days"])
        last_date = sorted_txs[-1]["date"]
        next_date = last_date + timedelta(days=cadence_days)
        amounts = [tx["amount"] for tx in sorted_txs]
        average_amount = sum(amounts) / len(amounts)

        groups.append(
            RecurringGroup(
                id=key,
                name=sorted_txs[-1]["description"] or "Powtarzalna transakcja",
                cadence=cadence_info["cadence"],  # type: ignore[arg-type]
                next_date=next_date,
                average_amount=average_amount,
                transaction_ids=[tx["transaction_id"] for tx in sorted_txs],
            )
        )

    recurring_ids = {tid for group in groups for tid in group.transaction_ids}
    scores = [
        RecurringScore(
            transaction_id=tx.get("transaction_id", tx.get("id")),
            score=1.0 if tx.get("transaction_id", tx.get("id")) in recurring_ids else 0.0,
        )
        for tx in transactions
    ]

    return RecurringDetectionResult(algorithm="heuristic_v1", scores=scores, groups=groups)
