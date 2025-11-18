import re
from decimal import Decimal, InvalidOperation


def parse_date_str(x: str):
    """Parsuje datę z formatów 'YYYY-MM-DD' lub 'DD.MM.YYYY'."""
    if x is None:
        raise ValueError("Brak daty")
    s = re.sub(r"\s+", "", str(x))
    from datetime import datetime
    for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    raise ValueError(f"Nieprawidłowa data: {x!r}")


def parse_decimal_str(x: str) -> Decimal:
    """Parsuje liczby typu '-3,00' / '433,45' / '1 234,56' na Decimal."""
    if x is None:
        raise ValueError("Brak kwoty")
    s = re.sub(r"\s+", "", str(x))  # usuń spacje
    s = s.replace(",", ".")
    try:
        return Decimal(s)
    except InvalidOperation:
        raise ValueError(f"Nieprawidłowa kwota: {x!r}")