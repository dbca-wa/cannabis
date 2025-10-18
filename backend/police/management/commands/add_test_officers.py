from django.core.management.base import BaseCommand
from police.models import PoliceOfficer, PoliceStation


class Command(BaseCommand):
    help = "Add test officers with unknown and other ranks for testing sorting"

    def handle(self, *args, **options):
        # Get some existing stations
        stations = list(PoliceStation.objects.all()[:3])

        if not stations:
            self.stdout.write(
                self.style.WARNING(
                    "No police stations found. Please create some stations first."
                )
            )
            return

        # Test officers with unknown/other ranks
        test_officers = [
            {
                "first_name": "John",
                "last_name": "Unknown",
                "badge_number": "UNK001",
                "rank": PoliceOfficer.SeniorityChoices.UNKNOWN,
                "station": stations[0] if stations else None,
            },
            {
                "first_name": "Jane",
                "last_name": "Other",
                "badge_number": "OTH001",
                "rank": PoliceOfficer.SeniorityChoices.OTHER,
                "station": stations[1] if len(stations) > 1 else stations[0],
            },
            {
                "first_name": "Bob",
                "last_name": "Mystery",
                "badge_number": "UNK002",
                "rank": PoliceOfficer.SeniorityChoices.UNKNOWN,
                "station": stations[2] if len(stations) > 2 else stations[0],
            },
            {
                "first_name": None,  # Test null first name
                "last_name": "DataIssue",
                "badge_number": "OTH002",
                "rank": PoliceOfficer.SeniorityChoices.OTHER,
                "station": None,  # Test null station
            },
        ]

        created_count = 0
        for officer_data in test_officers:
            # Check if officer already exists
            existing = PoliceOfficer.objects.filter(
                badge_number=officer_data["badge_number"]
            ).first()

            if not existing:
                officer = PoliceOfficer.objects.create(**officer_data)
                created_count += 1
                self.stdout.write(
                    f"Created officer: {officer.full_name} ({officer.get_rank_display()})"
                )
            else:
                self.stdout.write(
                    f"Officer with badge {officer_data['badge_number']} already exists"
                )

        self.stdout.write(
            self.style.SUCCESS(f"Successfully created {created_count} test officers")
        )
