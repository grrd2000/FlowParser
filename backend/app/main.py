from __future__ import annotations

import os
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Query
from sqlalchemy import text, select
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
)

from app.utils.pko_pdf_parser import parse_pko_statement
from app.utils.data_types_parser import parse_date_str, parse_decimal_str


UPLOAD_DIR = "uploads"

app = FastAPI(title="flowparser (prototype, refactored)")


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

def ensure_default_user_and_account():
    """Tworzy przykładowego użytkownika i konto, jeśli jeszcze nie istnieją."""
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(email="demo@example.com").first()
        if not user:
            user = User(email="demo@example.com", full_name="Demo User")
            db.add(user)
            db.flush()  # żeby mieć user.id

        account = (
            db.query(Account)
            .filter_by(user_id=user.id, name="Główne konto")
            .first()
        )
        if not account:
            account = Account(
                user_id=user.id,
                name="Główne konto",
                institution="PKO BP",
                currency="PLN",
                account_type="checking",
            )
            db.add(account)

        db.commit()
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    # Tworzymy wszystkie tabele według modeli
    Base.metadata.create_all(bind=engine)

    # Na potrzeby dev: jeden user i jedno konto startowe
    ensure_default_user_and_account()

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


# -----------------------
#  Accounts – minimalne API
# -----------------------

@app.get("/accounts")
def list_accounts(db: Session = Depends(get_db)):
    """Lista kont w systemie (na razie wszystkie, bez auth)."""
    accounts = db.execute(select(Account)).scalars().all()
    return [
        {
            "id": a.id,
            "user_id": a.user_id,
            "name": a.name,
            "institution": a.institution,
            "currency": a.currency,
            "account_type": a.account_type,
            "external_id": a.external_id,
        }
        for a in accounts
    ]


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

@app.post("/accounts/{account_id}/import-pdf")
async def import_pdf_for_account(
    account_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    1) Zapisuje PDF do /uploads
    2) Tworzy Statement + ImportRun
    3) Parsuje PDF -> DataFrame (surowy tekst)
    4) KROK 1: Zapisuje tylko RawTransactions (tekst)
    5) KROK 2: Z RawTransactions próbuje utworzyć Transactions (z konwersją typów w Pythonie)
    """

    account = db.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # --- zapis pliku ---
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)

    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        f.write(await file.read())

    # --- Statement ---
    statement = Statement(
        account_id=account.id,
        file_name=file.filename,
        storage_path=file_path,
        source_type="PKO_PDF",
    )
    print(statement)
    db.add(statement)
    db.flush()  # mamy statement.id

    # --- ImportRun (start) ---
    run = ImportRun(
        statement_id=statement.id,
        status="processing",
    )
    print(run)
    db.add(run)
    db.flush()  # mamy run.id

    total_rows = 0
    imported_rows = 0
    error_rows = 0

    try:
        # 1) Parsowanie PDF Twoim parserem – tu dostajemy DF z TEKSTAMI
        df = parse_pko_statement(file_path)
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

        # 2) KROK 1: zapis wszystkiego do RawTransactions (TYLKO TEKST)
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
                parsed_ok=True,       # na razie zakładamy OK – poprawimy w kroku 2
                error_message=None,
            )
            db.add(raw)

        db.commit()  # RAW zapisane niezależnie od dalszych problemów

        # 3) KROK 2: ETL z RawTransactions -> Transactions (konwersja w Pythonie)
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
                # Błąd parsowania / konwersji – NIE ma transakcji, ale raw zostaje z flagą błędu
                raw.parsed_ok = False
                raw.error_message = str(e)
                error_rows += 1

        # zapisujemy efekty kroku 2
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
        run.status = "failed"
        run.message = str(e)
        run.finished_at = datetime.now(timezone.utc)
        db.add(run)
        db.commit()
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
