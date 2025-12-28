from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, PlainTextResponse
from sqlmodel import Session
from datetime import datetime, date
from typing import Optional, List
from .models import create_db_and_tables
from .crud import get_session, create_transactions_bulk, list_transactions, get_summary, create_fixed_expense, list_fixed_expenses, query_transactions, get_transaction, get_categories, get_transactions, update_transaction, delete_transaction
import logging
import csv

app = FastAPI(title="Money Calendar - Backend")


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


def _parse_date_param(s: Optional[str], name: str) -> Optional[date]:
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid {name} format. Expected YYYY-MM-DD")


@app.get("/api/transactions")
def api_transactions(start: Optional[str] = Query(None), end: Optional[str] = Query(None),
                     type: Optional[str] = Query(None), search: Optional[str] = Query(None),
                     page: int = Query(1, ge=1), per_page: int = Query(100, ge=1, le=1000)):
    """
    DB-first transaction listing with optional filters:
    start/end: YYYY-MM-DD inclusive
    type: substring match
    search: substring search in category/major/sub/description
    pagination: page (1-based) and per_page
    """
    parsed_start = _parse_date_param(start, "start") if start else None
    parsed_end = _parse_date_param(end, "end") if end else None

    try:
        items, total = query_transactions(parsed_start, parsed_end, type, search, page, per_page)
        # convert SQLModel instances to dicts (safe for JSON)
        out = []
        for t in items:
            out.append({
                "id": getattr(t, "id", None),
                "date": getattr(t, "date", None).isoformat() if getattr(t, "date", None) else None,
                "type": getattr(t, "direction", None),
                "major_category": getattr(t, "major_category", None),
                "sub_category": getattr(t, "sub_category", None),
                "amount": getattr(t, "amount", None),
                "description": getattr(t, "description", None),
            })
        return {"items": out, "total": total, "page": page, "per_page": per_page}
    except Exception as e:
        logging.exception("api_transactions error")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/transactions", status_code=201)
async def api_transactions_create(payload: List[dict]):
    """
    Accept single object or array of transactions in the request body.
    Example body: [{...}, {...}] or {...}
    """
    # normalize single-object body
    if not isinstance(payload, list):
        # type: ignore
        payload = [payload]  # type: ignore
    try:
        created = create_transactions_bulk(payload)
    except Exception as e:
        logging.exception("create_transactions_bulk failed")
        raise HTTPException(status_code=500, detail="failed to persist transactions")
    # return created count and ids minimally
    out = [{"id": getattr(t, "id", None), "date": t.date.isoformat() if t.date else None, "amount": t.amount} for t in created]
    return {"created": len(out), "items": out}


@app.get("/api/transactions/{txn_id}")
def api_transaction_get(txn_id: int):
    tx = get_transaction(txn_id)
    if not tx:
        raise HTTPException(status_code=404, detail="not found")
    return {
        "id": tx.id,
        "date": tx.date.isoformat() if tx.date else None,
        "type": tx.direction,
        "major_category": tx.major_category,
        "sub_category": tx.sub_category,
        "amount": tx.amount,
        "description": tx.description,
    }


@app.put("/api/transactions/{txn_id}")
def api_transaction_put(txn_id: int, payload: dict):
    tx = get_transaction(txn_id)
    if not tx:
        raise HTTPException(status_code=404, detail="not found")
    updated = update_transaction(txn_id, payload)
    if not updated:
        raise HTTPException(status_code=500, detail="update failed")
    return {"ok": True}


@app.patch("/api/transactions/{txn_id}")
def api_transaction_patch(txn_id: int, payload: dict):
    tx = get_transaction(txn_id)
    if not tx:
        raise HTTPException(status_code=404, detail="not found")
    updated = update_transaction(txn_id, payload)
    if not updated:
        raise HTTPException(status_code=500, detail="update failed")
    return {"ok": True}


@app.delete("/api/transactions/{txn_id}", status_code=204)
def api_transaction_delete(txn_id: int):
    success = delete_transaction(txn_id)
    if not success:
        raise HTTPException(status_code=404, detail="not found")
    return PlainTextResponse(status_code=204, content="")


@app.get("/api/summary")
def api_summary(start: Optional[str] = Query(None), end: Optional[str] = Query(None)):
    s = _parse_date_param(start, "start") if start else None
    e = _parse_date_param(end, "end") if end else None
    try:
        result = get_summary(s, e)
        return result
    except Exception:
        logging.exception("get_summary failed")
        raise HTTPException(status_code=500, detail="summary error")


@app.get("/api/daily")
def api_daily(start: Optional[str] = Query(None), end: Optional[str] = Query(None)):
    s = _parse_date_param(start, "start") if start else None
    e = _parse_date_param(end, "end") if end else None
    # reuse query_transactions to obtain matching txns (no pagination)
    items, _ = query_transactions(s, e, None, None, page=1, per_page=10000)
    # group by date
    out = {}
    for t in items:
        key = t.date.isoformat()
        if key not in out:
            out[key] = {"date": key, "income": 0.0, "expense": 0.0, "transactions": []}
        amt = float(t.amount or 0)
        is_income = (t.direction or "").lower().find("income") >= 0 or (t.direction == "수입")
        if is_income:
            out[key]["income"] += amt
        else:
            out[key]["expense"] += amt
        out[key]["transactions"].append({
            "id": t.id, "date": key, "type": t.direction, "major_category": t.major_category,
            "sub_category": t.sub_category, "amount": t.amount, "description": t.description
        })
    # return as list sorted desc
    entries = sorted(out.values(), key=lambda x: x["date"], reverse=True)
    return entries


@app.get("/api/calendar")
def api_calendar(year: Optional[int] = Query(None), month: Optional[int] = Query(None)):
    """
    Return a mapping of days for the given year/month. If not specified, use current month.
    Response: { "year": YYYY, "month": MM, "days": { "YYYY-MM-DD": { income, expense, count } } }
    """
    today = date.today()
    y = year or today.year
    m = month or today.month
    # compute start/end for month
    import calendar as _cal
    last = _cal.monthrange(y, m)[1]
    start = date(y, m, 1)
    end = date(y, m, last)
    items, _ = query_transactions(start, end, None, None, page=1, per_page=10000)
    days = {}
    for t in items:
        key = t.date.isoformat()
        if key not in days:
            days[key] = {"income": 0.0, "expense": 0.0, "count": 0}
        amt = float(t.amount or 0)
        is_income = (t.direction or "").lower().find("income") >= 0 or (t.direction == "수입")
        if is_income:
            days[key]["income"] += amt
        else:
            days[key]["expense"] += amt
        days[key]["count"] += 1
    return {"year": y, "month": m, "days": days}


@app.get("/api/transactions/export")
def api_transactions_export(start: Optional[str] = Query(None), end: Optional[str] = Query(None), kind: Optional[str] = Query("summary")):
    """
    Export CSV of either 'summary' or raw 'transactions' within optional start/end.
    """
    s = _parse_date_param(start, "start") if start else None
    e = _parse_date_param(end, "end") if end else None
    items, _ = query_transactions(s, e, None, None, page=1, per_page=1000000)

    import io
    output = io.StringIO()
    writer = csv.writer(output)
    if kind == "transactions":
        writer.writerow(["id", "date", "type", "major_category", "sub_category", "amount", "description"])
        for t in items:
            writer.writerow([t.id, t.date.isoformat() if t.date else "", t.direction, t.major_category, t.sub_category, t.amount, t.description or ""])
    else:
        # summary: type,major,sub,amount
        summary_map = {}
        for t in items:
            type_key = (t.direction or "unknown").lower()
            major = t.major_category or "(No major)"
            sub = t.sub_category or "(No sub)"
            summary_map.setdefault(type_key, {})
            summary_map[type_key].setdefault(major, {})
            summary_map[type_key][major][sub] = summary_map[type_key][major].get(sub, 0) + float(t.amount or 0)
        writer.writerow(["type", "major", "sub", "amount"])
        for tk in summary_map:
            for mj in summary_map[tk]:
                for sb in summary_map[tk][mj]:
                    writer.writerow([tk, mj, sb, summary_map[tk][mj][sb]])

    output.seek(0)
    return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="export_{start or "all"}_{end or "all"}.csv"'})


@app.get("/api/categories")
def api_categories():
    try:
        return get_categories()
    except Exception:
        logging.exception("get_categories failed")
        raise HTTPException(status_code=500, detail="categories error")


@app.get("/health")
def health():
    return {"status": "ok"}

# CSV upload / file-reading endpoints removed. Data ingestion should go through /api/transactions (POST) or DB migrations/import tools.
