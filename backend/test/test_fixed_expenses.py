import tempfile
import unittest
from datetime import date

from sqlmodel import SQLModel, Session, create_engine, select

from app import crud
from app.models_core import FixedExpense, Transaction


class CrudDBTestCase(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self._engine = create_engine(
            f"sqlite:///{self._tmpdir.name}/unit_test.db",
            echo=False,
            connect_args={"check_same_thread": False},
        )
        SQLModel.metadata.create_all(self._engine)
        self._old_engine = crud.engine
        crud.engine = self._engine

    def tearDown(self):
        crud.engine = self._old_engine
        self._tmpdir.cleanup()


class FixedExpenseCrudTests(CrudDBTestCase):
    def test_create_fixed_expense_generates_monthly_transactions(self):
        crud.create_fixed_expense(
            {
                "major_category": "주거",
                "sub_category": "월세",
                "description": "오피스텔",
                "amount": 650000,
                "start_date": "2026-01-01",
                "end_date": "2026-03-31",
                "day_of_month": 31,
            }
        )

        with Session(self._engine) as session:
            fixed = session.exec(select(FixedExpense)).first()

        self.assertIsNotNone(fixed)
        fixed_id = fixed.id

        with Session(self._engine) as session:
            txs = session.exec(
                select(Transaction).where(Transaction.raw_source == f"fixed:{fixed_id}")
            ).all()

        self.assertEqual(len(txs), 3)
        self.assertEqual(
            [t.date for t in txs],
            [date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31)],
        )
        self.assertTrue(all(t.direction == "Expense" for t in txs))

    def test_update_fixed_expense_regenerates_transactions(self):
        crud.create_fixed_expense(
            {
                "major_category": "주거",
                "sub_category": "관리비",
                "amount": 100000,
                "start_date": "2026-01-01",
                "end_date": "2026-03-31",
                "day_of_month": 10,
            }
        )
        with Session(self._engine) as session:
            fixed = session.exec(select(FixedExpense)).first()
        fixed_id = fixed.id

        updated = crud.update_fixed_expense(
            fixed_id,
            {
                "amount": 120000,
                "day_of_month": 15,
                "end_date": "2026-02-28",
            },
        )

        self.assertIsNotNone(updated)
        with Session(self._engine) as session:
            updated_row = session.get(FixedExpense, fixed_id)
        self.assertEqual(updated_row.amount, 120000.0)
        self.assertEqual(updated_row.day_of_month, 15)

        with Session(self._engine) as session:
            txs = session.exec(
                select(Transaction).where(Transaction.raw_source == f"fixed:{fixed_id}")
            ).all()

        self.assertEqual(len(txs), 2)
        self.assertEqual([t.date for t in txs], [date(2026, 1, 15), date(2026, 2, 15)])
        self.assertTrue(all(t.amount == 120000.0 for t in txs))

    def test_delete_fixed_expense_removes_generated_transactions(self):
        crud.create_fixed_expense(
            {
                "major_category": "보험",
                "sub_category": "실손",
                "amount": 50000,
                "start_date": "2026-01-01",
                "end_date": "2026-02-28",
                "day_of_month": 20,
            }
        )
        with Session(self._engine) as session:
            fixed = session.exec(select(FixedExpense)).first()
        fixed_id = fixed.id

        self.assertTrue(crud.delete_fixed_expense(fixed_id))
        self.assertFalse(crud.delete_fixed_expense(fixed_id))

        with Session(self._engine) as session:
            remaining_fixed = session.get(FixedExpense, fixed_id)
            txs = session.exec(
                select(Transaction).where(Transaction.raw_source == f"fixed:{fixed_id}")
            ).all()

        self.assertIsNone(remaining_fixed)
        self.assertEqual(txs, [])


if __name__ == "__main__":
    unittest.main()
