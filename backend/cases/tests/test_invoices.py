"""Tests for invoice endpoints."""

import pytest
from django.urls import reverse


@pytest.mark.django_db
def test_invoice_list_for_submission(authenticated_client, submission, invoice):
    """GET invoices for submission returns 200 with paginated data."""
    url = reverse("invoice_list", kwargs={"pk": submission.pk})
    response = authenticated_client.get(url)

    assert response.status_code == 200
    if isinstance(response.data, dict):
        assert "results" in response.data
        assert len(response.data["results"]) >= 1
    else:
        assert len(response.data) >= 1


@pytest.mark.django_db
def test_all_invoices_list(authenticated_client, invoice):
    """GET all-invoices flat list returns 200 with data."""
    url = reverse("all_invoices_list")
    response = authenticated_client.get(url)

    assert response.status_code == 200
    if isinstance(response.data, dict):
        assert "results" in response.data
        assert len(response.data["results"]) >= 1
    else:
        assert len(response.data) >= 1


@pytest.mark.django_db
def test_invoice_detail(authenticated_client, invoice):
    """GET invoice by ID returns 200 with correct data."""
    url = reverse("invoice_detail", kwargs={"pk": invoice.pk})
    response = authenticated_client.get(url)

    assert response.status_code == 200
    assert response.data["invoice_number"] == invoice.invoice_number
