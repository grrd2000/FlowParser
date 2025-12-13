# backend/app/utils/similarity.py
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
    # żółć -> zolc
    return "".join(
        ch
        for ch in unicodedata.normalize("NFD", s)
        if unicodedata.category(ch) != "Mn"
    )


def normalize_text(s: str) -> str:
    if not s:
        return ""
    s = s.lower().strip()
    s = strip_diacritics(s)

    # maskujemy rzeczy “dynamiczne”, które psują grupowanie
    s = EMAIL_RE.sub("<email>", s)
    s = IBAN_RE.sub("<iban>", s)
    s = PHONE_RE.sub("<phone>", s)
    s = LONG_NUM_RE.sub("<id>", s)
    s = ALNUM_CODE_RE.sub("<code>", s)

    # czyścimy znaki specjalne (zostawiamy litery/cyfry/spacje i <...>)
    s = NON_ALNUM_RE.sub(" ", s)
    s = MULTISPACE_RE.sub(" ", s).strip()

    print(f"Normalized text: {s}")
    return s


def tokenize(s: str) -> list[str]:
    """
    Tokeny do podobieństwa – bez cyfr, bez placeholderów, sensowna długość.
    """
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


def build_df(docs: Iterable[str]) -> tuple[dict[str, int], int]:
    """
    Document frequency: w ilu opisach występuje dany token.
    """
    df: dict[str, int] = defaultdict(int)
    n = 0
    for d in docs:
        n += 1
        toks = set(tokenize(d))
        for t in toks:
            df[t] += 1
    return dict(df), n


def best_key_token(description: str, df: dict[str, int], n_docs: int) -> str | None:
    """
    Wybieramy token “kotwicę” w pełni automatycznie.
    TF-IDF sprawia, że bardzo ogólne słowa (występujące wszędzie) dostają niski score.
    """
    toks = tokenize(description)
    if not toks:
        return None

    tf = Counter(toks)

    best = None
    best_score = -1.0
    for tok, freq in tf.items():
        dfi = df.get(tok, 1)
        # IDF: im częściej token występuje w całej bazie, tym niższy
        idf = log((n_docs + 1) / (dfi + 1)) + 1.0
        score = freq * idf

        # dodatkowe zabezpieczenie: tokeny bardzo rzadkie (df=1) czasem są śmieciami,
        # ale i tak pozwólmy im wygrać tylko jeśli są “słowne”
        if score > best_score:
            best_score = score
            best = tok

    return best


def description_contains_token(description: str, token: str) -> bool:
    toks = set(tokenize(description))
    return token in toks
