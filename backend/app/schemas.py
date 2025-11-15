from pydantic import BaseModel, Field
from datetime import date
from decimal import Decimal

class EntryIn(BaseModel):
    booking_date: date = Field(..., description="Data wpisu (YYYY-MM-DD)")
    description: str = Field(..., min_length=3, max_length=256, description="Opis transakcji")
    amount: Decimal = Field(..., description="Kwota w PLN, np. 12.34 (ujemna = wydatek)")
    category: str | None = Field(None, max_length=64, description="Opcjonalna kategoria (np. jedzenie)")


class EntryOut(EntryIn):
    id: int = Field(..., description="Unikalny identyfikator wpisu")