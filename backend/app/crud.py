from sqlmodel import Session, select
from .models_core import engine, Transaction, FixedExpense, Saving, CategoryMajor, CategorySub
from typing import List, Optional, Dict, Any, Union, Tuple
from collections import defaultdict
from datetime import date, datetime
import calendar
import logging
from sqlalchemy import func

def get_session():
    with Session(engine) as session:
        yield session


# Completed CRUD helpers for Transaction

def _normalize_tx_dict(tx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize incoming dict so it can be passed to Transaction constructor.
    - Map legacy 'type' -> 'direction' (SQLModel uses direction -> DB column "type")
    - Coerce date strings to datetime.date
    - Coerce amount strings to float
    - Normalize direction/type to English canonical values: "Income" or "Expense"
    - Raise ValueError on invalid date/amount so caller can handle/report
    """
    tx_copy = dict(tx)

    # Normalize type/direction: prefer explicit 'direction' field; else map 'type' -> 'direction'
    if "direction" in tx_copy and tx_copy["direction"] is not None:
        tx_copy.pop("type", None)
        raw_dir = tx_copy.get("direction")
    else:
        raw_dir = tx_copy.pop("type", tx_copy.get("direction", None))
        if raw_dir is not None:
            tx_copy["direction"] = raw_dir

    # Normalize direction value to canonical English labels
    def _canon_direction(v: Any) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip().lower()
        if not s:
            return None
        if "income" in s or "수입" in s:
            return "Income"
        if "expense" in s or "지출" in s:
            return "Expense"
        # fallback: use title-cased token (helpful for 'inc'/'exp' or 'INCOME')
        return s.capitalize()

    if "direction" in tx_copy:
        tx_copy["direction"] = _canon_direction(tx_copy.get("direction"))

    # remove stray 'type' key to avoid unexpected kwargs
    tx_copy.pop("type", None)

    # Coerce date strings -> datetime.date
    d = tx_copy.get("date")
    if isinstance(d, str):
        s = d.strip()
        parsed = None
        # try common formats
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d/%m/%Y", "%m/%d/%Y"):
            try:
                parsed = datetime.strptime(s, fmt).date()
                break
            except Exception:
                continue
        if parsed is None:
            # try ISO parser as a last resort
            try:
                parsed = datetime.fromisoformat(s).date()
            except Exception:
                raise ValueError(f"Invalid date format: '{d}'")
        tx_copy["date"] = parsed

    # Coerce amount to float (accept strings with commas)
    amt = tx_copy.get("amount")
    if isinstance(amt, str):
        s = amt.strip().replace(",", "")
        try:
            tx_copy["amount"] = float(s)
        except Exception:
            raise ValueError(f"Invalid amount: '{amt}'")

    # If amount is int, convert to float (consistent type)
    if isinstance(tx_copy.get("amount"), int):
        tx_copy["amount"] = float(tx_copy["amount"])

    return tx_copy

def _coerce_date(val, name: str = "date") -> Optional[date]:
    """Convert strings/datetimes to datetime.date. Return None if val is None."""
    if val is None:
        return None
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, str):
        s = val.strip()
        if not s:
            return None
        # try common formats
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d/%m/%Y", "%m/%d/%Y"):
            try:
                return datetime.strptime(s, fmt).date()
            except Exception:
                continue
        # try ISO
        try:
            return datetime.fromisoformat(s).date()
        except Exception:
            raise ValueError(f"Invalid {name} format: '{val}'")
    # unsupported type
    raise ValueError(f"Invalid {name} type: {type(val)}")

def create_transactions(transactions: List[Union[Dict[str, Any], Transaction]]) -> List[Transaction]:
    """
    Accepts a list of Transaction instances or dicts and persists them.
    Returns the created Transaction instances (refreshed).
    """
    objs: List[Transaction] = []
    for tx in transactions:
        if isinstance(tx, dict):
            objs.append(Transaction(**_normalize_tx_dict(tx)))
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
    Patch values are normalized (dates, amounts, direction) before applying.
    """
    # normalize patch in-place (but do not require all fields)
    try:
        normalized_patch = _normalize_tx_dict(dict(patch))
    except ValueError as ve:
        # bubble up to caller to convert to HTTP error handler
        raise

    with Session(engine) as session:
        tx = session.get(Transaction, transaction_id)
        if not tx:
            return None
        for k, v in normalized_patch.items():
            # map direction -> attribute name on model
            if k == "direction":
                setattr(tx, "direction", v)
                continue
            # ignore unknown fields that SQLModel doesn't have
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
    """
    Create FixedExpense and generate Transaction occurrences for each month in the range.
    Expects required fields: major_category, sub_category, amount, start_date, end_date, day_of_month
    Generated transactions get raw_source="fixed:{fixed_id}" so they can be removed later.
    """
    # validate required
    req = ["major_category", "sub_category", "amount", "start_date", "end_date", "day_of_month"]
    for k in req:
        if k not in data or data[k] in (None, ""):
            raise ValueError(f"Missing required field: {k}")

    # coerce types
    try:
        start = _coerce_date(data["start_date"], "start_date")
        end = _coerce_date(data["end_date"], "end_date")
    except ValueError:
        raise

    try:
        amt = float(data["amount"])
    except Exception:
        raise ValueError(f"Invalid amount: {data.get('amount')}")
    try:
        dom = int(data["day_of_month"])
    except Exception:
        raise ValueError(f"Invalid day_of_month: {data.get('day_of_month')}")

    fe = FixedExpense(
        major_category=data["major_category"],
        sub_category=data["sub_category"],
        description=data.get("description"),
        amount=amt,
        start_date=start,
        end_date=end,
        day_of_month=dom,
        active=data.get("active", True)
    )

    occurrences: List[Transaction] = []
    with Session(engine) as session:
        session.add(fe)
        session.commit()
        session.refresh(fe)

        # generate transactions for each month in range
        s = fe.start_date
        e = fe.end_date
        for y, m in _iter_months(s, e):
            last_day = calendar.monthrange(y, m)[1]
            day = min(fe.day_of_month, last_day)
            occ_date = date(y, m, day)
            # create transaction linked to fixed expense
            tx = Transaction(
                date=occ_date,
                amount=float(fe.amount),
                direction="Expense",
                major_category=fe.major_category,
                sub_category=fe.sub_category,
                description=fe.description,
                raw_source=f"fixed:{fe.id}"
            )
            session.add(tx)
            occurrences.append(tx)
        session.commit()
        for t in occurrences:
            session.refresh(t)
    return fe

def delete_fixed_expense(fe_id: int) -> bool:
    """
    Delete FixedExpense and all generated Transaction occurrences that reference it.
    Returns True if deleted, False if not found.
    """
    with Session(engine) as session:
        fe = session.get(FixedExpense, fe_id)
        if not fe:
            return False
        # delete generated transactions
        pattern = f"fixed:{fe_id}"
        # use .raw_source field match
        stmt = select(Transaction).where(Transaction.raw_source == pattern)
        generated = session.exec(stmt).all()
        for g in generated:
            session.delete(g)
        session.delete(fe)
        session.commit()
    return True

def update_fixed_expense(fe_id: int, patch: Dict[str, Any]) -> Optional[FixedExpense]:
    """
    Update FixedExpense. For simplicity, if update succeeds we delete previously generated transactions
    for this fixed expense and re-generate occurrences based on the new/current values.
    """
    with Session(engine) as session:
        fe = session.get(FixedExpense, fe_id)
        if not fe:
            return None
        # apply patch fields (coerce dates/numbers where appropriate)
        for k, v in patch.items():
            if not hasattr(fe, k):
                continue
            if k in ("start_date", "end_date"):
                v = _coerce_date(v, k)
            if k == "amount":
                try:
                    v = float(v)
                except Exception:
                    raise ValueError(f"Invalid amount: {patch.get('amount')}")
            if k == "day_of_month":
                try:
                    v = int(v)
                except Exception:
                    raise ValueError(f"Invalid day_of_month: {patch.get('day_of_month')}")
            setattr(fe, k, v)
        session.add(fe)
        session.commit()
        session.refresh(fe)

        # remove previously generated transactions
        pattern = f"fixed:{fe_id}"
        stmt = select(Transaction).where(Transaction.raw_source == pattern)
        prev = session.exec(stmt).all()
        for p in prev:
            session.delete(p)
        session.commit()

        # re-generate occurrences
        occurrences: List[Transaction] = []
        s = fe.start_date
        e = fe.end_date
        for y, m in _iter_months(s, e):
            last_day = calendar.monthrange(y, m)[1]
            day = min(fe.day_of_month, last_day)
            occ_date = date(y, m, day)
            tx = Transaction(
                date=occ_date,
                amount=float(fe.amount),
                direction="Expense",
                major_category=fe.major_category,
                sub_category=fe.sub_category,
                description=fe.description,
                raw_source=f"fixed:{fe.id}"
            )
            session.add(tx)
            occurrences.append(tx)
        session.commit()
        for t in occurrences:
            session.refresh(t)
        return fe

def list_fixed_expenses() -> List[FixedExpense]:
    with Session(engine) as session:
        return session.exec(select(FixedExpense)).all()

def get_fixed_expense(fe_id: int) -> Optional[FixedExpense]:
    with Session(engine) as session:
        return session.get(FixedExpense, fe_id)


def _iter_months(start: date, end: date):
    # yield (year, month) inclusive
    ym_start = start.year * 12 + start.month - 1
    ym_end = end.year * 12 + end.month - 1
    for ym in range(ym_start, ym_end + 1):
        y = ym // 12
        m = ym % 12 + 1
        yield y, m


def _compute_default_range(all_tx: List[Transaction]) -> Tuple[date, date]:
    if all_tx:
        dates = [t.date for t in all_tx if getattr(t, "date", None) is not None]
        if dates:
            return (min(dates), max(dates))
    today = date.today()
    start = date(today.year, today.month, 1)
    last_day = calendar.monthrange(today.year, today.month)[1]
    end = date(today.year, today.month, last_day)
    return (start, end)

def get_summary(start: Optional[date] = None, end: Optional[date] = None) -> Dict[str, Any]:
    """
    Return summary: total amount and totals by major -> sub categories.
      Optimized: avoid loading entire table. If start/end missing, query min/max(date) from DB.
    """
    # determine default range using DB min/max if needed
    with Session(engine) as session:
        # result shape may vary by SQLAlchemy version (Row/tuple); handle safely
        minmax_res = session.exec(select(func.min(Transaction.date), func.max(Transaction.date)))
        min_max = minmax_res.first()
        if not min_max:
            db_min, db_max = None, None
        else:
            # min_max might be an int/str/date tuple-like or a scalar-like value
            if isinstance(min_max, (list, tuple)):
                db_min, db_max = min_max[0], min_max[1]
            else:
                # single scalar (rare for two-col select) — try indexing, otherwise set to None
                try:
                    db_min, db_max = min_max[0], min_max[1]
                except Exception:
                    db_min, db_max = None, None

    if start is None or end is None:
        if db_min is not None and db_max is not None:
            default_start, default_end = db_min, db_max
        else:
            today = date.today()
            default_start = date(today.year, today.month, 1)
            last_day = calendar.monthrange(today.year, today.month)[1]
            default_end = date(today.year, today.month, last_day)
        if start is None:
            start = default_start
        if end is None:
            end = default_end

    totals = {"total": 0.0, "by_major": {}}
    major_acc: Dict[str, float] = defaultdict(float)
    major_sub_acc: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
    total = 0.0

    # load only transactions within [start, end] (reduces memory for large DB)
    with Session(engine) as session:
        stmt = select(Transaction).where(Transaction.date >= start).where(Transaction.date <= end)
        txs = session.exec(stmt).all()

    for t in txs:
        if t.date is None:
            continue
        amt = float(t.amount or 0)
        total += amt
        major = t.major_category or t.category or "uncategorized"
        sub = t.sub_category or "unspecified"
        major_acc[major] += amt
        major_sub_acc[major][sub] += amt

    # include fixed expenses occurrences (same as before)
    with Session(engine) as session:
        fixed_list = session.exec(select(FixedExpense).where(FixedExpense.active == True)).all()

    for fe in fixed_list:
        fe_start = fe.start_date or start
        fe_end = fe.end_date or end
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
    by_major = {}
    for major, mtotal in major_acc.items():
        subs = {sub: major_sub_acc[major][sub] for sub in major_sub_acc[major]}
        by_major[major] = {"total": mtotal, "sub_categories": subs}
    totals["by_major"] = by_major
    return totals

def query_transactions(start: Optional[date] = None,
                       end: Optional[date] = None,
                       tx_type: Optional[str] = None,
                       search: Optional[str] = None,
                       page: int = 1,
                       per_page: int = 100) -> Tuple[List[Transaction], int]:
    """
    Return (items, total_count) filtered by optional start/end (inclusive),
    tx_type (substring match), search (searches major/sub/description/category),
    with DB-side pagination (LIMIT/OFFSET) and efficient count.
    """
    with Session(engine) as session:
        stmt = select(Transaction)
        if start:
            stmt = stmt.where(Transaction.date >= start)
        if end:
            stmt = stmt.where(Transaction.date <= end)
        if tx_type:
            stmt = stmt.where(Transaction.direction.ilike(f"%{tx_type}%"))
        if search:
            q = f"%{search}%"
            stmt = stmt.where(
                (Transaction.major_category.ilike(q)) |
                (Transaction.sub_category.ilike(q)) |
                (Transaction.description.ilike(q)) |
                (Transaction.category.ilike(q))
            )

        # compute total count efficiently (remove ordering)
        count_subq = stmt.order_by(None).subquery()
        # execute count; result shape may be int or a row/tuple depending on SQLAlchemy
        count_exec = session.exec(select(func.count()).select_from(count_subq))
        count_val = None
        try:
            # prefer .one() if available
            count_val = count_exec.one()
        except Exception:
            try:
                count_val = count_exec.first()
            except Exception:
                count_val = None

        if count_val is None:
            total = 0
        elif isinstance(count_val, int):
            total = int(count_val)
        elif isinstance(count_val, (list, tuple)):
            total = int(count_val[0] or 0)
        else:
            # Row-like object: try indexing or mapping
            try:
                total = int(count_val[0])
            except Exception:
                try:
                    # Row._mapping -> dict-like
                    total = int(next(iter(count_val)) or 0)
                except Exception:
                    total = 0

        # apply ordering + limit/offset for page
        stmt = stmt.order_by(Transaction.date.desc())
        offset = max((page - 1) * per_page, 0)
        stmt = stmt.offset(offset).limit(per_page)
        page_items = session.exec(stmt).all()
        return page_items, int(total)

def get_categories() -> Dict[str, List[str]]:
    """
    Return categories mapping: { "majors": [...], "subs": { major: [sub1, ...] } }
    """
    with Session(engine) as session:
        stmt = select(Transaction.major_category, Transaction.sub_category)
        results = session.exec(stmt).all()
    majors = set()
    subs_map: Dict[str, set] = {}
    for major, sub in results:
        if major:
            majors.add(major)
            subs_map.setdefault(major, set())
            if sub:
                subs_map[major].add(sub)
    return {
        "majors": sorted(list(majors)),
        "subs": {k: sorted(list(v)) for k, v in subs_map.items()}
    }


# --- Savings (Saving) helpers ---
def create_saving(data: Dict[str, Any]) -> Saving:
    """
    Create a saving entry. Fields:
    - kind (required), contribution_amount (per period), initial_balance (optional),
      start_date/end_date (optional), day_of_month (optional), withdrawn (optional)
    """
    if "kind" not in data or data["kind"] in (None, ""):
        raise ValueError("Missing required field: kind")
    # coerce dates and numbers
    try:
        start = _coerce_date(data.get("start_date"), "start_date")
        end = _coerce_date(data.get("end_date"), "end_date")
    except ValueError:
        raise
    try:
        init_bal = float(data.get("initial_balance", 0.0))
    except Exception:
        raise ValueError(f"Invalid initial_balance: {data.get('initial_balance')}")
    try:
        contrib = float(data.get("contribution_amount", 0.0))
    except Exception:
        raise ValueError(f"Invalid contribution_amount: {data.get('contribution_amount')}")
    dom = data.get("day_of_month")
    if dom is not None and dom != "":
        try:
            dom = int(dom)
        except Exception:
            raise ValueError(f"Invalid day_of_month: {dom}")

    s = Saving(
        name=data.get("name"),
        kind=data["kind"],
        initial_balance=init_bal,
        contribution_amount=contrib,
        start_date=start,
        end_date=end,
        day_of_month=dom,
        frequency=data.get("frequency", "monthly"),
        withdrawn=bool(data.get("withdrawn", False)),
        active=bool(data.get("active", True))
    )
    with Session(engine) as session:
        session.add(s)
        session.commit()
        session.refresh(s)
    return s

def list_savings() -> List[Saving]:
    with Session(engine) as session:
        return session.exec(select(Saving)).all()

def get_saving(sid: int) -> Optional[Saving]:
    with Session(engine) as session:
        return session.get(Saving, sid)

def update_saving(sid: int, patch: Dict[str, Any]) -> Optional[Saving]:
    with Session(engine) as session:
        s = session.get(Saving, sid)
        if not s:
            return None
        for k, v in patch.items():
            if not hasattr(s, k):
                continue
            if k in ("start_date", "end_date"):
                v = _coerce_date(v, k)
            if k in ("initial_balance", "contribution_amount"):
                try:
                    v = float(v)
                except Exception:
                    raise ValueError(f"Invalid numeric value for {k}: {patch.get(k)}")
            if k == "day_of_month" and v is not None and v != "":
                try:
                    v = int(v)
                except Exception:
                    raise ValueError(f"Invalid day_of_month: {patch.get('day_of_month')}")
            setattr(s, k, v)
        session.add(s)
        session.commit()
        session.refresh(s)
        return s

def delete_saving(sid: int) -> bool:
    with Session(engine) as session:
        s = session.get(Saving, sid)
        if not s:
            return False
        session.delete(s)
        session.commit()
        return True

def forecast_savings(on_date: date) -> Dict[str, Any]:
    """
    For each active, not-withdrawn saving, compute predicted balance up to 'on_date':
    balance = initial_balance + sum(contributions on each scheduled date <= on_date)
    Only supports monthly frequency (frequency == 'monthly') and day_of_month scheduling.
    Returns { "date": ISO, "total": x, "items": [ {saving fields..., predicted_balance} ] }
    """
    with Session(engine) as session:
        savings = session.exec(select(Saving).where(Saving.active == True)).all()

    total = 0.0
    items = []
    for s in savings:
        if s.withdrawn:
            predicted = 0.0
        else:
            predicted = float(s.initial_balance or 0.0)
            # contributions
            if s.contribution_amount and s.start_date:
                # contribution dates from start_date until min(end_date or on_date, on_date)
                contrib_end = min(s.end_date, on_date) if s.end_date else on_date
                if contrib_end >= s.start_date:
                    # iterate months
                    for y, m in _iter_months(s.start_date, contrib_end):
                        if s.frequency != "monthly":
                            continue  # only monthly supported for now
                        last_day = calendar.monthrange(y, m)[1]
                        if s.day_of_month:
                            day = min(s.day_of_month, last_day)
                        else:
                            day = min(s.start_date.day, last_day)
                        occ = date(y, m, day)
                        if occ <= on_date and occ >= s.start_date and (not s.end_date or occ <= s.end_date):
                            predicted += float(s.contribution_amount)
        total += predicted
        items.append({
            "id": s.id,
            "name": s.name,
            "kind": s.kind,
            "predicted_balance": predicted,
            "initial_balance": s.initial_balance,
            "contribution_amount": s.contribution_amount,
        })
    return {"date": on_date.isoformat(), "total": total, "items": items}

def get_setting_categories() -> Dict[str, List[str]]:
    """Return persisted major and sub lists from dedicated tables."""
    with Session(engine) as session:
        majors = session.exec(select(CategoryMajor.name)).all()
        subs = session.exec(select(CategorySub.name)).all()
    # session.exec(select(...)) returns list of tuples/values; normalize to simple list
    majors_list = [m for m in majors] if majors else []
    subs_list = [s for s in subs] if subs else []
    return {"majors": sorted(list(dict.fromkeys(majors_list))), "subs": sorted(list(dict.fromkeys(subs_list)))}

def set_setting_categories(majors: List[str], subs: List[str]) -> None:
    """
    Replace persisted majors/subs with provided lists.
    This implementation deletes existing rows and inserts new ones.
    """
    with Session(engine) as session:
        # delete all existing rows
        existing_majors = session.exec(select(CategoryMajor)).all()
        for em in existing_majors:
            session.delete(em)
        existing_subs = session.exec(select(CategorySub)).all()
        for es in existing_subs:
            session.delete(es)
        session.commit()

        # insert new majors
        for m in (majors or []):
            name = (m or "").strip()
            if not name:
                continue
            session.add(CategoryMajor(name=name))
        # insert new subs
        for s in (subs or []):
            name = (s or "").strip()
            if not name:
                continue
            session.add(CategorySub(name=name))
        session.commit()
