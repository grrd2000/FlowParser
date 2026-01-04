from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Iterable, Literal, Tuple


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

    rounded = [int(round(v)) for v in intervals]

    def candidate(
        cadence: Literal["tygodniowe", "miesięczne"], target: int, tolerance: int
    ) -> Tuple[float, dict[str, int | str]] | None:
        cluster = [v for v in rounded if abs(v - target) <= tolerance]
        if not cluster:
            return None

        coverage = len(cluster) / len(rounded)
        jitter = max(abs(v - target) for v in cluster)
        cadence_days = int(round(sum(cluster) / len(cluster)))
        cadence_days = max(1, cadence_days)

        strength = coverage * 0.7 + max(0.0, 1 - jitter / max(tolerance, 1)) * 0.3
        return strength, {
            "cadence": cadence,
            "cadence_days": cadence_days,
            "coverage": coverage,
            "tolerance": tolerance,
            "jitter": jitter,
        }

    candidates = [
        candidate("tygodniowe", 7, 2),
        candidate("miesięczne", 30, 7),
    ]
    scored = [c for c in candidates if c]
    if not scored:
        return None

    scored.sort(key=lambda item: item[0], reverse=True)
    best_strength, best_payload = scored[0]
    if best_strength < 0.35:  # very weak signal
        return None

    return best_payload


@dataclass
class RecurringGroup:
    id: str
    name: str
    cadence: Literal["miesięczne", "tygodniowe"]
    next_date: datetime
    average_amount: float
    transaction_ids: list[int | str]
    confidence: float


@dataclass
class RecurringScore:
    transaction_id: int | str
    score: float


@dataclass
class RecurringDetectionResult:
    algorithm: str
    scores: list[RecurringScore]
    groups: list[RecurringGroup]
    skipped_count: int = 0


def detect_recurring_payments(transactions: list[dict]) -> RecurringDetectionResult:
    if not transactions:
        return RecurringDetectionResult(algorithm="heuristic_v2", scores=[], groups=[], skipped_count=0)

    parsed: list[dict] = []
    skipped_count = 0
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
            skipped_count += 1
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

        cadence_days = int(cadence_info["cadence_days"])
        last_date = sorted_txs[-1]["date"]
        next_date = last_date + timedelta(days=cadence_days)
        amounts = [tx["amount"] for tx in sorted_txs]
        average_amount = sum(amounts) / len(amounts)

        # Confidence combines cadence strength, amount stability, sample size and recency
        coverage = float(cadence_info.get("coverage", 0.0))
        jitter = float(cadence_info.get("jitter", 0.0))
        tolerance = float(cadence_info.get("tolerance", 1.0))
        cadence_strength = min(1.0, 0.6 * coverage + 0.4 * max(0.0, 1 - jitter / max(tolerance, 1)))

        abs_amounts = [abs(a) for a in amounts]
        spread = max(abs_amounts) - min(abs_amounts)
        avg_amount = sum(abs_amounts) / len(abs_amounts)
        allowed_spread = max(5.0, avg_amount * 0.15)
        amount_score = max(0.0, min(1.0, 1 - spread / allowed_spread))

        sample_score = min(1.0, (len(sorted_txs) - 1) / 5)
        days_since_last = max((datetime.utcnow() - last_date).days, 0)
        recency_penalty = max(0.0, days_since_last - cadence_days)
        recency_score = max(
            0.0,
            1 - recency_penalty / max(cadence_days * 2, 1),
        )

        confidence = round(
            0.4 * cadence_strength
            + 0.3 * amount_score
            + 0.2 * sample_score
            + 0.1 * recency_score,
            3,
        )

        groups.append(
            RecurringGroup(
                id=key,
                name=sorted_txs[-1]["description"] or "Powtarzalna transakcja",
                cadence=cadence_info["cadence"],  # type: ignore[arg-type]
                next_date=next_date,
                average_amount=average_amount,
                transaction_ids=[tx["transaction_id"] for tx in sorted_txs],
                confidence=confidence,
            )
        )

    groups.sort(key=lambda g: g.confidence, reverse=True)

    score_map: dict[int | str, float] = {}
    for group in groups:
        for tid in group.transaction_ids:
            score_map[tid] = max(score_map.get(tid, 0.0), group.confidence)

    scores = [
        RecurringScore(
            transaction_id=tx.get("transaction_id", tx.get("id")),
            score=round(score_map.get(tx.get("transaction_id", tx.get("id")), 0.0), 3),
        )
        for tx in transactions
    ]

    return RecurringDetectionResult(
        algorithm="heuristic_v2",
        scores=scores,
        groups=groups,
        skipped_count=skipped_count,
    )
