# backend/app/main.py

import os
from fastapi import FastAPI, Depends, Query, UploadFile, File, HTTPException
from sqlalchemy import text, select
from sqlalchemy.orm import Session
from datetime import date

from app.db import engine, SessionLocal
from app.models import Base, Entry, EtlRun, OdsOperation
from app.schemas import EntryIn, EntryOut

from app.etl.parser_pdf import parse_wordpdf_table
from app.etl.ods_loader import load_ods_from_df


UPLOAD_DIR = "uploads"


app = FastAPI(title="prototype", version="0.1.0")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        conn.execute(text('ALTER TABLE entries ADD COLUMN IF NOT EXISTS category VARCHAR(64);'))
        conn.commit()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/db/health")
def db_health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"db_status": "ok"}


@app.post("/entries", response_model=EntryOut, status_code=201)
def create_entry(payload: EntryIn, db: Session = Depends(get_db)):
    """
    Dodaje nowy wpis do tabeli `entries`.
    - Walidacja wejścia (EntryIn) robi się automatycznie przez Pydantic.
    - Tworzymy obiekt ORM i zapisujemy w transakcji.
    """
    entry = Entry(
        booking_date=payload.booking_date,
        description=payload.description,
        amount=payload.amount,
        category=payload.category,
    )
    db.add(entry)
    db.commit()    
    db.refresh(entry) 
    return entry

@app.get("/entries", response_model=list[EntryOut])
def list_entries(
    category: str | None = None,
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    sort: str | None = Query("date_desc", pattern="^(date_asc|date_desc)$"),
    db: Session = Depends(get_db),
):
    """
    Zwraca listę wpisów.
    - ?category=jedzenie (opcjonalny filtr po kategorii)
    - ?from=YYYY-MM-DD & ?to=YYYY-MM-DD (opcjonalne filtry daty, włącznie)
    """
    stmt = select(Entry).order_by(Entry.id.desc())

    if category:
        stmt = stmt.where(Entry.category == category)

    if date_from:
        stmt = stmt.where(Entry.booking_date >= date_from)
    if date_to:
        stmt = stmt.where(Entry.booking_date <= date_to)

    if sort == "date_asc":
        stmt = stmt.order_by(Entry.booking_date.asc())
    else:
        stmt = stmt.order_by(Entry.booking_date.desc())

    results = db.execute(stmt).scalars().all()
    return results


from app.etl.parser import parse_bank_statement
from app.etl.loader import load_entries_from_df

@app.post("/etl/import")
def import_bank_statement(db: Session = Depends(get_db)):
    """
    Prosty testowy ETL:
    - parsuje przykładowy 'PDF' (na razie dane symulowane)
    - zapisuje rekordy do bazy
    """
    df = parse_bank_statement("mock.pdf")  # ścieżka testowa
    load_entries_from_df(df, db)
    return {"imported": len(df)}


@app.post("/etl/upload")
async def upload_file_only(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    1) Zapisuje plik PDF do katalogu /uploads
    2) Dodaje rekord logu ETL z status=uploaded
    3) Nie uruchamia parsowania (zrobimy to osobnym krokiem)
    """
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)

    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        f.write(await file.read())

    # log ETL
    run = EtlRun(file_name=file.filename, imported_rows=0, status="uploaded")
    db.add(run)
    db.commit()

    return {"filename": file.filename, 
            "saved_to": file_path, 
            "status": "uploaded"}

@app.post("/etl/process/{filename}")
def process_pdf(filename: str, db: Session = Depends(get_db)):
    """
    1) Wczytuje wskazany PDF z /uploads
    2) Parsuje tabelę (Word→PDF) do DataFrame
    3) Zapisuje surowe rekordy do ODS (ods_operations)
    """
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Plik nie istnieje w /uploads")

    try:
        df = parse_wordpdf_table(file_path)
        inserted = load_ods_from_df(df, db, source_file=filename)
        return {"filename": filename, "rows_parsed": len(df), "rows_inserted": inserted}
    except Exception as e:
        # w realu: log.error(...)
        raise HTTPException(status_code=400, detail=f"Parsowanie nie powiodło się: {e}")

@app.get("/ods")
def list_ods(limit: int = 50, db: Session = Depends(get_db)):
    rows = (
        db.query(OdsOperation)
          .order_by(OdsOperation.id.desc())
          .limit(limit)
          .all()
    )
    return [
        {
            "id": r.id,
            "operation_date": r.operation_date,
            "value_date": r.value_date,
            "operation_id": r.operation_id,
            "description": r.description,
            "op_type": r.op_type,
            "amount": str(r.amount),
            "balance": str(r.balance),
            "source_file": r.source_file,
            "ingested_at": r.ingested_at,
        }
        for r in rows
    ]


@app.delete("/dev/entries/clear")
def clear_entries(db: Session = Depends(get_db)):
    deleted = db.query(Entry).delete()
    db.commit()
    return {"deleted_rows": deleted}

@app.delete("/dev/ods/clear")
def clear_ods(db: Session = Depends(get_db)):
    deleted = db.query(OdsOperation).delete()
    db.commit()
    return {"deleted_rows": deleted}


@app.get("/etl/runs")
def list_etl_runs(db: Session = Depends(get_db)):
    runs = db.query(EtlRun).order_by(EtlRun.id.desc()).all()
    return [
        {
            "id": r.id,
            "file_name": r.file_name,
            "imported_rows": r.imported_rows,
            "status": r.status,
            "started_at": r.started_at,
        }
        for r in runs
    ]

