import csv
from io import StringIO
from datetime import datetime

def parse_csv_transactions(text: str):
    """
    Expect CSV with at least columns: date, amount
    Optional columns: category (or major_category/sub_category), major_category, sub_category, direction, description, account, type, remarks
    Date formats supported: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY
    """
    f = StringIO(text)
    reader = csv.DictReader(f)
    required = ["date", "amount"]
    out = []
    for i, row in enumerate(reader, start=1):
        if not all(col in row and (row[col] is not None and row[col].strip() != "") for col in required):
            raise ValueError(f"Row {i}: missing required columns {required}")
        date_str = row["date"].strip()
        parsed_date = None
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
            try:
                parsed_date = datetime.strptime(date_str, fmt).date()
                break
            except Exception:
                parsed_date = None
        if parsed_date is None:
            raise ValueError(f"Row {i}: invalid date '{date_str}'")
        amt_str = row["amount"].strip().replace(",", "")
        try:
            amount = float(amt_str)
        except Exception:
            raise ValueError(f"Row {i}: invalid amount '{row['amount']}'")

        # determine major/sub categories
        major = (row.get("major_category") or "").strip() or None
        sub = (row.get("sub_category") or "").strip() or None
        cat = (row.get("category") or "").strip() or None
        if not major and cat:
            if "/" in cat:
                parts = [p.strip() for p in cat.split("/", 1)]
                major = parts[0] or None
                sub = parts[1] or None
            else:
                major = cat or None

        direction = (row.get("direction") or row.get("type") or "").strip() or None
        description = (row.get("description") or "").strip() or None
        account = (row.get("account") or "").strip() or None
        remarks = (row.get("remarks") or row.get("note") or "").strip() or None

        # map direction into 'type' so the DB-model uses the existing 'type' column.
        tx_type = (row.get("type") or direction or "").strip() or None

        out.append({
            "date": parsed_date,
            "amount": amount,
            "category": cat or None,
            "major_category": major,
            "sub_category": sub,
            # do NOT include a standalone "direction" key (avoid unexpected kwargs)
            "type": tx_type,
            "description": description,
            "account": account,
            "remarks": remarks,
            "raw_source": None
        })
    return out
