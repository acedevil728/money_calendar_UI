import unittest

from app.utils.csv_parser import parse_csv_transactions


class CsvParserTests(unittest.TestCase):
    def test_parse_csv_transactions_parses_required_and_optional_fields(self):
        text = """date,amount,category,type,description
2026-01-01,"12,000",식비/점심,지출,구내식당
2026-01-02,3000000,급여/본봉,수입,1월 급여
"""

        rows = parse_csv_transactions(text)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["amount"], 12000.0)
        self.assertEqual(rows[0]["major_category"], "식비")
        self.assertEqual(rows[0]["sub_category"], "점심")
        self.assertEqual(rows[1]["type"], "수입")

    def test_parse_csv_transactions_raises_when_required_field_missing(self):
        bad_text = """date,amount,category
,1000,식비/점심
"""
        with self.assertRaisesRegex(ValueError, "missing required columns"):
            parse_csv_transactions(bad_text)


if __name__ == "__main__":
    unittest.main()
