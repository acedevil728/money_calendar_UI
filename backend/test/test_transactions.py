import tempfile
import unittest
from datetime import date

from sqlmodel import SQLModel, create_engine

from app import crud


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


class TransactionCrudTests(CrudDBTestCase):
    def test_normalize_transaction_dict_maps_type_and_parses_fields(self):
        normalized = crud._normalize_tx_dict(
            {
                "date": "2026-02-01",
                "type": "수입",
                "amount": "1,234",
                "major_category": "월급",
            }
        )

        self.assertEqual(normalized["direction"], "Income")
        self.assertEqual(normalized["amount"], 1234.0)
        self.assertEqual(normalized["date"], date(2026, 2, 1))
        self.assertNotIn("type", normalized)

    def test_normalize_transaction_dict_raises_for_invalid_date(self):
        with self.assertRaisesRegex(ValueError, "Invalid date format"):
            crud._normalize_tx_dict({"date": "2026-99-99", "amount": "1000", "type": "수입"})

    def test_transactions_crud_and_query_filters(self):
        created = crud.create_transactions_bulk(
            [
                {
                    "date": "2026-01-10",
                    "type": "수입",
                    "major_category": "급여",
                    "sub_category": "본봉",
                    "amount": "3000000",
                    "description": "1월 급여",
                },
                {
                    "date": "2026-01-15",
                    "type": "지출",
                    "major_category": "식비",
                    "sub_category": "점심",
                    "amount": "12000",
                    "description": "회사 근처 식당",
                },
            ]
        )
        self.assertEqual(len(created), 2)

        items, total = crud.query_transactions(
            start=date(2026, 1, 1),
            end=date(2026, 1, 31),
            tx_type="expense",
            search="식당",
            page=1,
            per_page=20,
        )
        self.assertEqual(total, 1)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].major_category, "식비")

        target = items[0]
        updated = crud.update_transaction(
            target.id,
            {
                "amount": "20000",
                "type": "지출",
                "description": "업데이트된 내역",
                "unknown_field": "ignored",
            },
        )
        self.assertIsNotNone(updated)
        self.assertEqual(updated.amount, 20000.0)
        self.assertEqual(updated.direction, "Expense")
        self.assertEqual(updated.description, "업데이트된 내역")

        self.assertTrue(crud.delete_transaction(target.id))
        self.assertFalse(crud.delete_transaction(target.id))

    def test_get_categories_returns_major_sub_map(self):
        crud.create_transactions_bulk(
            [
                {
                    "date": "2026-01-01",
                    "type": "지출",
                    "major_category": "식비",
                    "sub_category": "아침",
                    "amount": 5000,
                },
                {
                    "date": "2026-01-02",
                    "type": "지출",
                    "major_category": "식비",
                    "sub_category": "점심",
                    "amount": 9000,
                },
                {
                    "date": "2026-01-03",
                    "type": "수입",
                    "major_category": "급여",
                    "sub_category": "본봉",
                    "amount": 3000000,
                },
            ]
        )

        categories = crud.get_categories()
        self.assertEqual(categories["majors"], ["급여", "식비"])
        self.assertEqual(categories["subs"]["식비"], ["아침", "점심"])
        self.assertEqual(categories["subs"]["급여"], ["본봉"])


if __name__ == "__main__":
    unittest.main()
