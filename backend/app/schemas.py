from pydantic import BaseModel, Field, EmailStr
from datetime import date, datetime
from decimal import Decimal
from typing import Optional


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


class StatementSummary(BaseModel):
    id: int
    account_id: int
    account_name: str
    account_number: str | None = None
    institution: str | None = None
    currency: str

    file_name: str
    source_type: str | None = None

    period_start: date | None = None
    period_end: date | None = None
    issue_date: date | None = None

    pages_total: int | None = None

    turnover_ma: float | None = None
    turnover_wn: float | None = None
    previous_balance: float | None = None

    import_status: str | None = None
    total_rows: int | None = None
    imported_rows: int | None = None
    error_rows: int | None = None
    finished_at: datetime | None = None

    import_runs_count: int = 0
    is_reimported: bool = False

    class Config:
        from_attributes = True


class CategoryOut(BaseModel):
    id: int
    name: str
    color: Optional[str] = None

    class Config:
        orm_mode = True


class CategoryCreate(BaseModel):
    name: str
    color: Optional[str] = None


class CategoryUpdatePayload(BaseModel):
    category_id: int | None


class CategoryRuleOut(BaseModel):
    id: int
    category_id: int
    field: str
    pattern_type: str
    pattern_value: str
    priority: int
    enabled: bool

    class Config:
        orm_mode = True


class CategoryRuleCreate(BaseModel):
    category_id: int
    pattern_value: str
    pattern_type: str = "contains"  # albo startswith
    field: str = "description"


class ApplyRulesResult(BaseModel):
    assigned: int


class LabSuggestionOut(BaseModel):
    suggestion_key: str
    pattern_value: str
    pattern_type: str
    category_id: int
    category_name: str
    manual_occurrences: int
    potential_matches: int

class LabInsightsOut(BaseModel):
    coverage_total: int
    coverage_categorized: int
    coverage_pct: float
    assignments_manual: int
    assignments_rule: int
    suggestions: list[LabSuggestionOut]

class EnableRulePayload(BaseModel):
    pattern_value: str
    pattern_type: str = "contains"
    category_id: int

class EnableRuleResult(BaseModel):
    created: bool
    applied: int