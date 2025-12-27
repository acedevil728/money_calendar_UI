from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Query
from sqlmodel import Session
from datetime import datetime, date
from typing import Optional
from .models import create_db_and_tables
from .crud import get_session, create_transactions_bulk, list_transactions, get_summary, create_fixed_expense, list_fixed_expenses
from .utils.csv_parser import parse_csv_transactions

app = FastAPI(title="Money Calendar - Backend")


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


@app.post("/api/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files supported")
    content = await file.read()
    try:
        transactions = parse_csv_transactions(content.decode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    created = create_transactions_bulk(transactions)
    return {"created": len(created)}


@app.get("/api/transactions")
def api_list_transactions():
    return list_transactions()


@app.get("/api/summary")
def api_summary(start: Optional[str] = Query(None, description="YYYY-MM-DD"), end: Optional[str] = Query(None, description="YYYY-MM-DD")):
    """
    Optional start/end to limit summary. Format: YYYY-MM-DD
    Fixed expenses are automatically included if their occurrence falls within range.
    """
    s = datetime.strptime(start, "%Y-%m-%d").date() if start else None
    e = datetime.strptime(end, "%Y-%m-%d").date() if end else None
    return get_summary(start=s, end=e)


@app.post("/api/fixed-expenses")
def api_create_fixed_expense(payload: dict):
    fe = create_fixed_expense(payload)
    return fe


@app.get("/api/fixed-expenses")
def api_list_fixed_expenses():
    return list_fixed_expenses()
