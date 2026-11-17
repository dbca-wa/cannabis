"""Import of the historical certificates exported from the old Access database.

``etl/run_transform.py`` turns the Access table into certificate-level JSON.
``LegacyImporter`` here persists that JSON as legacy cases, forms, bags and
assessments, and ``rollback`` removes exactly what an import created.
"""
