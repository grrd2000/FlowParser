from __future__ import annotations

import os
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Query
from sqlalchemy import text, select, func
from sqlalchemy.orm import Session

from app.db import engine, SessionLocal
from app.models import (
    Base,
    User,
    Account,
    Statement,
    ImportRun,
    RawTransaction,
    Transaction,
    UserPreference
)

from app.schemas import UserProfileResponse, UserProfileUpdate, AccountSummary, StatementSummary

from app.utils.pko_pdf_parser import parse_pko_statement
from app.utils.data_types_parser import parse_date_str, parse_decimal_str


UPLOAD_DIR = "uploads"


from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="flowparser (prototype, refactored)")

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # frontend, któremu pozwalasz
    allow_credentials=True,
    allow_methods=["*"],          # GET, POST, OPTIONS, itp.
    allow_headers=["*"],
)


# -----------------------
#  DB dependency
# -----------------------

def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -----------------------
#  Startup: tworzenie schematu + domyślny user i account
# -----------------------

# def ensure_default_user_and_account() -> None:
#     """Tworzy przykładowego użytkownika i konto, jeśli jeszcze nie istnieją."""
#     db = SessionLocal()
#     try:
#         user = db.query(User).filter_by(email="demo@example.com").first()
#         if not user:
#             user = User(email="demo@example.com", full_name="Demo User")
#             db.add(user)
#             db.flush()  # żeby mieć user.id

#         account = (
#             db.query(Account)
#             .filter_by(user_id=user.id, name="Główne konto")
#             .first()
#         )
#         if not account:
#             account = Account(
#                 user_id=user.id,
#                 name="Główne konto",
#                 institution="PKO BP",
#                 currency="PLN",
#                 type="checking",
#             )
#             db.add(account)

#         db.commit()
#     finally:
#         db.close()

def get_current_user(db: Session) -> User:
    """
    Tymczasowo: w systemie single-user zwracamy pierwszego istniejącego usera.
    Później to podmienimy na proper auth.
    """
    user = db.query(User).order_by(User.id.asc()).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="No users configured. Create a user in the database first.",
        )
    return user


def get_or_create_user_prefs(db: Session, user: User) -> UserPreference:
    prefs = (
        db.query(UserPreference)
        .filter(UserPreference.user_id == user.id)
        .first()
    )
    if prefs is None:
        prefs = UserPreference(
            user_id=user.id,
            currency="PLN",
            default_range="3m",
            default_granularity="month",
            theme="dark",
        )
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs


@app.on_event("startup")
def on_startup():
    # Tworzymy wszystkie tabele według modeli
    Base.metadata.create_all(bind=engine)

    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)


# -----------------------
#  Healthchecki
# -----------------------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/db/health")
def db_health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"db": "ok"}


def get_or_create_demo_user(db: Session) -> User:
    user = db.query(User).filter_by(email="demo@example.com").first()
    if not user:
        user = User(email="demo@example.com", full_name="Demo User")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


@app.get("/user/me", response_model=UserProfileResponse)
def get_my_profile(db: Session = Depends(get_db)):
    user = get_or_create_demo_user(db)
    prefs = get_or_create_user_prefs(db, user)

    return UserProfileResponse(
        id=user.id,
        name=user.full_name,
        email=user.email,
        currency=prefs.currency,
        default_range=prefs.default_range,
        default_granularity=prefs.default_granularity,
        theme=prefs.theme,
    )


@app.get("/user/me", response_model=UserProfileResponse)
def get_my_profile(db: Session = Depends(get_db)):
    user = get_current_user(db)  # ⬅ tu już NIC się nie tworzy
    prefs = get_or_create_user_prefs(db, user)

    return UserProfileResponse(
        id=user.id,
        name=user.full_name,  # lub user.name – jak masz w modelu
        email=user.email,
        currency=prefs.currency,
        default_range=prefs.default_range,
        default_granularity=prefs.default_granularity,
        theme=prefs.theme,
    )

@app.patch("/user/me", response_model=UserProfileResponse)
def update_my_profile(payload: UserProfileUpdate, db: Session = Depends(get_db)):
    user = get_current_user(db)
    prefs = get_or_create_user_prefs(db, user)

    user.full_name = payload.name  # dopasuj do swojego modelu
    user.email = payload.email

    prefs.currency = payload.currency
    prefs.default_range = payload.default_range
    prefs.default_granularity = payload.default_granularity
    prefs.theme = payload.theme

    db.add(user)
    db.add(prefs)
    db.commit()
    db.refresh(user)
    db.refresh(prefs)

    return UserProfileResponse(
        id=user.id,
        name=user.full_name,
        email=user.email,
        currency=prefs.currency,
        default_range=prefs.default_range,
        default_granularity=prefs.default_granularity,
        theme=prefs.theme,
    )


# -----------------------
#  Accounts – minimalne API
# -----------------------

@app.get("/accounts", response_model=list[AccountSummary])
def list_accounts(db: Session = Depends(get_db)):
    user = get_current_user(db)

    rows = (
        db.query(
            Account.id,
            Account.name,
            Account.institution,
            Account.currency,
            Account.number,
            Account.owner,
            Account.created_at,
            func.count(Transaction.id).label("tx_count"),
        )
        .outerjoin(Transaction, Transaction.account_id == Account.id)
        .filter(Account.user_id == user.id)
        .group_by(
            Account.id,
            Account.name,
            Account.institution,
            Account.currency,
            Account.number,
            Account.owner,
            Account.created_at,
        )
        .all()
    )

    result: list[AccountSummary] = []
    for row in rows:
        result.append(
            AccountSummary(
                id=row.id,
                name=row.name,
                institution=row.institution,
                currency=row.currency,
                account_number=row.number,
                owner=row.owner,
                created_at=row.created_at,
                transaction_count=row.tx_count or 0,
            )
        )
    return result


# -----------------------
#  Schematy Pydantic do ręcznych transakcji
# -----------------------

from pydantic import BaseModel, Field


class TransactionIn(BaseModel):
    account_id: int = Field(..., description="ID konta")
    operation_date: date
    value_date: Optional[date] = None
    description: str = Field(..., min_length=3, max_length=512)
    amount: Decimal
    category: Optional[str] = Field(None, max_length=64)


# -----------------------
#  Transactions – manualne + odczyt
# -----------------------

@app.post("/transactions/manual")
def create_manual_transaction(payload: TransactionIn, db: Session = Depends(get_db)):
    """Dodaje ręczną transakcję (niezależną od wyciągu)."""
    account = db.get(Account, payload.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    tx = Transaction(
        account_id=account.id,
        raw_transaction_id=None,
        operation_date=payload.operation_date,
        value_date=payload.value_date,
        description=payload.description,
        raw_description=payload.description,
        amount=payload.amount,
        balance_after=None,
        category=payload.category,
        is_manual=True,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)

    return {
        "id": tx.id,
        "account_id": tx.account_id,
        "operation_date": tx.operation_date,
        "value_date": tx.value_date,
        "description": tx.description,
        "amount": str(tx.amount),
        "category": tx.category,
        "is_manual": tx.is_manual,
    }


@app.get("/transactions")
def list_transactions(
    account_id: Optional[int] = None,
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None, alias="to"),
    category: Optional[str] = None,
    sort: str = Query("date_desc", pattern="^(date_asc|date_desc)$"),
    db: Session = Depends(get_db),
):
    """
    Lista transakcji z filtrowaniem:
    - ?account_id=...
    - ?from=YYYY-MM-DD
    - ?to=YYYY-MM-DD
    - ?category=...
    - ?sort=date_asc/date_desc
    """
    stmt = select(Transaction)

    if account_id is not None:
        stmt = stmt.where(Transaction.account_id == account_id)
    if from_ is not None:
        stmt = stmt.where(Transaction.operation_date >= from_)
    if to is not None:
        stmt = stmt.where(Transaction.operation_date <= to)
    if category:
        stmt = stmt.where(Transaction.category == category)

    if sort == "date_asc":
        stmt = stmt.order_by(Transaction.operation_date.asc())
    else:
        stmt = stmt.order_by(Transaction.operation_date.desc())

    rows = db.execute(stmt).scalars().all()

    return [
        {
            "id": t.id,
            "account_id": t.account_id,
            "operation_date": t.operation_date,
            "value_date": t.value_date,
            "description": t.description,
            "amount": str(t.amount),
            "balance_after": str(t.balance_after) if t.balance_after is not None else None,
            "category": t.category,
            "is_manual": t.is_manual,
        }
        for t in rows
    ]


# -----------------------
#  Upload + import PDF dla danego konta
# -----------------------

REQUIRED_COLS = [
    "operation_date",
    "value_date",
    "operation_id",
    "description",
    "operation_type",
    "amount",
    "balance",
]

from datetime import datetime, timezone
from fastapi import UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session

# zakładam, że to już importujesz:
# from app.database import get_db
# from app.models import Account, Statement, ImportRun, RawTransaction, Transaction
# from app.utils.pko_pdf_parser import parse_pko_statement
# from app.utils.etl_helpers import parse_date_str, parse_decimal_str
# REQUIRED_COLS = [...]  # jak wcześniej
# get_current_user – ta nowa funkcja, o której pisaliśmy

@app.post("/statements/import-pdf")
async def import_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Import wyciągu PDF:

    1) Zapisuje PDF do /uploads
    2) Parsuje PDF -> DataFrame + account_info + statement_info
    3) Na podstawie account_info:
       - szuka istniejącego konta użytkownika
       - lub tworzy nowe
    4) Tworzy Statement + ImportRun
    5) Zapisuje RawTransactions
    6) Buduje Transactions z konwersją typów w Pythonie
    """

    user = get_current_user(db)

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # --- zapis pliku ---
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)

    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        f.write(await file.read())

    total_rows = 0
    imported_rows = 0
    error_rows = 0

    try:
        # 1) Parsowanie PDF – Twój parser
        df, account_info, statement_info = parse_pko_statement(file_path)

        if not account_info or "account_number" not in account_info:
            raise HTTPException(
                status_code=400,
                detail="Parser nie zwrócił informacji o numerze konta (account_info).",
            )

        account_number = account_info.get("account_number")
        account_name = account_info.get("account_name") or "Konto"
        account_owner = account_info.get("account_owner")
        account_currency = account_info.get("account_currency") or "PLN"

        # 2) SZUKAMY / TWORZYMY konto dla usera na podstawie numeru + waluty + instytucji
        institution = "PKO BP"  # bo to parser PKO – jak kiedyś dodasz inne, tu zrobimy rozgałęzienie

        account = (
            db.query(Account)
            .filter(
                Account.user_id == user.id,
                Account.number == account_number,
                Account.currency == account_currency,
                Account.institution == institution,
            )
            .first()
        )

        if not account:
            account = Account(
                user_id=user.id,
                number=account_number,
                name=account_name,
                owner=account_owner,
                institution=institution,
                currency=account_currency,
            )
            db.add(account)
            db.flush()  # mamy account.id

        # 3) Tworzymy Statement – dopiero po ustaleniu konta
        statement = Statement(
            account_id=account.id,
            file_name=file.filename,
            storage_path=file_path,
            source_type="PKO_PDF",
        )

        if statement_info:
            try:
                statement.period_start = datetime.strptime(
                    statement_info.get("period_start"), "%d.%m.%Y"
                ).date()
                statement.period_end = datetime.strptime(
                    statement_info.get("period_end"), "%d.%m.%Y"
                ).date()
                statement.issue_date = datetime.strptime(
                    statement_info.get("statement_date"), "%d.%m.%Y"
                ).date()
            except Exception:
                # jeśli coś nie tak z datami – niech statement żyje, ale bez nich
                pass

            statement.pages_total = statement_info.get("pages_total")
            if statement_info.get("turnover_ma"):
                statement.turnover_ma = parse_decimal_str(
                  statement_info.get("turnover_ma")
                )
            if statement_info.get("turnover_wn"):
                statement.turnover_wn = parse_decimal_str(
                  statement_info.get("turnover_wn")
                )
            if statement_info.get("previous_balance"):
                statement.previous_balance = parse_decimal_str(
                  statement_info.get("previous_balance")
                )

        db.add(statement)
        db.flush()  # statement.id

        # 4) ImportRun (start)
        run = ImportRun(
            statement_id=statement.id,
            status="processing",
        )
        db.add(run)
        db.flush()  # run.id

        # 5) Surowe dane – weryfikacja kolumn
        print("PKO DF columns:", list(df.columns))
        total_rows = len(df)

        missing = [c for c in REQUIRED_COLS if c not in df.columns]
        if missing:
            msg = f"Parser nie zwrócił wymaganych kolumn: {missing}. Kolumny DF: {list(df.columns)}"
            run.status = "failed"
            run.message = msg
            run.finished_at = datetime.now(timezone.utc)
            db.commit()
            raise HTTPException(status_code=400, detail=msg)

        # 6) RAW TRANSACTIONS – zapis tekstów
        for idx, row in df.iterrows():
            raw = RawTransaction(
                statement_id=statement.id,
                import_run_id=run.id,
                row_index=int(idx),
                operation_date_raw=str(row["operation_date"]),
                value_date_raw=str(row["value_date"]),
                operation_id_raw=str(row.get("operation_id", "")),
                description_raw=str(row["description"]),
                op_type_raw=str(row.get("operation_type", "")),
                amount_raw=str(row["amount"]),
                balance_raw=str(row.get("balance", "")),
                parsed_ok=True,
                error_message=None,
            )
            db.add(raw)

        db.commit()  # RAW zapisane

        # 7) ETL: RawTransactions -> Transactions
        raws = (
            db.query(RawTransaction)
            .filter(RawTransaction.import_run_id == run.id)
            .order_by(RawTransaction.row_index.asc())
            .all()
        )

        for raw in raws:
            try:
                op_date = parse_date_str(raw.operation_date_raw)
                val_date = parse_date_str(raw.value_date_raw)
                amount = parse_decimal_str(raw.amount_raw)
                balance = (
                    parse_decimal_str(raw.balance_raw)
                    if raw.balance_raw not in (None, "", "None")
                    else None
                )

                tx = Transaction(
                    account_id=account.id,
                    raw_transaction_id=raw.id,
                    operation_date=op_date,
                    value_date=val_date,
                    description=raw.description_raw,
                    raw_description=raw.description_raw,
                    amount=amount,
                    balance_after=balance,
                    category=None,
                    is_manual=False,
                )
                db.add(tx)

                raw.parsed_ok = True
                raw.error_message = None
                imported_rows += 1

            except Exception as e:
                raw.parsed_ok = False
                raw.error_message = str(e)
                error_rows += 1

        run.status = "success" if error_rows == 0 else "partial_success"
        run.total_rows = total_rows
        run.imported_rows = imported_rows
        run.error_rows = error_rows
        run.finished_at = datetime.now(timezone.utc)
        db.commit()

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        # zabezpieczenie – jeśli run istnieje
        try:
            run.status = "failed"
            run.message = str(e)
            run.finished_at = datetime.now(timezone.utc)
            db.add(run)
            db.commit()
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=f"Error during import: {e}")

    return {
        "account_id": account.id,
        "statement_id": statement.id,
        "import_run_id": run.id,
        "file_name": file.filename,
        "total_rows": total_rows,
        "imported_rows": imported_rows,
        "error_rows": error_rows,
        "status": run.status,
    }




@app.get("/accounts", response_model=list[AccountSummary])
def list_accounts(db: Session = Depends(get_db)):
    # demo – ten sam user co w /user/me
    user = get_or_create_demo_user(db)

    # join z transakcjami + count
    rows = (
        db.query(
            Account,
            func.count(Transaction.id).label("tx_count"),
        )
        .outerjoin(
            Transaction, Transaction.account_id == Account.id
        )
        .filter(Account.user_id == user.id)
        .group_by(Account.id)
        .all()
    )

    result: list[AccountSummary] = []
    for account, tx_count in rows:
        result.append(
            AccountSummary(
                id=account.id,
                name=getattr(account, "name", "Konto"),
                institution=getattr(account, "institution", None),
                currency=getattr(account, "currency", "PLN"),
                account_number=getattr(account, "account_number", None),
                owner=getattr(account, "owner", None),
                created_at=getattr(account, "created_at", None),
                transaction_count=tx_count or 0,
            )
        )

    return result


@app.get("/statements", response_model=list[StatementSummary])
def list_statements(db: Session = Depends(get_db)):
    user = get_current_user(db)

    # join: Statement -> Account -> ImportRun (ostatni run, jeśli masz ich więcej)
    # zakładam, że dla każdego statementu masz maksymalnie 1 ImportRun
    rows = (
        db.query(
            Statement.id,
            Statement.account_id,
            Statement.file_name,
            Statement.source_type,
            Statement.period_start,
            Statement.period_end,
            Statement.issue_date,
            Statement.pages_total,
            Statement.turnover_ma,
            Statement.turnover_wn,
            Statement.previous_balance,
            Account.name.label("account_name"),
            Account.number.label("account_number"),
            Account.institution.label("institution"),
            Account.currency.label("currency"),
            ImportRun.status.label("import_status"),
            ImportRun.total_rows,
            ImportRun.imported_rows,
            ImportRun.error_rows,
            ImportRun.finished_at,
        )
        .join(Account, Account.id == Statement.account_id)
        .outerjoin(ImportRun, ImportRun.statement_id == Statement.id)
        .filter(Account.user_id == user.id)
        .order_by(Statement.issue_date.desc().nullslast(), Statement.id.desc())
        .all()
    )

    result: list[StatementSummary] = []
    for r in rows:
        result.append(
            StatementSummary(
                id=r.id,
                account_id=r.account_id,
                account_name=r.account_name,
                account_number=r.account_number,
                institution=r.institution,
                currency=r.currency,
                file_name=r.file_name,
                source_type=r.source_type,
                period_start=r.period_start,
                period_end=r.period_end,
                issue_date=r.issue_date,
                pages_total=r.pages_total,
                turnover_ma=float(r.turnover_ma) if r.turnover_ma is not None else None,
                turnover_wn=float(r.turnover_wn) if r.turnover_wn is not None else None,
                previous_balance=float(r.previous_balance)
                if r.previous_balance is not None
                else None,
                import_status=r.import_status,
                total_rows=r.total_rows,
                imported_rows=r.imported_rows,
                error_rows=r.error_rows,
                finished_at=r.finished_at,
            )
        )

    return result


# -----------------------
#  Podgląd importów i RAW (do debugu)
# -----------------------

@app.get("/import-runs")
def list_import_runs(db: Session = Depends(get_db)):
    runs = db.execute(select(ImportRun).order_by(ImportRun.id.desc())).scalars().all()
    return [
        {
            "id": r.id,
            "statement_id": r.statement_id,
            "status": r.status,
            "started_at": r.started_at,
            "finished_at": r.finished_at,
            "total_rows": r.total_rows,
            "imported_rows": r.imported_rows,
            "error_rows": r.error_rows,
            "message": r.message,
        }
        for r in runs
    ]


@app.get("/raw-transactions")
def list_raw_transactions(
    import_run_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    stmt = select(RawTransaction).order_by(RawTransaction.id.desc())
    if import_run_id is not None:
        stmt = stmt.where(RawTransaction.import_run_id == import_run_id)

    rows = db.execute(stmt.limit(limit)).scalars().all()
    return [
        {
            "id": r.id,
            "statement_id": r.statement_id,
            "import_run_id": r.import_run_id,
            "row_index": r.row_index,
            "operation_date_raw": r.operation_date_raw,
            "value_date_raw": r.value_date_raw,
            "operation_id_raw": r.operation_id_raw,
            "description_raw": r.description_raw,
            "op_type_raw": r.op_type_raw,
            "amount_raw": r.amount_raw,
            "balance_raw": r.balance_raw,
            "parsed_ok": r.parsed_ok,
            "error_message": r.error_message,
            "created_at": r.created_at,
        }
        for r in rows
    ]
