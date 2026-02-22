import unittest

from app import models, models_core


class ModelsExportTests(unittest.TestCase):
    def test_models_module_reexports_models_core_symbols(self):
        self.assertIs(models.engine, models_core.engine)
        self.assertIs(models.Transaction, models_core.Transaction)
        self.assertIs(models.FixedExpense, models_core.FixedExpense)
        self.assertIs(models.Saving, models_core.Saving)
        self.assertIs(models.CategoryMajor, models_core.CategoryMajor)
        self.assertIs(models.CategorySub, models_core.CategorySub)
        self.assertIs(models.create_db_and_tables, models_core.create_db_and_tables)


if __name__ == "__main__":
    unittest.main()
