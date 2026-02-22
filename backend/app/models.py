"""
Compatibility exports for legacy imports.

Source of truth for models/engine is app.models_core.
"""

from .models_core import (
    DATA_DIR,
    DB_FILE,
    DATABASE_URL,
    engine,
    TransactionBase,
    Transaction,
    FixedExpense,
    Saving,
    CategoryMajor,
    CategorySub,
    create_db_and_tables,
)

__all__ = [
    "DATA_DIR",
    "DB_FILE",
    "DATABASE_URL",
    "engine",
    "TransactionBase",
    "Transaction",
    "FixedExpense",
    "Saving",
    "CategoryMajor",
    "CategorySub",
    "create_db_and_tables",
]
