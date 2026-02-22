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


class SavingsAndSettingsTests(CrudDBTestCase):
    def test_create_saving_requires_kind(self):
        with self.assertRaisesRegex(ValueError, "Missing required field: kind"):
            crud.create_saving({"name": "비상금"})

    def test_forecast_savings_monthly_and_withdrawn_cases(self):
        crud.create_saving(
            {
                "name": "정기적금",
                "kind": "적금",
                "initial_balance": 1000,
                "contribution_amount": 100,
                "start_date": "2026-01-10",
                "end_date": "2026-12-31",
                "day_of_month": 10,
                "frequency": "monthly",
                "withdrawn": False,
            }
        )
        crud.create_saving(
            {
                "name": "해지계좌",
                "kind": "예금",
                "initial_balance": 5000,
                "contribution_amount": 300,
                "start_date": "2026-01-01",
                "withdrawn": True,
            }
        )

        result = crud.forecast_savings(date(2026, 3, 15))
        by_name = {item["name"]: item for item in result["items"]}

        self.assertEqual(by_name["정기적금"]["predicted_balance"], 1300.0)
        self.assertEqual(by_name["해지계좌"]["predicted_balance"], 0.0)
        self.assertEqual(result["total"], 1300.0)

    def test_forecast_respects_end_date(self):
        crud.create_saving(
            {
                "name": "기간제",
                "kind": "적금",
                "initial_balance": 0,
                "contribution_amount": 50,
                "start_date": "2026-01-05",
                "end_date": "2026-02-20",
                "day_of_month": 5,
                "frequency": "monthly",
            }
        )

        result = crud.forecast_savings(date(2026, 4, 1))
        item = result["items"][0]
        self.assertEqual(item["predicted_balance"], 100.0)

    def test_setting_categories_replace_and_get_sorted_unique(self):
        crud.set_setting_categories(
            majors=["식비", "교통", "식비", "주거"],
            subs=["점심", "버스", "점심", "월세"],
        )
        cats = crud.get_setting_categories()
        self.assertEqual(cats["majors"], ["교통", "식비", "주거"])
        self.assertEqual(cats["subs"], ["버스", "월세", "점심"])

        crud.set_setting_categories(majors=["의료"], subs=["약국"])
        replaced = crud.get_setting_categories()
        self.assertEqual(replaced["majors"], ["의료"])
        self.assertEqual(replaced["subs"], ["약국"])


if __name__ == "__main__":
    unittest.main()
