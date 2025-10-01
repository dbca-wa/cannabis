"""
Test Rank Mapping

Test the rank mapping logic to ensure problematic ranks are handled correctly.
"""

from django.core.management.base import BaseCommand
from .etl_modules.data_preprocessor import DataPreprocessor


class Command(BaseCommand):
    help = "Test rank mapping logic for problematic ranks"

    def handle(self, *args, **options):
        """Test rank mapping"""
        self.stdout.write(self.style.SUCCESS("Testing rank mapping logic..."))

        preprocessor = DataPreprocessor()

        # Test problematic ranks from the cannabis data
        test_ranks = [
            "Sworn Officer Shane",
            "Sworn Officer ZOE",
            "Conveying Officer Senior Constable Shane",
            "Sworn Officer First Class Constable",
            "Senior Constable",
            "Detective",
            "Cattanach",
            "Senior",
            "First",
            "I/C",
            "SP/C",
            "SP/PC",
            "Sworn Brett",
            "Sworn Shane",
            "Sworn officer Shane",
            "Chemist",
        ]

        self.stdout.write("Rank mapping results:")
        for rank in test_ranks:
            mapped = preprocessor._map_rank_to_seniority(rank)
            self.stdout.write(f'  "{rank}" -> {mapped}')

        self.stdout.write(self.style.SUCCESS("Rank mapping test completed!"))
