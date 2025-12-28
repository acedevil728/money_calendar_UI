from sqlmodel import SQLModel, Field, create_engine
from typing import Optional
from datetime import date
import os
from sqlalchemy import Column, String
import logging

# data directory and DB file
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
DB_FILE = os.path.join(DATA_DIR, "app.db")
DATABASE_URL = f"sqlite:///{DB_FILE}"

# create_engine with check_same_thread False for SQLite in dev container
engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})


class TransactionBase(SQLModel):
    date: date
    amount: float
    # 대분류 / 중분류
    major_category: Optional[str] = None
    sub_category: Optional[str] = None
    category: Optional[str] = None  # legacy mapping
    description: Optional[str] = None  # 상세 내역
    account: Optional[str] = None
    remarks: Optional[str] = None
    raw_source: Optional[str] = None


class Transaction(TransactionBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    # Persisted column: attribute 'direction' maps to DB column named "type"
    direction: Optional[str] = Field(default=None, sa_column=Column("type", String, nullable=True))

    # python-level alias so existing code referencing .type still works
    @property
    def type(self) -> Optional[str]:
        return self.direction

    @type.setter
    def type(self, value: Optional[str]) -> None:
        self.direction = value


class FixedExpense(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    amount: float
    major_category: Optional[str] = None
    sub_category: Optional[str] = None
    description: Optional[str] = None
    remarks: Optional[str] = None
    # day of month when this fixed expense occurs (1-31). If day > days in month, use last day.
    day_of_month: int = 1
    # optional active period
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    active: bool = True


def _ensure_data_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)

def _ensure_columns(engine, table: str, cols: dict) -> None:
    from sqlalchemy import text
    with engine.begin() as conn:
        res = conn.exec_driver_sql(f"PRAGMA table_info('{table}')").fetchall()
        existing = [r[1] for r in res]
        for col, col_type in cols.items():
            if col not in existing:
                try:
                    conn.exec_driver_sql(f'ALTER TABLE "{table}" ADD COLUMN "{col}" {col_type}')
                except Exception:
                    logging.exception("Failed to add column %s to %s", col, table)
                    # continue attempting others

def create_db_and_tables() -> None:
    """Ensure data directory exists and create DB tables."""
    _ensure_data_dir(DATA_DIR)
    SQLModel.metadata.create_all(engine)

    expected_tx_cols = {
        "major_category": "TEXT",
        "sub_category": "TEXT",
        "category": "TEXT",
        "description": "TEXT",
        "account": "TEXT",
        "remarks": "TEXT",
        "raw_source": "TEXT",
        "type": "TEXT"
    }

    try:
        _ensure_columns(engine, "transaction", expected_tx_cols)
    except Exception:
        # startup tolerant: 실패시 로깅만 하고 계속 진행
        logging.exception("create_db_and_tables: _ensure_columns failed")
