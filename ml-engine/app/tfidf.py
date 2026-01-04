from __future__ import annotations

import re
import unicodedata
from collections import Counter, defaultdict
from math import log
from typing import Iterable

PHONE_RE = re.compile(
    r"""(
        (\+?48[\s-]?)?              # opcjonalny prefiks PL
        (\(?\d{2,3}\)?[\s-]?)?      # opcjonalny kierunkowy
        \d{3}[\s-]?\d{3}[\s-]?\d{3} # 9 cyfr w grupach
    )""",
    re.VERBOSE,
)

EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)

# długie “identyfikatory” typu 6+ cyfr, numery referencyjne itp.
LONG_NUM_RE = re.compile(r"\b\d{6,}\b")

# IBAN/NRB (PL + 26 cyfr) albo długi numer konta
IBAN_RE = re.compile(r"\bPL\d{26}\b", re.IGNORECASE)

NON_ALNUM_RE = re.compile(r"[^a-z0-9<> ]+")

MULTISPACE_RE = re.compile(r"\s+")

ALNUM_CODE_RE = re.compile(r"\b[a-z]{1,5}\d{2,}\b|\b\d{2,}[a-z]{1,5}\b", re.IGNORECASE)


def strip_diacritics(s: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFD", s) if unicodedata.category(ch) != "Mn")


def normalize_text(s: str) -> str:
    if not s:
        return ""
    s = s.lower().strip()
    s = strip_diacritics(s)

    s = EMAIL_RE.sub("<email>", s)
    s = IBAN_RE.sub("<iban>", s)
    s = PHONE_RE.sub("<phone>", s)
    s = LONG_NUM_RE.sub("<id>", s)
    s = ALNUM_CODE_RE.sub("<code>", s)

    s = NON_ALNUM_RE.sub(" ", s)
    s = MULTISPACE_RE.sub(" ", s).strip()
    return s


def tokenize(s: str) -> list[str]:
    s = normalize_text(s)
    out: list[str] = []
    for tok in s.split():
        if tok.startswith("<") and tok.endswith(">"):
            continue
        if tok.isdigit():
            continue
        if any(ch.isdigit() for ch in tok):
            continue
        if len(tok) < 3:
            continue
        out.append(tok)
    return out


def preprocess_texts(texts: list[str]) -> list[dict[str, object]]:
    """
    Normalizuje i tokenizuje wsadowo, aby ponownie użyć logiki w backendzie.
    """
    results: list[dict[str, object]] = []
    for text in texts:
        norm = normalize_text(text or "")
        toks = tokenize(text or "")
        results.append({"normalized": norm, "tokens": toks})
    return results


def build_df(docs: Iterable[str]) -> tuple[dict[str, int], int]:
    df: dict[str, int] = defaultdict(int)
    n = 0
    for d in docs:
        n += 1
        toks = set(tokenize(d))
        for t in toks:
            df[t] += 1
    return dict(df), n


def best_key_token(description: str, df: dict[str, int], n_docs: int) -> str | None:
    toks = tokenize(description)
    if not toks:
        return None

    tf = Counter(toks)

    best = None
    best_score = -1.0
    for tok, freq in tf.items():
        dfi = df.get(tok, 1)
        idf = log((n_docs + 1) / (dfi + 1)) + 1.0
        score = freq * idf
        if score > best_score:
            best_score = score
            best = tok

    return best


def description_contains_token(description: str, token: str) -> bool:
    toks = set(tokenize(description))
    return token in toks


def suggest_rule_token(
    description: str,
    all_descriptions: list[str],
    uncategorized_descriptions: list[str],
    *,
    min_similar_for_suggestion: int,
    max_token_ratio: float,
) -> dict | None:
    desc = (description or "").strip()
    if not desc:
        return None

    df, n_docs = build_df(all_descriptions)
    if n_docs <= 1:
        return None

    key = best_key_token(desc, df, n_docs)
    if not key:
        return None

    ratio = df.get(key, 0) / max(1, n_docs)
    if ratio > max_token_ratio:
        return None

    similar_count = 0
    for d in uncategorized_descriptions:
        if d and description_contains_token(d, key):
            similar_count += 1

    if similar_count < min_similar_for_suggestion:
        return None

    return {"token": key, "similar_count": similar_count}
