from sqlmodel import Session, select
from .models import engine, Transaction, FixedExpense
from typing import List, Optional, Dict, Any, Union
from collections import defaultdict
from datetime import date, datetime
import calendar

def get_session():
    with Session(engine) as session:
        yield session


# Completed CRUD helpers for Transaction

def create_transactions(transactions: List[Union[Dict[str, Any], Transaction]]) -> List[Transaction]:
    """
    Accepts a list of Transaction instances or dicts and persists them.
    Returns the created Transaction instances (refreshed).
    """
    objs: List[Transaction] = []
    for tx in transactions:
        # If tx is a dict, map/pop 'direction' into 'type' so constructors don't receive unexpected args.
        if isinstance(tx, dict):
            if "direction" in tx:
                if not tx.get("type"):
                    tx["type"] = tx.pop("direction")
                else:
                    tx.pop("direction", None)
            objs.append(Transaction(**tx))
        else:
            objs.append(tx)

    with Session(engine) as session:
        for o in objs:
            session.add(o)
        session.commit()
        for o in objs:
            session.refresh(o)
    return objs


# wrapper expected by main.py
def create_transactions_bulk(transactions: List[Dict[str, Any]]) -> List[Transaction]:
    return create_transactions(transactions)


def get_transactions() -> List[Transaction]:
    """Return all transactions."""
    with Session(engine) as session:
        return session.exec(select(Transaction)).all()


# alias expected by main.py
def list_transactions() -> List[Transaction]:
    return get_transactions()


def get_transaction(transaction_id: int) -> Optional[Transaction]:
    """Return a single transaction by id or None if not found."""
    with Session(engine) as session:
        return session.get(Transaction, transaction_id)


def update_transaction(transaction_id: int, patch: Dict[str, Any]) -> Optional[Transaction]:
    """
    Apply a patch (dict of fields) to a transaction.
    Returns the updated Transaction or None if not found.
    """
    with Session(engine) as session:
        tx = session.get(Transaction, transaction_id)
        if not tx:
            return None
        for k, v in patch.items():
            if hasattr(tx, k):
                setattr(tx, k, v)
        session.add(tx)
        session.commit()
        session.refresh(tx)
        return tx


def delete_transaction(transaction_id: int) -> bool:
    """Delete a transaction by id. Returns True if deleted, False if not found."""
    with Session(engine) as session:
        tx = session.get(Transaction, transaction_id)
        if not tx:
            return False
        session.delete(tx)
        session.commit()
        return True


def create_fixed_expense(data: Dict[str, Any]) -> FixedExpense:
    fe = FixedExpense(**data)
    with Session(engine) as session:
        session.add(fe)
        session.commit()
        session.refresh(fe)
    return fe


def list_fixed_expenses() -> List[FixedExpense]:
    with Session(engine) as session:
        return session.exec(select(FixedExpense)).all()


def _iter_months(start: date, end: date):
    # yield (year, month) inclusive
    ym_start = start.year * 12 + start.month - 1
    ym_end = end.year * 12 + end.month - 1
    for ym in range(ym_start, ym_end + 1):
        y = ym // 12
        m = ym % 12 + 1
        yield y, m


def get_summary(start: Optional[date] = None, end: Optional[date] = None) -> Dict[str, Any]:
    """
    Return summary: total amount and totals by major -> sub categories.
    If start/end provided, include transactions and generated fixed expenses occurrences within that range.
    """
    with Session(engine) as session:
        q = select(Transaction)
        all_tx = session.exec(q).all()
        fixed_list = session.exec(select(FixedExpense).where(FixedExpense.active == True)).all()

    # determine default start/end if None: use range of transactions or current month
    if start is None or end is None:
        dates = [t.date for t in all_tx if getattr(t, "date", None) is not None]
        if dates:
            min_d = min(dates)
            max_d = max(dates)
        else:
            today = date.today()
            min_d = date(today.year, today.month, 1)
            last_day = calendar.monthrange(today.year, today.month)[1]
            max_d = date(today.year, today.month, last_day)
        if start is None:
            start = min_d
        if end is None:
            end = max_d

    totals = {"total": 0.0, "by_major": {}}
    # accumulate
    major_acc: Dict[str, float] = defaultdict(float)
    major_sub_acc: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
    total = 0.0

    # include transactions
    for t in all_tx:
        if t.date is None:
            continue
        if t.date < start or t.date > end:
            continue
        amt = float(t.amount)
        total += amt
        major = t.major_category or t.category or "uncategorized"
        sub = t.sub_category or "unspecified"
        major_acc[major] += amt
        major_sub_acc[major][sub] += amt

    # include fixed expenses occurrences
    for fe in fixed_list:
        # compute effective period intersection
        fe_start = fe.start_date or start
        fe_end = fe.end_date or end
        # intersection with requested range
        s = max(start, fe_start)
        e = min(end, fe_end)
        if s > e:
            continue
        for y, m in _iter_months(s, e):
            last_day = calendar.monthrange(y, m)[1]
            day = min(fe.day_of_month, last_day)
            occ = date(y, m, day)
            if occ < s or occ > e:
                continue
            amt = float(fe.amount)
            total += amt
            major = fe.major_category or "fixed"
            sub = fe.sub_category or "fixed"
            major_acc[major] += amt
            major_sub_acc[major][sub] += amt

    totals["total"] = total
    # build nested structure
    by_major = {}
    for major, mtotal in major_acc.items():
        subs = {sub: major_sub_acc[major][sub] for sub in major_sub_acc[major]}
        by_major[major] = {"total": mtotal, "sub_categories": subs}
    totals["by_major"] = by_major
    return totals
