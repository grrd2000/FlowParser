from pydantic import BaseModel, Field, EmailStr
from datetime import date, datetime
from decimal import Decimal


class UserPreferencesBase(BaseModel):
    currency: str
    default_range: str
    default_granularity: str
    theme: str = "dark"


class UserProfileResponse(UserPreferencesBase):
    id: int
    name: str
    email: EmailStr

    class Config:
        from_attributes = True


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