from __future__ import annotations

import os
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

import unicodedata
import re

from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Query
from sqlalchemy import text, select, func
from sqlalchemy.orm import Session
from app.db import get_db

from app.db import engine, SessionLocal
from app.models import (
    Base,
    User,
    Account,
    Statement,
    ImportRun,
    RawTransaction,
    Transaction,
    UserPreference,
    Category,
    CategoryRule,
    ClassificationEvent
)

from app.schemas import (
    UserProfileResponse,
    UserProfileUpdate,
    AccountSummary,
    StatementSummary,
    CategoryOut,
    CategoryUpdatePayload,
    CategoryCreate,
    CategoryUpdate,              # <-- DODAJ
    CategoryRuleOut,
    CategoryRuleCreate,
    CategoryRuleUpdate,          # <-- DODAJ
    CategoryRuleReorder,         # <-- DODAJ
    ApplyRulesResult,
    LabInsightsOut,
    EnableRuleResult,
    EnableRulePayload,
    LabSuggestionOut
)

from app.utils.pko_pdf_parser import parse_pko_statement
from app.utils.data_types_parser import parse_date_str, parse_decimal_str
from app.utils.similarity import build_df, best_key_token, description_contains_token, tokenize

from app.auth import (
    get_current_user as auth_get_current_user,
    hash_password,
)


UPLOAD_DIR = "uploads"


from fastapi.middleware.cors import CORSMiddleware
from app.auth_routes import router as auth_router

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "43200"))  # 30 days

DEV_AUTO_USER = os.getenv("DEV_AUTO_USER", "true").lower() == "false"
DEV_USER_EMAIL = os.getenv("DEV_USER_EMAIL", "demo@example.com")
DEV_USER_PASSWORD = os.getenv("DEV_USER_PASSWORD", "demo123")
DEV_USER_FULL_NAME = os.getenv("DEV_USER_FULL_NAME", "Demo User")

app = FastAPI(title="flowparser (prototype, refactored)")

app.state.SECRET_KEY = SECRET_KEY
app.state.ACCESS_TOKEN_EXPIRE_MINUTES = ACCESS_TOKEN_EXPIRE_MINUTES

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

app.include_router(auth_router)

# -----------------------
#  DB dependency
# -----------------------

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


def ensure_default_categories(db: Session, user: User):
    """Na starcie tworzy kilka bazowych kategorii, jeśli jeszcze nie istnieją."""
    existing = (
        db.query(Category)
        .filter(Category.user_id == user.id)
        .count()
    )
    if existing > 0:
        return

    base_cats = [
        ("Jedzenie", "#22c55e"),
        ("Transport", "#3b82f6"),
        ("Zakupy", "#a855f7"),
        ("Subskrypcje", "#f97316"),
        ("Inne", "#9ca3af"),
    ]
    for name, color in base_cats:
        db.add(
            Category(
                user_id=user.id,
                name=name,
                color=color,
                is_system=True,
            )
        )
    db.commit()


def ensure_dev_user(db: Session) -> User | None:
    if not DEV_AUTO_USER:
        return None

    email = DEV_USER_EMAIL.strip().lower()
    password = DEV_USER_PASSWORD
    full_name = DEV_USER_FULL_NAME.strip() or None

    if not email or not password:
        return None

    user = db.query(User).filter(User.email == email).first()
    if user:
        return user

    user = User(
        email=email,
        full_name=full_name,
        password_hash=hash_password(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        dev_user = ensure_dev_user(db=db)
        user_for_defaults = dev_user or db.query(User).order_by(User.id.asc()).first()
        if user_for_defaults:
            ensure_default_categories(db=db, user=user_for_defaults)
    finally:
        db.close()

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


def wipe_statement_data(db: Session, statement_id: int) -> None:
    """
    Usuwa wszystkie RawTransaction i Transaction powiązane z danym statementem.
    Używane przy reimpocie wyciągu (ten sam okres, to samo konto).
    """
    # znajdź ID rawów dla danego statementu
    raw_ids = [
        r_id
        for (r_id,) in db.query(RawTransaction.id)
        .filter(RawTransaction.statement_id == statement_id)
        .all()
    ]
    print("Wiping statement ID:", statement_id)
    print(RawTransaction.statement_id == statement_id)
    print("Wiping raws:", raw_ids)

    if raw_ids:
        # najpierw usuwamy Transactions powiązane z tymi rawami
        db.query(Transaction).where(
            Transaction.raw_transaction_id.in_(raw_ids)
        ).delete(synchronize_session=False)

        # potem same rawy
        db.query(RawTransaction).where(
            RawTransaction.id.in_(raw_ids)
        ).delete(synchronize_session=False)


@app.get("/user/me", response_model=UserProfileResponse)
def get_my_profile(
    user: User = Depends(auth_get_current_user), db: Session = Depends(get_db)
):
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

@app.patch("/user/me", response_model=UserProfileResponse)
def update_my_profile(
    payload: UserProfileUpdate,
    user: User = Depends(auth_get_current_user),
    db: Session = Depends(get_db),
):
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
def list_accounts(
    user: User = Depends(auth_get_current_user), db: Session = Depends(get_db)
):

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
            "category_id": t.category_id,
            "category_source": t.category_source,
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
    user: User = Depends(auth_get_current_user),
    db: Session = Depends(get_db),
):
    """
    Import wyciągu PDF:

    - zapisuje PDF
    - parsuje go na DF + account_info + statement_info
    - NAJPIERW sprawdza, czy taki wyciąg nie był już importowany
    - jeśli nie, tworzy Account (jeśli trzeba), Statement, ImportRun, RawTransactions, Transactions
    """

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # --- zapis pliku na dysk ---
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)

    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        f.write(await file.read())

    total_rows = 0
    imported_rows = 0
    error_rows = 0
    reimport = False

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
        institution = "PKO BP"

        # 2) USTALAMY OKRES WYCIĄGU – potrzebne do deduplikacji
        period_start_date = None
        period_end_date = None
        issue_date = None
        turnover_ma = None
        turnover_wn = None
        previous_balance = None

        if statement_info:
            try:
                if statement_info.get("period_start"):
                    period_start_date = datetime.strptime(
                        statement_info["period_start"], "%d.%m.%Y"
                    ).date()
                if statement_info.get("period_end"):
                    period_end_date = datetime.strptime(
                        statement_info["period_end"], "%d.%m.%Y"
                    ).date()
                if statement_info.get("statement_date"):
                    issue_date = datetime.strptime(
                        statement_info["statement_date"], "%d.%m.%Y"
                    ).date()
            except Exception:
                # jeśli daty są dziwne – trudno, dalej próbujemy, ale deduplikacja będzie tylko po tym, co mamy
                pass

            if statement_info.get("turnover_ma"):
                turnover_ma = parse_decimal_str(statement_info["turnover_ma"])
            if statement_info.get("turnover_wn"):
                turnover_wn = parse_decimal_str(statement_info["turnover_wn"])
            if statement_info.get("previous_balance"):
                previous_balance = parse_decimal_str(
                    statement_info["previous_balance"]
                )

        # 3) SZUKAMY / TWORZYMY konto
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
            db.flush()

        # 4) DEDUPE: sprawdź, czy dla tego konta jest już statement
        #    z takim samym okresem (i ew. sumami)
        if period_start_date and period_end_date:
            dup_query = (
                db.query(Statement)
                .filter(
                    Statement.account_id == account.id,
                    Statement.period_start == period_start_date,
                    Statement.period_end == period_end_date,
                )
            )

            existing_stmt = dup_query.first()
        else:
            existing_stmt = None

        # print(dup_query)
        # print(dup_query.first())

        if existing_stmt:
            print("Found existing statement – reimporting:", existing_stmt.id)
            # REIMPORT: czyścimy stare dane i używamy istniejącego statementu
            wipe_statement_data(db, existing_stmt.id)

            statement = existing_stmt
            reimport = True

            # ewentualnie aktualizujemy metadane (daty, sumy) jeśli parser zwrócił coś nowego
            statement.issue_date = issue_date or statement.issue_date
            statement.turnover_ma = turnover_ma or statement.turnover_ma
            statement.turnover_wn = turnover_wn or statement.turnover_wn
            statement.previous_balance = previous_balance or statement.previous_balance

        else:
            # PIERWSZY IMPORT: tworzymy nowy statement
            # 5) Skoro nie ma duplikatu – tworzymy Statement
            statement = Statement(
                account_id=account.id,
                file_name=file.filename,
                storage_path=file_path,
                source_type="PKO_PDF",
                period_start=period_start_date,
                period_end=period_end_date,
                issue_date=issue_date,
                turnover_ma=turnover_ma,
                turnover_wn=turnover_wn,
                previous_balance=previous_balance,
            )
            if statement_info:
                statement.pages_total = statement_info.get("pages_total")

            db.add(statement)
            db.flush()


        # 6) ImportRun
        run = ImportRun(
            statement_id=statement.id,
            status="processing",
        )
        db.add(run)
        db.flush()

        # 7) Walidacja kolumn DF
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

        # 8) RAW TRANSACTIONS
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

        db.commit()

        # 9) ETL -> Transactions
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
                    operation_id=raw.operation_id_raw,
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
        try:
            run.status = "failed"  # type: ignore[name-defined]
            run.message = str(e)   # type: ignore[name-defined]
            run.finished_at = datetime.now(timezone.utc)  # type: ignore[name-defined]
            db.add(run)  # type: ignore[name-defined]
            db.commit()
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=f"Error during import: {e}")

    # po udanym imporcie transakcji:
    try:
        apply_rules_for_user(db, account.user_id)  # albo user.id
    except Exception:
        # nie wywracaj importu, reguły to “post-process”
        pass

    return {
        "account_id": account.id,
        "statement_id": statement.id,
        "import_run_id": run.id,
        "file_name": file.filename,
        "total_rows": total_rows,
        "imported_rows": imported_rows,
        "error_rows": error_rows,
        "status": run.status,
        "reimport": reimport,
        # "auto_categorized_by_rules": auto_by_rules,
    }



@app.get("/accounts", response_model=list[AccountSummary])
def list_accounts(
    user: User = Depends(auth_get_current_user), db: Session = Depends(get_db)
):

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
def list_statements(
    user: User = Depends(auth_get_current_user), db: Session = Depends(get_db)
):

    # subquery: ile runów i który jest ostatni
    runs_sub = (
        db.query(
            ImportRun.statement_id.label("sid"),
            func.count(ImportRun.id).label("runs_count"),
            func.max(ImportRun.id).label("last_run_id"),
        )
        .group_by(ImportRun.statement_id)
        .subquery()
    )

    rows = (
        db.query(
            Statement,
            Account,
            ImportRun,
            runs_sub.c.runs_count,
        )
        .join(Account, Account.id == Statement.account_id)
        .outerjoin(runs_sub, runs_sub.c.sid == Statement.id)
        .outerjoin(ImportRun, ImportRun.id == runs_sub.c.last_run_id)
        .filter(Account.user_id == user.id)
        .order_by(Statement.issue_date.desc().nullslast(), Statement.id.desc())
        .all()
    )

    result: list[StatementSummary] = []
    for st, acc, run, runs_count in rows:
        result.append(
            StatementSummary(
                id=st.id,
                account_id=st.account_id,
                account_name=acc.name,
                account_number=acc.number,
                institution=acc.institution,
                currency=acc.currency,
                file_name=st.file_name,
                source_type=st.source_type,
                period_start=st.period_start,
                period_end=st.period_end,
                issue_date=st.issue_date,
                pages_total=st.pages_total,
                turnover_ma=float(st.turnover_ma) if st.turnover_ma is not None else None,
                turnover_wn=float(st.turnover_wn) if st.turnover_wn is not None else None,
                previous_balance=float(st.previous_balance)
                if st.previous_balance is not None
                else None,
                import_status=run.status if run else None,
                total_rows=run.total_rows if run else None,
                imported_rows=run.imported_rows if run else None,
                error_rows=run.error_rows if run else None,
                finished_at=run.finished_at if run else None,
                import_runs_count=runs_count or 0,
                is_reimported=(runs_count or 0) > 1,
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

@app.get("/categories", response_model=list[CategoryOut])
def list_categories(
    user: User = Depends(auth_get_current_user), db: Session = Depends(get_db)
):

    cats = (
        db.query(Category)
        .filter(Category.user_id == user.id)
        .order_by(Category.name.asc())
        .all()
    )
    return cats


@app.post("/categories", response_model=CategoryOut)
def create_category(
    payload: CategoryCreate,
    user: User = Depends(auth_get_current_user),
    db: Session = Depends(get_db),
):

    cat = Category(
        user_id=user.id,
        name=payload.name,
        color=payload.color,
        is_system=False,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


from sqlalchemy import func

@app.put("/categories/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    user: User = Depends(auth_get_current_user),
    db: Session = Depends(get_db),
):

    cat = db.get(Category, category_id)
    if not cat or cat.user_id != user.id:
        raise HTTPException(status_code=404, detail="Category not found")

    # opcjonalnie: unikalna nazwa per user
    if payload.name:
        dup = (
            db.query(Category)
            .filter(
                Category.user_id == user.id,
                func.lower(Category.name) == payload.name.lower(),
                Category.id != cat.id,
            )
            .first()
        )
        if dup:
            raise HTTPException(status_code=409, detail="Category name already exists")

    if payload.name is not None:
        cat.name = payload.name.strip()
    if payload.color is not None:
        cat.color = payload.color
    if payload.icon is not None:
        cat.icon = payload.icon

    db.commit()
    db.refresh(cat)
    return cat


@app.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    unassign: bool = Query(False),
    user: User = Depends(auth_get_current_user),
    db: Session = Depends(get_db),
):
    cat = db.get(Category, category_id)
    if not cat or cat.user_id != user.id:
        raise HTTPException(status_code=404, detail="Category not found")

    # policz użycia w transakcjach usera
    tx_q = (
        db.query(Transaction)
        .join(Account, Account.id == Transaction.account_id)
        .filter(Account.user_id == user.id, Transaction.category_id == cat.id)
    )
    tx_count = tx_q.count()

    rule_q = db.query(CategoryRule).filter(
        CategoryRule.user_id == user.id,
        CategoryRule.category_id == cat.id,
    )
    rule_count = rule_q.count()

    if (tx_count > 0 or rule_count > 0) and not unassign:
        raise HTTPException(
            status_code=409,
            detail=f"Category is in use (transactions={tx_count}, rules={rule_count}). Use ?unassign=true",
        )

    if unassign:
        # odłącz kategorię od transakcji
        tx_q.update(
            {
                Transaction.category_id: None,
                Transaction.category: None,
                Transaction.category_source: "unknown",
                Transaction.category_confidence: None,
            },
            synchronize_session=False,
        )

        # usuń reguły wskazujące na tę kategorię
        rule_q.delete(synchronize_session=False)

    db.delete(cat)
    db.commit()
    return {"deleted": True}




@app.get("/categories/stats")
def category_stats(
    user: User = Depends(auth_get_current_user), db: Session = Depends(get_db)
):

    rows = (
        db.query(Transaction.category_id, func.count(Transaction.id))
        .join(Account, Account.id == Transaction.account_id)
        .filter(Account.user_id == user.id)
        .filter(Transaction.category_id.isnot(None))
        .group_by(Transaction.category_id)
        .all()
    )

    # {category_id: tx_count}
    return {int(cat_id): int(cnt) for (cat_id, cnt) in rows}


@app.put("/category-rules/{rule_id}", response_model=CategoryRuleOut)
def update_category_rule(
    rule_id: int,
    payload: CategoryRuleUpdate,
    user: User = Depends(auth_get_current_user),
    db: Session = Depends(get_db),
):

    rule = db.get(CategoryRule, rule_id)
    if not rule or rule.user_id != user.id:
        raise HTTPException(status_code=404, detail="Rule not found")

    if payload.category_id is not None:
        cat = db.get(Category, payload.category_id)
        if not cat or cat.user_id != user.id:
            raise HTTPException(status_code=404, detail="Category not found")
        rule.category_id = cat.id

    if payload.pattern_value is not None:
        rule.pattern_value = payload.pattern_value.strip()
    if payload.pattern_type is not None:
        rule.pattern_type = payload.pattern_type
    if payload.field is not None:
        rule.field = payload.field
    if payload.priority is not None:
        rule.priority = int(payload.priority)
    if payload.enabled is not None:
        rule.enabled = bool(payload.enabled)

    db.commit()
    db.refresh(rule)
    return rule


def _rule_matches_tx(rule: CategoryRule, desc: str | None) -> bool:
    raw = desc or ""
    norm = normalize_text(raw)

    if rule.pattern_type == "token":
        return description_contains_token(raw, rule.pattern_value or "")

    pat = normalize_text(rule.pattern_value or "")
    if not pat:
        return False

    if rule.pattern_type == "contains":
        return pat in norm
    if rule.pattern_type == "startswith":
        return norm.startswith(pat)
    if rule.pattern_type == "equals":
        return norm == pat
    return False


@app.delete("/category-rules/{rule_id}")
def delete_category_rule(
    rule_id: int,
    unassign: bool = Query(True),
    user: User = Depends(auth_get_current_user),
    db: Session = Depends(get_db),
):
    rule = db.get(CategoryRule, rule_id)
    if not rule or rule.user_id != user.id:
        raise HTTPException(status_code=404, detail="Rule not found")

    if unassign:
        # kandydaci: tylko ci, którzy mają kategorię z reguły i source == "rule"
        rows = (
            db.query(Transaction.id, Transaction.description)
            .join(Account, Account.id == Transaction.account_id)
            .filter(
                Account.user_id == user.id,
                Transaction.category_id == rule.category_id,
                Transaction.category_source == "rule",
            )
            .all()
        )

        tx_ids = [tx_id for tx_id, desc in rows if _rule_matches_tx(rule, desc)]

        if tx_ids:
            db.query(Transaction).filter(Transaction.id.in_(tx_ids)).update(
                {
                    Transaction.category_id: None,
                    Transaction.category: None,
                    Transaction.category_source: "unknown",
                    Transaction.category_confidence: None,
                },
                synchronize_session=False,
            )

    db.delete(rule)
    db.commit()
    return {"ok": True}


@app.post("/category-rules/reorder", response_model=list[CategoryRuleOut])
def reorder_category_rules(
    payload: CategoryRuleReorder,
    user: User = Depends(auth_get_current_user),
    db: Session = Depends(get_db),
):

    rules = (
        db.query(CategoryRule)
        .filter(CategoryRule.user_id == user.id)
        .order_by(CategoryRule.priority.asc(), CategoryRule.id.asc())
        .all()
    )
    existing_ids = [r.id for r in rules]
    if set(existing_ids) != set(payload.rule_ids):
        raise HTTPException(status_code=400, detail="rule_ids must contain exactly all current rule ids")

    # nadajemy priorytety w równych krokach, stabilnie
    id_to_rule = {r.id: r for r in rules}
    for idx, rid in enumerate(payload.rule_ids):
        id_to_rule[rid].priority = (idx + 1) * 10

    db.commit()

    # zwróć w nowej kolejności
    out = (
        db.query(CategoryRule)
        .filter(CategoryRule.user_id == user.id)
        .order_by(CategoryRule.priority.asc(), CategoryRule.id.asc())
        .all()
    )
    return out



MIN_SIMILAR_FOR_SUGGESTION = 5  # od ilu podobnych transakcji warto proponować regułę


def build_rule_suggestion(db: Session, tx: Transaction) -> dict | None:
    """
    Buduje subtelną sugestię “automatyzacji podobnych”:
    - wybiera token-kotwicę z opisu (TF-IDF) w pełni automatycznie
    - liczy ile transakcji bez kategorii ma ten token
    - ignoruje telefony/ID dzięki normalizacji w tokenize()
    """
    # Sugestia ma sens tylko po nadaniu kategorii
    if tx.category_id is None:
        return None

    desc = (tx.description or "").strip()
    if not desc:
        return None

    # 1) zbierz opisy do DF (na Twoje rozmiary danych jest OK)
    all_desc = [
        d for (d,) in db.query(Transaction.description)
        .filter(Transaction.description.isnot(None))
        .all()
    ]
    df, n_docs = build_df(all_desc)
    if n_docs <= 1:
        return None

    # 2) token-kotwica dla tej transakcji
    key = best_key_token(desc, df, n_docs)
    if not key:
        return None

    # 3) jeśli token jest “za popularny” (np. występuje w połowie historii),
    # to zwykle jest mało użyteczny — nie proponujemy automatyzacji.
    ratio = df.get(key, 0) / max(1, n_docs)
    if ratio > 0.35:
        return None

    # 4) policz podobne wśród tych BEZ kategorii (żeby automatyzacja miała sens)
    uncategorized = db.query(Transaction.id, Transaction.description).filter(
        Transaction.category_id.is_(None)
    ).all()

    similar_count = 0
    for _, d in uncategorized:
        if d and description_contains_token(d, key):
            similar_count += 1

    # próg — ustawiony tak, żeby Żabka zadziałała praktycznie od razu
    if similar_count < 10:
        return None

    cat_name = None
    cat = db.get(Category, tx.category_id)
    if cat:
        cat_name = cat.name

    return {
        "pattern_type": "token",
        "pattern_value": key,
        "category_id": tx.category_id,
        "category_name": cat_name,
        "similar_count": similar_count,
    }




@app.put("/transactions/{tx_id}/category")
def update_transaction_category(
    tx_id: int,
    payload: CategoryUpdatePayload,
    db: Session = Depends(get_db),
):
    tx = db.get(Transaction, tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    old_cat_id = tx.category_id

    # ustawienie kategorii
    if payload.category_id is None:
        tx.category_id = None
        tx.category = None
        tx.category_source = "unknown"
        tx.category_confidence = None
    else:
        cat = db.get(Category, payload.category_id)
        if not cat:
            raise HTTPException(status_code=404, detail="Category not found")

        tx.category_id = cat.id
        tx.category = cat.name
        tx.category_source = "manual"
        tx.category_confidence = None

    # event z historii
    event = ClassificationEvent(
        transaction_id=tx.id,
        old_category_id=old_cat_id,
        new_category_id=tx.category_id,
        source="manual",
    )
    db.add(event)

    db.commit()
    db.refresh(tx)

    # spróbuj zbudować sugestię reguły (subtelny hint)
    rule_suggestion = build_rule_suggestion(db, tx)

    return {
        "id": tx.id,
        "account_id": tx.account_id,
        "operation_date": tx.operation_date,
        "value_date": tx.value_date,
        "description": tx.description,
        "amount": str(tx.amount),
        "category": tx.category,
        "category_id": tx.category_id,
        "category_source": tx.category_source,
        "category_confidence": tx.category_confidence,
        "is_manual": tx.is_manual,

        "rule_suggestion": rule_suggestion,
    }






@app.get("/category-rules", response_model=list[CategoryRuleOut])
def list_category_rules(
    user: User = Depends(auth_get_current_user), db: Session = Depends(get_db)
):

    rules = (
        db.query(CategoryRule)
        .filter(CategoryRule.user_id == user.id)
        .order_by(CategoryRule.priority.asc(), CategoryRule.id.asc())
        .all()
    )
    return rules


@app.post("/category-rules", response_model=CategoryRuleOut)
def create_category_rule(
    payload: CategoryRuleCreate,
    user: User = Depends(auth_get_current_user),
    db: Session = Depends(get_db),
):

    cat = db.get(Category, payload.category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    # --- ważne: dla "token" trzymamy w bazie JEDEN token, już znormalizowany ---
    pattern_value = payload.pattern_value or ""
    if payload.pattern_type == "token":
        toks = tokenize(pattern_value)
        pattern_value = toks[0] if toks else ""

    rule = CategoryRule(
        user_id=user.id,
        category_id=cat.id,
        field=payload.field,
        pattern_type=payload.pattern_type,
        pattern_value=pattern_value,
        priority=100,
        enabled=True,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule



@app.post("/category-rules/apply", response_model=ApplyRulesResult)
def apply_category_rules(
    user: User = Depends(auth_get_current_user), db: Session = Depends(get_db)
):

    assigned = apply_rules_for_user(db, user.id)
    return ApplyRulesResult(assigned=assigned)


@app.get("/lab/insights", response_model=LabInsightsOut)
def lab_insights(
    user: User = Depends(auth_get_current_user), db: Session = Depends(get_db)
):
    user_id = user.id

    # coverage
    total = (
        db.query(func.count(Transaction.id))
        .join(Account, Transaction.account_id == Account.id)
        .filter(Account.user_id == user_id)
        .scalar()
        or 0
    )
    categorized = (
        db.query(func.count(Transaction.id))
        .join(Account, Transaction.account_id == Account.id)
        .filter(Account.user_id == user_id, Transaction.category_id.isnot(None))
        .scalar()
        or 0
    )
    pct = (categorized / total * 100.0) if total else 0.0

    # sources
    manual_cnt = (
        db.query(func.count(Transaction.id))
        .join(Account, Transaction.account_id == Account.id)
        .filter(Account.user_id == user_id, Transaction.category_source == "manual")
        .scalar()
        or 0
    )
    rule_cnt = (
        db.query(func.count(Transaction.id))
        .join(Account, Transaction.account_id == Account.id)
        .filter(Account.user_id == user_id, Transaction.category_source == "rule")
        .scalar()
        or 0
    )

    # Zdarzenia manualne -> sugestie
    events = (
        db.query(ClassificationEvent, Transaction, Category)
        .join(Transaction, ClassificationEvent.transaction_id == Transaction.id)
        .join(Account, Transaction.account_id == Account.id)
        .join(Category, ClassificationEvent.new_category_id == Category.id)
        .filter(
            Account.user_id == user_id,
            ClassificationEvent.source == "manual",
            ClassificationEvent.new_category_id.isnot(None),
        )
        .order_by(ClassificationEvent.created_at.desc())
        .limit(2000)
        .all()
    )

    grouped: dict[tuple[str, int], dict] = {}

    for ev, tx, cat in events:
        pattern = extract_candidate_pattern(tx.description)
        if not pattern:
            continue

        key = (pattern, int(ev.new_category_id))
        if key not in grouped:
            grouped[key] = {
                "pattern_value": pattern,
                "pattern_type": "contains",
                "category_id": int(ev.new_category_id),
                "category_name": cat.name,
                "manual_occurrences": 0,
            }
        grouped[key]["manual_occurrences"] += 1

    # próg: tylko sensowne
    candidates = [v for v in grouped.values() if v["manual_occurrences"] >= 3]

    # nie pokazuj sugestii, jeśli reguła już istnieje
    def rule_exists(pattern_value: str, category_id: int) -> bool:
        q = db.query(CategoryRule.id).filter(
            CategoryRule.user_id == user_id,
            CategoryRule.field == "description",
            CategoryRule.pattern_type == "contains",
            CategoryRule.pattern_value == pattern_value,
            CategoryRule.category_id == category_id,
            CategoryRule.enabled == True,
        )
        return db.query(q.exists()).scalar() is True

    suggestions: list[LabSuggestionOut] = []
    for cand in candidates:
        if rule_exists(cand["pattern_value"], cand["category_id"]):
            continue

        # ile jest "do automatyzacji" (bez kategorii)
        pot = (
            db.query(func.count(Transaction.id))
            .join(Account, Transaction.account_id == Account.id)
            .filter(
                Account.user_id == user_id,
                Transaction.category_id.is_(None),
                func.lower(Transaction.description).contains(cand["pattern_value"]),
            )
            .scalar()
            or 0
        )
        if pot <= 0:
            continue

        suggestion_key = f'{cand["pattern_value"]}:{cand["category_id"]}'

        suggestions.append(
            LabSuggestionOut(
                suggestion_key=suggestion_key,
                pattern_value=cand["pattern_value"],
                pattern_type="contains",
                category_id=cand["category_id"],
                category_name=cand["category_name"],
                manual_occurrences=cand["manual_occurrences"],
                potential_matches=int(pot),
            )
        )

    suggestions.sort(key=lambda s: (s.potential_matches, s.manual_occurrences), reverse=True)
    suggestions = suggestions[:12]

    return LabInsightsOut(
        coverage_total=int(total),
        coverage_categorized=int(categorized),
        coverage_pct=float(round(pct, 2)),
        assignments_manual=int(manual_cnt),
        assignments_rule=int(rule_cnt),
        suggestions=suggestions,
    )


@app.post("/lab/enable-rule", response_model=EnableRuleResult)
def enable_rule(
    payload: EnableRulePayload,
    user: User = Depends(auth_get_current_user),
    db: Session = Depends(get_db),
):
    user_id = user.id

    cat = db.get(Category, payload.category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    pattern_value = normalize_text(payload.pattern_value)
    if not pattern_value:
        raise HTTPException(status_code=400, detail="pattern_value required")

    existing = (
        db.query(CategoryRule)
        .filter(
            CategoryRule.user_id == user_id,
            CategoryRule.field == "description",
            CategoryRule.pattern_type == payload.pattern_type,
            CategoryRule.pattern_value == pattern_value,
            CategoryRule.category_id == payload.category_id,
        )
        .first()
    )

    created = False
    if not existing:
        rule = CategoryRule(
            user_id=user_id,
            category_id=payload.category_id,
            field="description",
            pattern_type=payload.pattern_type,
            pattern_value=pattern_value,
            priority=100,
            enabled=True,
        )
        db.add(rule)
        db.commit()
        created = True

    applied = apply_rules_for_user(db, user_id)

    return EnableRuleResult(created=created, applied=int(applied or 0))

@app.get("/lab/overview")
def lab_overview(
    user: User = Depends(auth_get_current_user), db: Session = Depends(get_db)
):
    """
    Zwraca 'AI-ready' metryki dla zakładki Lab (bez technicznych detali).
    """
    total = (
        db.query(Transaction)
        .join(Account, Account.id == Transaction.account_id)
        .filter(Account.user_id == user.id)
        .count()
    )
    categorized = (
        db.query(Transaction)
        .join(Account, Account.id == Transaction.account_id)
        .filter(Account.user_id == user.id, Transaction.category_id.isnot(None))
        .count()
    )

    manual = (
        db.query(ClassificationEvent)
        .filter(ClassificationEvent.source == "manual")
        .join(Transaction, Transaction.id == ClassificationEvent.transaction_id)
        .join(Account, Account.id == Transaction.account_id)
        .filter(Account.user_id == user.id)
        .count()
    )
    rule = (
        db.query(ClassificationEvent)
        .filter(ClassificationEvent.source == "rule")
        .join(Transaction, Transaction.id == ClassificationEvent.transaction_id)
        .join(Account, Account.id == Transaction.account_id)
        .filter(Account.user_id == user.id)
        .count()
    )

    pct = round((categorized / total * 100.0), 2) if total else 0.0

    return {
        "coverage_total": total,
        "coverage_categorized": categorized,
        "coverage_pct": pct,
        "assignments_manual": manual,
        "assignments_rule": rule,
    }

@app.get("/category-rules")
def list_category_rules(
    user: User = Depends(auth_get_current_user), db: Session = Depends(get_db)
):

    rules = (
        db.query(CategoryRule, Category.name)
        .join(Category, Category.id == CategoryRule.category_id)
        .filter(CategoryRule.user_id == user.id)
        .order_by(CategoryRule.enabled.desc(), CategoryRule.priority.desc(), CategoryRule.id.desc())
        .all()
    )

    # UI-friendly payload
    out = []
    for rule, cat_name in rules:
        # “ile razy użyto” – na razie z eventów; później można zmaterializować
        used = (
            db.query(ClassificationEvent)
            .filter(ClassificationEvent.source == "rule")
            .join(Transaction, Transaction.id == ClassificationEvent.transaction_id)
            .filter(Transaction.category_id == rule.category_id)
            .count()
        )

        out.append({
            "id": rule.id,
            "enabled": rule.enabled,
            "priority": rule.priority,
            "field": rule.field,
            "pattern_type": rule.pattern_type,
            "pattern_value": rule.pattern_value,
            "category_id": rule.category_id,
            "category_name": cat_name,
            "used_count": used,
        })
    return out


@app.put("/category-rules/{rule_id}/toggle")
def toggle_category_rule(
    rule_id: int,
    user: User = Depends(auth_get_current_user),
    db: Session = Depends(get_db),
):

    rule = db.get(CategoryRule, rule_id)
    if not rule or rule.user_id != user.id:
        raise HTTPException(status_code=404, detail="Rule not found")

    rule.enabled = not rule.enabled
    db.commit()
    db.refresh(rule)

    return {"id": rule.id, "enabled": rule.enabled}



def ensure_default_categories(db: Session, user: User):
    """Tworzy parę podstawowych kategorii dla użytkownika, jeśli jeszcze nie istnieją."""
    existing = (
        db.query(Category)
        .filter(Category.user_id == user.id)
        .count()
    )
    if existing > 0:
        return

    base_cats = [
        ("Jedzenie", "#22c55e"),
        ("Transport", "#3b82f6"),
        ("Zakupy", "#a855f7"),
        ("Subskrypcje", "#f97316"),
        ("Inne", "#9ca3af"),
    ]
    for name, color in base_cats:
        db.add(
            Category(
                user_id=user.id,
                name=name,
                color=color,
                is_system=True,
            )
        )
    db.commit()


def normalize_text(s: str | None) -> str:
    """
    Normalizuje tekst do dopasowywania:
    - zamienia na małe litery
    - usuwa polskie znaki (ą→a, ł→l, ś→s itd.)
    - wycina znaki specjalne, zostawia cyfry, litery i spacje
    - redukuje wielokrotne spacje do jednej
    """
    if not s:
        return ""

    # lower-case
    s = s.lower()

    # rozbij na znaki + usuń znaki łączące (akcenty)
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))

    # wszystko poza literami, cyframi i spacją → spacja
    s = re.sub(r"[^0-9a-z\s]", " ", s)

    # redukcja wielu spacji
    s = re.sub(r"\s+", " ", s).strip()

    return s


STOP_TOKENS = {
    "pln", "ref", "zlec", "zlecenie", "transakcja", "platnosc",
    "karta", "przelew", "oplata", "opłata", "saldo", "data"
}

def extract_candidate_pattern(description: str | None) -> str | None:
    if not description:
        return None
    desc_norm = normalize_text(description)
    tokens = [t for t in desc_norm.split() if len(t) >= 4 and t not in STOP_TOKENS]
    if not tokens:
        return None
    return max(tokens, key=len)

def apply_rules_for_statement(db: Session, user_id: int, statement_id: int) -> int:
    """
    Stosuje reguły użytkownika TYLKO do transakcji należących do danego statementu,
    które są jeszcze bez kategorii / unknown i nie są manualne.

    Dzięki temu: po imporcie nowego miesiąca reguły działają od razu,
    bez mielnia całej historii.
    """
    rules = (
        db.query(CategoryRule)
        .filter(
            CategoryRule.user_id == user_id,
            CategoryRule.enabled == True,
        )
        .order_by(CategoryRule.priority.asc(), CategoryRule.id.asc())
        .all()
    )
    if not rules:
        return 0

    txs = (
        db.query(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .join(RawTransaction, Transaction.raw_transaction_id == RawTransaction.id)
        .filter(
            Account.user_id == user_id,
            RawTransaction.statement_id == statement_id,
            Transaction.is_manual == False,
            or_(
                Transaction.category_id.is_(None),
                Transaction.category_source.is_(None),
                Transaction.category_source == "unknown",
            ),
        )
        .all()
    )

    assigned = 0

    for tx in txs:
        text_norm = normalize_text(tx.description or "")

        old_cat_id = tx.category_id

        for rule in rules:
            if rule.field != "description":
                continue

            pattern_norm = normalize_text(rule.pattern_value or "")
            if not pattern_norm:
                continue

            ok = False
            if rule.pattern_type == "contains":
                ok = pattern_norm in text_norm

            elif rule.pattern_type == "startswith":
                ok = text_norm.startswith(pattern_norm)

            elif rule.pattern_type == "token":
                # pattern_value dla token to pojedynczy token (np. "zabka")
                toks = tokenize(rule.pattern_value or "")
                token = toks[0] if toks else None
                if token:
                    ok = description_contains_token(tx.description or "", token)

            else:
                continue

            if ok:
                cat = rule.category
                if not cat:
                    continue

                tx.category_id = cat.id
                tx.category = cat.name
                tx.category_source = "rule"
                tx.category_confidence = None

                db.add(
                    ClassificationEvent(
                        transaction_id=tx.id,
                        old_category_id=old_cat_id,
                        new_category_id=tx.category_id,
                        source="rule",
                    )
                )

                assigned += 1
                break

    db.commit()
    return assigned


from sqlalchemy import or_

def apply_rules_for_user(db: Session, user_id: int) -> int:
    rules = (
        db.query(CategoryRule)
        .filter(CategoryRule.user_id == user_id, CategoryRule.enabled == True)
        .order_by(CategoryRule.priority.asc(), CategoryRule.id.asc())
        .all()
    )
    if not rules:
        return 0

    txs = (
        db.query(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .filter(
            Account.user_id == user_id,
            or_(
                Transaction.category_id.is_(None),
                Transaction.category_source == "unknown",
            ),
        )
        .all()
    )

    assigned = 0

    for tx in txs:
        text_raw = tx.description or ""
        text_norm = normalize_text(text_raw)

        old_cat_id = tx.category_id

        for rule in rules:
            if rule.field != "description":
                continue

            # --- MATCH ---
            matched = False

            if rule.pattern_type == "token":
                # pattern_value to pojedynczy token z tokenize()
                if description_contains_token(text_raw, rule.pattern_value or ""):
                    matched = True
            else:
                pattern_norm = normalize_text(rule.pattern_value or "")
                if not pattern_norm:
                    continue

                if rule.pattern_type == "contains" and pattern_norm in text_norm:
                    matched = True
                elif rule.pattern_type == "startswith" and text_norm.startswith(pattern_norm):
                    matched = True
                elif rule.pattern_type == "equals" and text_norm == pattern_norm:
                    matched = True

            if not matched:
                continue

            # --- APPLY ---
            cat = db.get(Category, rule.category_id)
            if not cat:
                continue

            tx.category_id = cat.id
            tx.category = cat.name
            tx.category_source = "rule"
            tx.category_confidence = None

            db.add(
                ClassificationEvent(
                    transaction_id=tx.id,
                    old_category_id=old_cat_id,
                    new_category_id=tx.category_id,
                    source="rule",
                )
            )

            assigned += 1
            break

    db.commit()
    return assigned

