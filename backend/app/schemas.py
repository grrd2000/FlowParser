from pydantic import BaseModel, Field, EmailStr
from datetime import date, datetime
from decimal import Decimal


class UserPreferencesBase(BaseModel):
    currency: str  # "PLN" | "EUR" | "USD"
    default_range: str  # "1m" | "3m" | "6m" | "ytd" | "all"
    default_granularity: str  # "day" | "week" | "month" | "quarter"
    theme: str = "dark"


class UserProfileResponse(UserPreferencesBase):
    id: int
    name: str
    email: EmailStr

    class Config:
        from_attributes = True  # dla SQLAlchemy modeli


class UserProfileUpdate(UserPreferencesBase):
    name: str
    email: EmailStr


class AccountSummary(BaseModel):
    id: int
    name: str
    institution: str | None = None
    currency: str
    account_number: str | None = None
    owner: str | None = None
    created_at: datetime | None = None
    transaction_count: int

    class Config:
        from_attributes = True