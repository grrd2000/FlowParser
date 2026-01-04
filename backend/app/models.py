from __future__ import annotations

from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    String,
    Date,
    Numeric,
    Integer,
    func,
    DateTime,
    ForeignKey,
    Boolean,
    Float,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column, DeclarativeBase


class Base(DeclarativeBase):
    """Bazowa klasa wszystkich modeli."""
    pass


# -----------------------
#  Users
# -----------------------

class User(Base):
    """
    Użytkownik aplikacji.
    """
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    accounts: Mapped[List["Account"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    preferences = relationship("UserPreference", back_populates="user", uselist=False)


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )

    # preferencje
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="PLN")
    default_range: Mapped[str] = mapped_column(String(8), nullable=False, default="3m")
    default_granularity: Mapped[str] = mapped_column(
        String(16), nullable=False, default="month"
    )
    theme: Mapped[str] = mapped_column(String(16), nullable=False, default="dark")

    user = relationship("User", back_populates="preferences")


# -----------------------
#  Accounts
# -----------------------

class Account(Base):
    """
    Konto finansowe – np. ROR w PKO, karta kredytowa, konto oszczędnościowe.
    """
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    number: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    owner: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)                 
    institution: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  
    currency: Mapped[str] = mapped_column(String(3), default="PLN", nullable=False)
    type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="accounts")
    statements: Mapped[List["Statement"]] = relationship(
        back_populates="account",
        cascade="all, delete-orphan",
    )
    transactions: Mapped[List["Transaction"]] = relationship(
        back_populates="account",
        cascade="all, delete-orphan",
    )


# -----------------------
#  Statements (wyciągi / pliki)
# -----------------------

class Statement(Base):
    """
    Pojedynczy wyciąg / plik źródłowy (np. PDF z PKO) dla danego konta.
    """
    __tablename__ = "statements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)

    file_name: Mapped[str] = mapped_column(String(255), nullable=False)                         # nazwa pliku (np. z uploadu)
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)                      # ścieżka w filesystem (np. uploads/...)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False, default="PKO_PDF")

    period_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    period_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    issue_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    pages_total: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    turnover_ma: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    turnover_wn: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    previous_balance: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    account: Mapped["Account"] = relationship(back_populates="statements")
    import_runs: Mapped[List["ImportRun"]] = relationship(
        back_populates="statement",
        cascade="all, delete-orphan",
    )
    raw_transactions: Mapped[List["RawTransaction"]] = relationship(
        back_populates="statement",
        cascade="all, delete-orphan",
    )


# -----------------------
#  ImportRun (log pojedynczego przetwarzania)
# -----------------------

class ImportRun(Base):
    """
    Pojedyncze uruchomienie importu dla given statement.
    Np. użytkownik wrzucił PDF -> tworzymy Statement + ImportRun.
    """
    __tablename__ = "import_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    statement_id: Mapped[int] = mapped_column(ForeignKey("statements.id"), nullable=False)

    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="uploaded"
    )  # uploaded, processing, success, failed

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    total_rows: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    imported_rows: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error_rows: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    message: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    statement: Mapped["Statement"] = relationship(back_populates="import_runs")
    raw_transactions: Mapped[List["RawTransaction"]] = relationship(
        back_populates="import_run",
        cascade="all, delete-orphan",
    )


# -----------------------
#  RawTransactions (surowe wiersze z wyciągu)
# -----------------------

class RawTransaction(Base):
    """
    Surowy wiersz z wyciągu (raw text) – to, co parser odczytał bezpośrednio z PDF.
    """
    __tablename__ = "raw_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    statement_id: Mapped[int] = mapped_column(ForeignKey("statements.id"), nullable=False)
    import_run_id: Mapped[int] = mapped_column(ForeignKey("import_runs.id"), nullable=False)

    row_index: Mapped[int] = mapped_column(Integer, nullable=False)  # numer wiersza w PDF

    operation_date_raw: Mapped[str] = mapped_column(String(64), nullable=False)
    value_date_raw: Mapped[str] = mapped_column(String(64), nullable=False)
    operation_id_raw: Mapped[str] = mapped_column(String(128), nullable=True)
    description_raw: Mapped[str] = mapped_column(String(1024), nullable=False)
    op_type_raw: Mapped[str] = mapped_column(String(128), nullable=True)
    amount_raw: Mapped[str] = mapped_column(String(64), nullable=False)
    balance_raw: Mapped[str] = mapped_column(String(64), nullable=True)

    parsed_ok: Mapped[bool] = mapped_column(default=True, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    statement: Mapped["Statement"] = relationship(back_populates="raw_transactions")
    import_run: Mapped["ImportRun"] = relationship(back_populates="raw_transactions")
    transaction: Mapped[Optional["Transaction"]] = relationship(
        back_populates="raw_transaction",
        uselist=False,
    )


# -----------------------
#  Transactions (docelowe, z którymi pracuje appka)
# -----------------------

class Transaction(Base):
    """
    Główna tabela transakcji – to, co widzi użytkownik.
    Źródło: import z PDF (powiązane z RawTransaction) lub ręczne wpisy (is_manual=True).
    """
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    raw_transaction_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("raw_transactions.id"), nullable=True
    )

    operation_id: Mapped[str] = mapped_column(String(128), nullable=True)

    operation_date: Mapped[date] = mapped_column(Date, nullable=False)
    value_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    description: Mapped[str] = mapped_column(String(512), nullable=False)
    raw_description: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)
    balance_after: Mapped[Optional[Numeric]] = mapped_column(Numeric(12, 2), nullable=True)

    category: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # na razie prosty string
    is_manual: Mapped[bool] = mapped_column(default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    account: Mapped["Account"] = relationship(back_populates="transactions")
    raw_transaction: Mapped[Optional["RawTransaction"]] = relationship(
        back_populates="transaction"
    )

    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id"),
        nullable=True,
    )
    category_source: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="unknown",  # manual | rule | ml | unknown
    )
    category_confidence: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    category_ref: Mapped["Category | None"] = relationship(
        back_populates="transactions",
        lazy="joined",
    )

class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # na razie możesz mieć jednego usera, ale zostawiamy pod multi-user
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    name: Mapped[str] = mapped_column(String(64), nullable=False)
    color: Mapped[str | None] = mapped_column(String(16), nullable=True)
    icon: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="category_ref",
        lazy="selectin",
    )


class CategoryRule(Base):
    __tablename__ = "category_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id"),
        nullable=False,
    )

    # na razie ograniczamy się do pola description
    field: Mapped[str] = mapped_column(String(32), nullable=False, default="description")
    pattern_type: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="contains",  # contains | startswith | regex
    )
    pattern_value: Mapped[str] = mapped_column(String(128), nullable=False)

    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    category: Mapped["Category"] = relationship(lazy="joined")


class ClassificationEvent(Base):
    __tablename__ = "classification_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.id", ondelete="CASCADE"),
        nullable=False,
    )
    old_category_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    new_category_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    source: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="manual",  # manual | rule | ml
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


class RecurringDetection(Base):
    __tablename__ = "recurring_detections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    run_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    algorithm: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="completed")

    scores: Mapped[list["RecurringScoreEntry"]] = relationship(
        back_populates="detection",
        cascade="all, delete-orphan",
    )
    groups: Mapped[list["RecurringGroup"]] = relationship(
        back_populates="detection",
        cascade="all, delete-orphan",
    )


class RecurringScoreEntry(Base):
    __tablename__ = "recurring_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    detection_id: Mapped[int] = mapped_column(
        ForeignKey("recurring_detections.id", ondelete="CASCADE"),
        nullable=False,
    )
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.id", ondelete="CASCADE"),
        nullable=False,
    )
    score: Mapped[float] = mapped_column(Float, nullable=False)

    detection: Mapped["RecurringDetection"] = relationship(back_populates="scores")
    transaction: Mapped["Transaction"] = relationship()


class RecurringGroup(Base):
    __tablename__ = "recurring_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    detection_id: Mapped[int] = mapped_column(
        ForeignKey("recurring_detections.id", ondelete="CASCADE"),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(String(128), nullable=False, default="Recurring")
    cadence: Mapped[str] = mapped_column(String(32), nullable=False)
    external_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    next_date: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    average_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    detection: Mapped["RecurringDetection"] = relationship(back_populates="groups")
    transactions: Mapped[list["RecurringGroupTransaction"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
    )


class RecurringGroupTransaction(Base):
    __tablename__ = "recurring_group_transactions"

    group_id: Mapped[int] = mapped_column(
        ForeignKey("recurring_groups.id", ondelete="CASCADE"),
        primary_key=True,
    )
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.id", ondelete="CASCADE"),
        primary_key=True,
    )

    group: Mapped["RecurringGroup"] = relationship(back_populates="transactions")
    transaction: Mapped["Transaction"] = relationship()
