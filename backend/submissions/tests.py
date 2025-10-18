from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone
from datetime import timedelta

from .models import Submission, SubmissionPhaseHistory
from police.models import PoliceOfficer, PoliceStation
from defendants.models import Defendant

User = get_user_model()


class SubmissionSendBackTestCase(TestCase):
    """Test cases for submission send-back functionality"""

    def setUp(self):
        """Set up test data"""
        self.client = APIClient()

        # Create users with different roles
        self.admin_user = User.objects.create_user(
            email="admin@test.com",
            password="testpass123",
            first_name="Admin",
            last_name="User",
            is_superuser=True,
            is_staff=True,
        )

        self.finance_user = User.objects.create_user(
            email="finance@test.com",
            password="testpass123",
            first_name="Finance",
            last_name="Officer",
            role="finance",
        )

        self.botanist_user = User.objects.create_user(
            email="botanist@test.com",
            password="testpass123",
            first_name="Botanist",
            last_name="User",
            role="botanist",
        )

        self.regular_user = User.objects.create_user(
            email="regular@test.com",
            password="testpass123",
            first_name="Regular",
            last_name="User",
            role="none",
        )

        # Create police station and officer
        self.station = PoliceStation.objects.create(
            name="Test Station", address="123 Test St"
        )

        self.officer = PoliceOfficer.objects.create(
            first_name="Test",
            last_name="Officer",
            badge_number="12345",
            station=self.station,
        )

        # Create a test submission
        self.submission = Submission.objects.create(
            case_number="TEST-001",
            received=timezone.now(),
            security_movement_envelope="ENV-001",
            requesting_officer=self.officer,
            phase=Submission.PhaseChoices.FINANCE_APPROVAL,
        )

    def test_send_back_requires_authentication(self):
        """Test that send-back requires authentication"""
        url = f"/api/v1/submissions/{self.submission.id}/send-back/"
        data = {"target_phase": "data_entry", "reason": "Missing information"}

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_send_back_requires_target_phase(self):
        """Test that target_phase is required"""
        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/send-back/"
        data = {"reason": "Missing information"}

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("target_phase is required", response.data["error"])

    def test_send_back_requires_reason(self):
        """Test that reason is required"""
        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/send-back/"
        data = {"target_phase": "data_entry"}

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reason is required", response.data["error"])

    def test_send_back_invalid_target_phase(self):
        """Test that invalid target phase is rejected"""
        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/send-back/"
        data = {"target_phase": "invalid_phase", "reason": "Test reason"}

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid target phase", response.data["error"])

    def test_finance_officer_can_send_back_from_finance_approval(self):
        """Test that finance officer can send back from finance approval to data entry"""
        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/send-back/"
        data = {"target_phase": "data_entry", "reason": "Missing defendant information"}

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["new_phase"], "data_entry")
        self.assertEqual(response.data["reason"], "Missing defendant information")

        # Verify submission phase was updated
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.phase, Submission.PhaseChoices.DATA_ENTRY)

        # Verify phase history was created
        history = SubmissionPhaseHistory.objects.filter(
            submission=self.submission
        ).first()
        self.assertIsNotNone(history)
        self.assertEqual(history.from_phase, Submission.PhaseChoices.FINANCE_APPROVAL)
        self.assertEqual(history.to_phase, Submission.PhaseChoices.DATA_ENTRY)
        self.assertEqual(history.action, "send_back")
        self.assertEqual(history.user, self.finance_user)
        self.assertEqual(history.reason, "Missing defendant information")

    def test_botanist_can_send_back_from_botanist_review(self):
        """Test that botanist can send back from botanist review"""
        self.submission.phase = Submission.PhaseChoices.BOTANIST_REVIEW
        self.submission.save()

        self.client.force_authenticate(user=self.botanist_user)
        url = f"/api/v1/submissions/{self.submission.id}/send-back/"
        data = {
            "target_phase": "finance_approval",
            "reason": "Need finance approval review",
        }

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["new_phase"], "finance_approval")

        # Verify submission phase was updated
        self.submission.refresh_from_db()
        self.assertEqual(
            self.submission.phase, Submission.PhaseChoices.FINANCE_APPROVAL
        )

    def test_botanist_can_send_back_to_data_entry(self):
        """Test that botanist can send back to data entry from botanist review"""
        self.submission.phase = Submission.PhaseChoices.BOTANIST_REVIEW
        self.submission.save()

        self.client.force_authenticate(user=self.botanist_user)
        url = f"/api/v1/submissions/{self.submission.id}/send-back/"
        data = {"target_phase": "data_entry", "reason": "Missing case information"}

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["new_phase"], "data_entry")

    def test_cannot_send_back_to_later_phase(self):
        """Test that cannot send back to a later phase"""
        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/send-back/"
        data = {
            "target_phase": "botanist_review",
            "reason": "Invalid forward movement",
        }

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # The error message will be about allowed targets since permission check happens first
        self.assertIn("Can only send back to", response.data["error"])

    def test_wrong_role_cannot_send_back(self):
        """Test that user with wrong role cannot send back"""
        self.client.force_authenticate(user=self.botanist_user)
        url = f"/api/v1/submissions/{self.submission.id}/send-back/"
        data = {"target_phase": "data_entry", "reason": "Test reason"}

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Only finance", response.data["error"])

    def test_regular_user_cannot_send_back(self):
        """Test that regular user without role cannot send back"""
        self.client.force_authenticate(user=self.regular_user)
        url = f"/api/v1/submissions/{self.submission.id}/send-back/"
        data = {"target_phase": "data_entry", "reason": "Test reason"}

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cannot_send_back_from_data_entry(self):
        """Test that cannot send back from data entry phase"""
        self.submission.phase = Submission.PhaseChoices.DATA_ENTRY
        self.submission.save()

        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/send-back/"
        data = {"target_phase": "data_entry", "reason": "Test reason"}

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Cannot send back", response.data["error"])

    def test_admin_can_send_back_from_any_phase(self):
        """Test that admin can send back from any phase"""
        self.submission.phase = Submission.PhaseChoices.COMPLETE
        self.submission.save()

        self.client.force_authenticate(user=self.admin_user)
        url = f"/api/v1/submissions/{self.submission.id}/send-back/"
        data = {"target_phase": "data_entry", "reason": "Admin override"}

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["new_phase"], "data_entry")

        # Verify submission phase was updated
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.phase, Submission.PhaseChoices.DATA_ENTRY)

    def test_send_back_from_documents_phase(self):
        """Test send back from documents phase"""
        self.submission.phase = Submission.PhaseChoices.DOCUMENTS
        self.submission.save()

        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/send-back/"
        data = {
            "target_phase": "botanist_review",
            "reason": "Need botanist re-review",
        }

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["new_phase"], "botanist_review")

    def test_send_back_from_send_emails_phase(self):
        """Test send back from send emails phase"""
        self.submission.phase = Submission.PhaseChoices.SEND_EMAILS
        self.submission.save()

        self.client.force_authenticate(user=self.botanist_user)
        url = f"/api/v1/submissions/{self.submission.id}/send-back/"
        data = {"target_phase": "documents", "reason": "Document regeneration needed"}

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["new_phase"], "documents")

    def test_send_back_nonexistent_submission(self):
        """Test send back with nonexistent submission"""
        self.client.force_authenticate(user=self.finance_user)
        url = "/api/v1/submissions/99999/send-back/"
        data = {"target_phase": "data_entry", "reason": "Test reason"}

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_phase_history_records_all_details(self):
        """Test that phase history records all required details"""
        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/send-back/"
        reason = "Detailed reason for send back"
        data = {"target_phase": "data_entry", "reason": reason}

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify phase history details
        history = SubmissionPhaseHistory.objects.filter(
            submission=self.submission
        ).first()
        self.assertIsNotNone(history)
        self.assertEqual(history.from_phase, Submission.PhaseChoices.FINANCE_APPROVAL)
        self.assertEqual(history.to_phase, Submission.PhaseChoices.DATA_ENTRY)
        self.assertEqual(history.action, "send_back")
        self.assertEqual(history.user, self.finance_user)
        self.assertEqual(history.reason, reason)
        self.assertIsNotNone(history.timestamp)

    def test_multiple_send_backs_create_multiple_history_entries(self):
        """Test that multiple send backs create separate history entries"""
        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/send-back/"

        # First send back
        data = {"target_phase": "data_entry", "reason": "First send back"}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Move to finance approval again
        self.submission.phase = Submission.PhaseChoices.FINANCE_APPROVAL
        self.submission.save()

        # Second send back
        data = {"target_phase": "data_entry", "reason": "Second send back"}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify two history entries exist
        history_count = SubmissionPhaseHistory.objects.filter(
            submission=self.submission
        ).count()
        self.assertEqual(history_count, 2)

    def test_send_back_response_includes_all_required_fields(self):
        """Test that send back response includes all required fields"""
        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/send-back/"
        data = {"target_phase": "data_entry", "reason": "Test reason"}

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify response structure
        self.assertIn("message", response.data)
        self.assertIn("new_phase", response.data)
        self.assertIn("sent_back_by", response.data)
        self.assertIn("sent_back_at", response.data)
        self.assertIn("reason", response.data)

        self.assertEqual(response.data["new_phase"], "data_entry")
        self.assertEqual(response.data["sent_back_by"], "Finance Officer")
        self.assertEqual(response.data["reason"], "Test reason")


class SubmissionPhaseHistoryTestCase(TestCase):
    """Test cases for submission phase history endpoint"""

    def setUp(self):
        """Set up test data"""
        self.client = APIClient()

        # Create users with different roles
        self.admin_user = User.objects.create_user(
            email="admin@test.com",
            password="testpass123",
            first_name="Admin",
            last_name="User",
            is_superuser=True,
            is_staff=True,
        )

        self.finance_user = User.objects.create_user(
            email="finance@test.com",
            password="testpass123",
            first_name="Finance",
            last_name="Officer",
            role="finance",
        )

        self.botanist_user = User.objects.create_user(
            email="botanist@test.com",
            password="testpass123",
            first_name="Botanist",
            last_name="User",
            role="botanist",
        )

        # Create police station and officer
        self.station = PoliceStation.objects.create(
            name="Test Station", address="123 Test St"
        )

        self.officer = PoliceOfficer.objects.create(
            first_name="Test",
            last_name="Officer",
            badge_number="12345",
            station=self.station,
        )

        # Create a test submission
        self.submission = Submission.objects.create(
            case_number="TEST-HISTORY-001",
            received=timezone.now(),
            security_movement_envelope="ENV-001",
            requesting_officer=self.officer,
            phase=Submission.PhaseChoices.DOCUMENTS,
        )

        # Create phase history entries
        self.history1 = SubmissionPhaseHistory.objects.create(
            submission=self.submission,
            from_phase=Submission.PhaseChoices.DATA_ENTRY,
            to_phase=Submission.PhaseChoices.FINANCE_APPROVAL,
            action="advance",
            user=self.finance_user,
        )

        self.history2 = SubmissionPhaseHistory.objects.create(
            submission=self.submission,
            from_phase=Submission.PhaseChoices.FINANCE_APPROVAL,
            to_phase=Submission.PhaseChoices.DATA_ENTRY,
            action="send_back",
            user=self.finance_user,
            reason="Missing defendant information",
        )

        self.history3 = SubmissionPhaseHistory.objects.create(
            submission=self.submission,
            from_phase=Submission.PhaseChoices.DATA_ENTRY,
            to_phase=Submission.PhaseChoices.FINANCE_APPROVAL,
            action="advance",
            user=self.finance_user,
        )

        self.history4 = SubmissionPhaseHistory.objects.create(
            submission=self.submission,
            from_phase=Submission.PhaseChoices.FINANCE_APPROVAL,
            to_phase=Submission.PhaseChoices.BOTANIST_REVIEW,
            action="advance",
            user=self.botanist_user,
        )

        self.history5 = SubmissionPhaseHistory.objects.create(
            submission=self.submission,
            from_phase=Submission.PhaseChoices.BOTANIST_REVIEW,
            to_phase=Submission.PhaseChoices.DOCUMENTS,
            action="advance",
            user=self.botanist_user,
        )

    def test_phase_history_requires_authentication(self):
        """Test that phase history endpoint requires authentication"""
        url = f"/api/v1/submissions/{self.submission.id}/phase-history/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_phase_history_list(self):
        """Test retrieving phase history list"""
        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/phase-history/"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 5)

    def test_phase_history_ordered_by_timestamp_desc(self):
        """Test that phase history is ordered by timestamp descending (newest first)"""
        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/phase-history/"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify newest entry is first
        results = response.data["results"]
        self.assertEqual(results[0]["id"], self.history5.id)
        self.assertEqual(results[-1]["id"], self.history1.id)

    def test_phase_history_includes_all_fields(self):
        """Test that phase history includes all required fields"""
        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/phase-history/"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check first entry (send_back with reason)
        send_back_entry = next(
            (
                item
                for item in response.data["results"]
                if item["action"] == "send_back"
            ),
            None,
        )
        self.assertIsNotNone(send_back_entry)
        self.assertIn("id", send_back_entry)
        self.assertIn("from_phase", send_back_entry)
        self.assertIn("from_phase_display", send_back_entry)
        self.assertIn("to_phase", send_back_entry)
        self.assertIn("to_phase_display", send_back_entry)
        self.assertIn("action", send_back_entry)
        self.assertIn("action_display", send_back_entry)
        self.assertIn("user", send_back_entry)
        self.assertIn("user_details", send_back_entry)
        self.assertIn("reason", send_back_entry)
        self.assertIn("timestamp", send_back_entry)
        self.assertEqual(send_back_entry["reason"], "Missing defendant information")

    def test_filter_phase_history_by_action(self):
        """Test filtering phase history by action type"""
        self.client.force_authenticate(user=self.finance_user)
        url = (
            f"/api/v1/submissions/{self.submission.id}/phase-history/?action=send_back"
        )

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["action"], "send_back")

    def test_filter_phase_history_by_user(self):
        """Test filtering phase history by user"""
        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/phase-history/?user={self.botanist_user.id}"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 2)
        for entry in response.data["results"]:
            self.assertEqual(entry["user"], self.botanist_user.id)

    def test_filter_phase_history_by_from_phase(self):
        """Test filtering phase history by from_phase"""
        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/phase-history/?from_phase=data_entry"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 2)
        for entry in response.data["results"]:
            self.assertEqual(entry["from_phase"], "data_entry")

    def test_filter_phase_history_by_to_phase(self):
        """Test filtering phase history by to_phase"""
        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/phase-history/?to_phase=finance_approval"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 2)
        for entry in response.data["results"]:
            self.assertEqual(entry["to_phase"], "finance_approval")

    def test_sort_phase_history_by_timestamp_asc(self):
        """Test sorting phase history by timestamp ascending (oldest first)"""
        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/phase-history/?ordering=timestamp"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify oldest entry is first
        results = response.data["results"]
        self.assertEqual(results[0]["id"], self.history1.id)
        self.assertEqual(results[-1]["id"], self.history5.id)

    def test_phase_history_user_details_included(self):
        """Test that user details are included in phase history"""
        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/phase-history/"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check user details are populated
        entry = response.data["results"][0]
        self.assertIsNotNone(entry["user_details"])
        self.assertIn("full_name", entry["user_details"])
        self.assertIn("email", entry["user_details"])
        self.assertIn("role", entry["user_details"])

    def test_phase_history_for_nonexistent_submission(self):
        """Test phase history for nonexistent submission returns empty list"""
        self.client.force_authenticate(user=self.finance_user)
        url = "/api/v1/submissions/99999/phase-history/"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 0)

    def test_phase_history_shows_send_back_reasons(self):
        """Test that send back reasons are visible in phase history"""
        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/phase-history/"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Find send_back entry
        send_back_entry = next(
            (
                item
                for item in response.data["results"]
                if item["action"] == "send_back"
            ),
            None,
        )
        self.assertIsNotNone(send_back_entry)
        self.assertEqual(send_back_entry["reason"], "Missing defendant information")

    def test_phase_history_advance_actions_have_no_reason(self):
        """Test that advance actions have null reason"""
        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/phase-history/"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Find advance entry
        advance_entry = next(
            (item for item in response.data["results"] if item["action"] == "advance"),
            None,
        )
        self.assertIsNotNone(advance_entry)
        self.assertIsNone(advance_entry["reason"])

    def test_phase_history_includes_display_names(self):
        """Test that phase history includes human-readable display names"""
        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/phase-history/"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        entry = response.data["results"][0]
        self.assertIn("from_phase_display", entry)
        self.assertIn("to_phase_display", entry)
        self.assertIn("action_display", entry)

        # Verify display names are human-readable
        self.assertNotEqual(entry["from_phase_display"], entry["from_phase"])
        self.assertNotEqual(entry["to_phase_display"], entry["to_phase"])
        self.assertNotEqual(entry["action_display"], entry["action"])

    def test_phase_history_pagination(self):
        """Test that phase history supports pagination"""
        # Create many more history entries
        for i in range(20):
            SubmissionPhaseHistory.objects.create(
                submission=self.submission,
                from_phase=Submission.PhaseChoices.DATA_ENTRY,
                to_phase=Submission.PhaseChoices.FINANCE_APPROVAL,
                action="advance",
                user=self.finance_user,
            )

        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/phase-history/"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("count", response.data)
        self.assertIn("next", response.data)
        self.assertIn("previous", response.data)
        self.assertIn("results", response.data)
        self.assertEqual(response.data["count"], 25)  # 5 original + 20 new

    def test_phase_history_combined_filters(self):
        """Test combining multiple filters"""
        self.client.force_authenticate(user=self.finance_user)
        url = f"/api/v1/submissions/{self.submission.id}/phase-history/?action=advance&user={self.botanist_user.id}"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 2)
        for entry in response.data["results"]:
            self.assertEqual(entry["action"], "advance")
            self.assertEqual(entry["user"], self.botanist_user.id)


class SubmissionSearchTestCase(TestCase):
    """Test cases for submission search functionality"""

    def setUp(self):
        """Set up test data"""
        self.client = APIClient()

        # Create users with different roles
        self.admin_user = User.objects.create_user(
            email="admin@test.com",
            password="testpass123",
            first_name="Admin",
            last_name="User",
            is_superuser=True,
            is_staff=True,
        )

        # Create botanist users
        self.botanist_jane = User.objects.create_user(
            email="jane.botanist@test.com",
            password="testpass123",
            first_name="Jane",
            last_name="Smith",
            role="botanist",
        )

        self.botanist_john = User.objects.create_user(
            email="john.botanist@test.com",
            password="testpass123",
            first_name="John",
            last_name="Doe",
            role="botanist",
        )

        # Create finance officer users
        self.finance_alice = User.objects.create_user(
            email="alice.finance@test.com",
            password="testpass123",
            first_name="Alice",
            last_name="Johnson",
            role="finance",
        )

        self.finance_bob = User.objects.create_user(
            email="bob.finance@test.com",
            password="testpass123",
            first_name="Bob",
            last_name="Williams",
            role="finance",
        )

        # Create police station and officer
        self.station = PoliceStation.objects.create(
            name="Test Station", address="123 Test St"
        )

        self.officer = PoliceOfficer.objects.create(
            first_name="Test",
            last_name="Officer",
            badge_number="12345",
            station=self.station,
        )

        # Create defendants
        self.defendant1 = Defendant.objects.create(
            first_name="David", last_name="Brown"
        )

        self.defendant2 = Defendant.objects.create(first_name="Emma", last_name="Davis")

        # Create test submissions with different botanists and finance officers
        self.submission1 = Submission.objects.create(
            case_number="TEST-SEARCH-001",
            received=timezone.now(),
            security_movement_envelope="ENV-001",
            requesting_officer=self.officer,
            approved_botanist=self.botanist_jane,
            finance_officer=self.finance_alice,
            phase=Submission.PhaseChoices.BOTANIST_REVIEW,
        )
        self.submission1.defendants.add(self.defendant1)

        self.submission2 = Submission.objects.create(
            case_number="TEST-SEARCH-002",
            received=timezone.now(),
            security_movement_envelope="ENV-002",
            requesting_officer=self.officer,
            approved_botanist=self.botanist_john,
            finance_officer=self.finance_bob,
            phase=Submission.PhaseChoices.DOCUMENTS,
        )
        self.submission2.defendants.add(self.defendant2)

        self.submission3 = Submission.objects.create(
            case_number="TEST-SEARCH-003",
            received=timezone.now(),
            security_movement_envelope="ENV-003",
            requesting_officer=self.officer,
            approved_botanist=self.botanist_jane,
            finance_officer=self.finance_bob,
            phase=Submission.PhaseChoices.FINANCE_APPROVAL,
        )

    def test_search_by_botanist_first_name(self):
        """Test searching submissions by botanist first name"""
        self.client.force_authenticate(user=self.admin_user)
        url = "/api/v1/submissions/?search=Jane"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Should return submissions 1 and 3 (both have Jane as botanist)
        case_numbers = [item["case_number"] for item in response.data["results"]]
        self.assertIn("TEST-SEARCH-001", case_numbers)
        self.assertIn("TEST-SEARCH-003", case_numbers)
        self.assertNotIn("TEST-SEARCH-002", case_numbers)

    def test_search_by_botanist_last_name(self):
        """Test searching submissions by botanist last name"""
        self.client.force_authenticate(user=self.admin_user)
        url = "/api/v1/submissions/?search=Smith"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Should return submissions 1 and 3 (both have Smith as botanist last name)
        case_numbers = [item["case_number"] for item in response.data["results"]]
        self.assertIn("TEST-SEARCH-001", case_numbers)
        self.assertIn("TEST-SEARCH-003", case_numbers)
        self.assertNotIn("TEST-SEARCH-002", case_numbers)

    def test_search_by_finance_officer_first_name(self):
        """Test searching submissions by finance officer first name"""
        self.client.force_authenticate(user=self.admin_user)
        url = "/api/v1/submissions/?search=Alice"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Should return submission 1 (has Alice as finance officer)
        case_numbers = [item["case_number"] for item in response.data["results"]]
        self.assertIn("TEST-SEARCH-001", case_numbers)
        self.assertNotIn("TEST-SEARCH-002", case_numbers)
        self.assertNotIn("TEST-SEARCH-003", case_numbers)

    def test_search_by_finance_officer_last_name(self):
        """Test searching submissions by finance officer last name"""
        self.client.force_authenticate(user=self.admin_user)
        url = "/api/v1/submissions/?search=Williams"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Should return submissions 2 and 3 (both have Williams as finance officer last name)
        case_numbers = [item["case_number"] for item in response.data["results"]]
        self.assertNotIn("TEST-SEARCH-001", case_numbers)
        self.assertIn("TEST-SEARCH-002", case_numbers)
        self.assertIn("TEST-SEARCH-003", case_numbers)

    def test_search_returns_correct_submissions(self):
        """Test that search returns correct submissions with all details"""
        self.client.force_authenticate(user=self.admin_user)
        url = "/api/v1/submissions/?search=Jane"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify the returned submissions have the correct botanist
        for item in response.data["results"]:
            if item["case_number"] in ["TEST-SEARCH-001", "TEST-SEARCH-003"]:
                self.assertEqual(item["approved_botanist_name"], "Jane Smith")

    def test_search_no_duplicate_results(self):
        """Test that search does not return duplicate results"""
        self.client.force_authenticate(user=self.admin_user)
        url = "/api/v1/submissions/?search=Jane"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Get all case numbers
        case_numbers = [item["case_number"] for item in response.data["results"]]

        # Verify no duplicates
        self.assertEqual(len(case_numbers), len(set(case_numbers)))

    def test_search_case_insensitive(self):
        """Test that search is case insensitive"""
        self.client.force_authenticate(user=self.admin_user)

        # Search with lowercase
        url_lower = "/api/v1/submissions/?search=jane"
        response_lower = self.client.get(url_lower)

        # Search with uppercase
        url_upper = "/api/v1/submissions/?search=JANE"
        response_upper = self.client.get(url_upper)

        # Both should return the same results
        self.assertEqual(response_lower.status_code, status.HTTP_200_OK)
        self.assertEqual(response_upper.status_code, status.HTTP_200_OK)
        self.assertEqual(
            len(response_lower.data["results"]), len(response_upper.data["results"])
        )

    def test_search_partial_match(self):
        """Test that search works with partial matches"""
        self.client.force_authenticate(user=self.admin_user)
        url = "/api/v1/submissions/?search=Smi"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Should return submissions with Smith (partial match)
        case_numbers = [item["case_number"] for item in response.data["results"]]
        self.assertIn("TEST-SEARCH-001", case_numbers)
        self.assertIn("TEST-SEARCH-003", case_numbers)

    def test_search_combined_with_other_filters(self):
        """Test that search works combined with other filters"""
        self.client.force_authenticate(user=self.admin_user)
        url = "/api/v1/submissions/?search=Jane&phase=botanist_review"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Should return only submission 1 (Jane + botanist_review phase)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["case_number"], "TEST-SEARCH-001")

    def test_search_by_defendant_name_still_works(self):
        """Test that existing defendant name search still works"""
        self.client.force_authenticate(user=self.admin_user)
        url = "/api/v1/submissions/?search=David"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Should return submission 1 (has David Brown as defendant)
        case_numbers = [item["case_number"] for item in response.data["results"]]
        self.assertIn("TEST-SEARCH-001", case_numbers)

    def test_search_by_case_number_still_works(self):
        """Test that existing case number search still works"""
        self.client.force_authenticate(user=self.admin_user)
        url = "/api/v1/submissions/?search=TEST-SEARCH-002"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Should return submission 2
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["case_number"], "TEST-SEARCH-002")

    def test_search_by_officer_name_still_works(self):
        """Test that existing officer name search still works"""
        self.client.force_authenticate(user=self.admin_user)
        url = "/api/v1/submissions/?search=Officer"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Should return all submissions (all have same officer)
        self.assertEqual(len(response.data["results"]), 3)


class SubmissionSortingTestCase(TestCase):
    """Test cases for submission sorting functionality"""

    def setUp(self):
        """Set up test data"""
        self.client = APIClient()

        # Create admin user
        self.admin_user = User.objects.create_user(
            email="admin@test.com",
            password="testpass123",
            first_name="Admin",
            last_name="User",
            is_superuser=True,
            is_staff=True,
        )

        # Create botanist users with different last names
        self.botanist_alice = User.objects.create_user(
            email="alice.botanist@test.com",
            password="testpass123",
            first_name="Alice",
            last_name="Anderson",
            role="botanist",
        )

        self.botanist_charlie = User.objects.create_user(
            email="charlie.botanist@test.com",
            password="testpass123",
            first_name="Charlie",
            last_name="Chen",
            role="botanist",
        )

        self.botanist_bob = User.objects.create_user(
            email="bob.botanist@test.com",
            password="testpass123",
            first_name="Bob",
            last_name="Brown",
            role="botanist",
        )

        # Create finance officer users with different last names
        self.finance_david = User.objects.create_user(
            email="david.finance@test.com",
            password="testpass123",
            first_name="David",
            last_name="Davis",
            role="finance",
        )

        self.finance_frank = User.objects.create_user(
            email="frank.finance@test.com",
            password="testpass123",
            first_name="Frank",
            last_name="Foster",
            role="finance",
        )

        self.finance_emma = User.objects.create_user(
            email="emma.finance@test.com",
            password="testpass123",
            first_name="Emma",
            last_name="Evans",
            role="finance",
        )

        # Create police station and officer
        self.station = PoliceStation.objects.create(
            name="Test Station", address="123 Test St"
        )

        self.officer = PoliceOfficer.objects.create(
            first_name="Test",
            last_name="Officer",
            badge_number="12345",
            station=self.station,
        )

        # Create submissions with different botanists and finance officers
        self.submission1 = Submission.objects.create(
            case_number="TEST-001",
            received=timezone.now(),
            security_movement_envelope="ENV-001",
            requesting_officer=self.officer,
            approved_botanist=self.botanist_charlie,  # Chen
            finance_officer=self.finance_david,  # Davis
        )

        self.submission2 = Submission.objects.create(
            case_number="TEST-002",
            received=timezone.now() - timedelta(days=1),
            security_movement_envelope="ENV-002",
            requesting_officer=self.officer,
            approved_botanist=self.botanist_alice,  # Anderson
            finance_officer=self.finance_frank,  # Foster
        )

        self.submission3 = Submission.objects.create(
            case_number="TEST-003",
            received=timezone.now() - timedelta(days=2),
            security_movement_envelope="ENV-003",
            requesting_officer=self.officer,
            approved_botanist=self.botanist_bob,  # Brown
            finance_officer=self.finance_emma,  # Evans
        )

        # Create submission with no botanist or finance officer assigned
        self.submission4 = Submission.objects.create(
            case_number="TEST-004",
            received=timezone.now() - timedelta(days=3),
            security_movement_envelope="ENV-004",
            requesting_officer=self.officer,
            approved_botanist=None,
            finance_officer=None,
        )

    def test_sort_by_botanist_ascending(self):
        """Test sorting submissions by botanist last name ascending (A-Z)"""
        self.client.force_authenticate(user=self.admin_user)
        url = "/api/v1/submissions/?ordering=approved_botanist__last_name"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data["results"]
        # Should be: Anderson, Brown, Chen, then None at end
        self.assertEqual(results[0]["case_number"], "TEST-002")  # Anderson
        self.assertEqual(results[1]["case_number"], "TEST-003")  # Brown
        self.assertEqual(results[2]["case_number"], "TEST-001")  # Chen
        self.assertEqual(results[3]["case_number"], "TEST-004")  # None

    def test_sort_by_botanist_descending(self):
        """Test sorting submissions by botanist last name descending (Z-A)"""
        self.client.force_authenticate(user=self.admin_user)
        url = "/api/v1/submissions/?ordering=-approved_botanist__last_name"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data["results"]
        # Should be: Chen, Brown, Anderson, then None at end
        self.assertEqual(results[0]["case_number"], "TEST-001")  # Chen
        self.assertEqual(results[1]["case_number"], "TEST-003")  # Brown
        self.assertEqual(results[2]["case_number"], "TEST-002")  # Anderson
        self.assertEqual(results[3]["case_number"], "TEST-004")  # None

    def test_sort_by_finance_officer_ascending(self):
        """Test sorting submissions by finance officer last name ascending (A-Z)"""
        self.client.force_authenticate(user=self.admin_user)
        url = "/api/v1/submissions/?ordering=finance_officer__last_name"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data["results"]
        # Should be: Davis, Evans, Foster, then None at end
        self.assertEqual(results[0]["case_number"], "TEST-001")  # Davis
        self.assertEqual(results[1]["case_number"], "TEST-003")  # Evans
        self.assertEqual(results[2]["case_number"], "TEST-002")  # Foster
        self.assertEqual(results[3]["case_number"], "TEST-004")  # None

    def test_sort_by_finance_officer_descending(self):
        """Test sorting submissions by finance officer last name descending (Z-A)"""
        self.client.force_authenticate(user=self.admin_user)
        url = "/api/v1/submissions/?ordering=-finance_officer__last_name"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data["results"]
        # Should be: Foster, Evans, Davis, then None at end
        self.assertEqual(results[0]["case_number"], "TEST-002")  # Foster
        self.assertEqual(results[1]["case_number"], "TEST-003")  # Evans
        self.assertEqual(results[2]["case_number"], "TEST-001")  # Davis
        self.assertEqual(results[3]["case_number"], "TEST-004")  # None

    def test_submissions_with_no_assignment_appear_at_end(self):
        """Test that submissions with no botanist/finance officer appear at end"""
        self.client.force_authenticate(user=self.admin_user)

        # Test with botanist sorting
        url = "/api/v1/submissions/?ordering=approved_botanist__last_name"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["results"]
        self.assertEqual(results[-1]["case_number"], "TEST-004")  # None at end

        # Test with finance officer sorting
        url = "/api/v1/submissions/?ordering=finance_officer__last_name"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["results"]
        self.assertEqual(results[-1]["case_number"], "TEST-004")  # None at end

    def test_invalid_ordering_falls_back_to_default(self):
        """Test that invalid ordering parameter falls back to default (-received)"""
        self.client.force_authenticate(user=self.admin_user)
        url = "/api/v1/submissions/?ordering=invalid_field"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data["results"]
        # Should be ordered by received descending (newest first)
        self.assertEqual(results[0]["case_number"], "TEST-001")  # Most recent
        self.assertEqual(results[1]["case_number"], "TEST-002")
        self.assertEqual(results[2]["case_number"], "TEST-003")
        self.assertEqual(results[3]["case_number"], "TEST-004")  # Oldest

    def test_default_ordering_without_parameter(self):
        """Test that default ordering is by received descending"""
        self.client.force_authenticate(user=self.admin_user)
        url = "/api/v1/submissions/"

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data["results"]
        # Should be ordered by received descending (newest first)
        self.assertEqual(results[0]["case_number"], "TEST-001")  # Most recent
        self.assertEqual(results[1]["case_number"], "TEST-002")
        self.assertEqual(results[2]["case_number"], "TEST-003")
        self.assertEqual(results[3]["case_number"], "TEST-004")  # Oldest
