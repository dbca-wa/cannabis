"""Defendant service — CRUD, merge, and export business logic."""

import csv
import io
import json

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.http import HttpResponse, StreamingHttpResponse
from rest_framework.exceptions import NotFound, ValidationError

from ..models import Defendant
from ..serializers import DefendantTinySerializer

# Valid ordering fields for defendant queries
VALID_ORDERINGS = {
    "id": "id",
    "-id": "-id",
    "given_names": "given_names",
    "-given_names": "-given_names",
    "last_name": "last_name",
    "-last_name": "-last_name",
    "cases_count": "cases_count",
    "-cases_count": "-cases_count",
    "case_count": "case_count",
    "-case_count": "-case_count",
    "created_at": "created_at",
    "-created_at": "-created_at",
}

COUNT_ORDERINGS = {"cases_count", "-cases_count", "case_count", "-case_count"}


class DefendantService:
    """Business logic for defendant operations."""

    @staticmethod
    def get_defendant(pk):
        """Retrieve a single defendant by primary key.

        Raises:
            NotFound: If the defendant does not exist.
        """
        try:
            return Defendant.objects.annotate(cases_count=Count("cases")).get(pk=pk)
        except Defendant.DoesNotExist:
            raise NotFound(f"Defendant with pk {pk} not found.")

    @staticmethod
    def get_queryset(search=None, ordering="last_name"):
        """Build the annotated, filtered, and ordered defendant queryset.

        Args:
            search: Optional multi-word search string filtering on names.
            ordering: Field name for ordering (prefix with '-' for descending).

        Returns:
            An annotated QuerySet of Defendant objects.
        """
        queryset = Defendant.objects.annotate(
            cases_count=Count("cases"),
            case_count=Count("cases", distinct=True),
        ).order_by("last_name", "given_names")

        if search:
            search_terms = search.strip().split()
            for term in search_terms:
                queryset = queryset.filter(
                    Q(given_names__icontains=term) | Q(last_name__icontains=term)
                )

        if ordering in VALID_ORDERINGS:
            if ordering in COUNT_ORDERINGS:
                queryset = queryset.order_by(
                    VALID_ORDERINGS[ordering], "last_name", "given_names"
                )
            else:
                queryset = queryset.order_by(VALID_ORDERINGS[ordering])
        else:
            queryset = queryset.order_by("last_name", "given_names")

        return queryset

    @staticmethod
    def create_defendant(data, user):
        """Create a defendant from validated serializer data.

        Args:
            data: Validated data dict from the serializer.
            user: The user performing the creation (for logging).

        Returns:
            The created Defendant instance.
        """
        defendant = Defendant.objects.create(**data)
        settings.LOGGER.info(f"User {user} created defendant: {defendant}")
        return defendant

    @staticmethod
    def update_defendant(defendant, data, user):
        """Update an existing defendant.

        Args:
            defendant: The Defendant instance to update.
            data: Dict of fields to update.
            user: The user performing the update (for logging).

        Returns:
            The updated Defendant instance.
        """
        for field, value in data.items():
            setattr(defendant, field, value)
        defendant.save()
        settings.LOGGER.info(f"User {user} updated defendant: {defendant}")
        return defendant

    @staticmethod
    def delete_defendant(defendant, user):
        """Delete a defendant if they have no associated cases.

        Args:
            defendant: The Defendant instance to delete.
            user: The user performing the deletion (for logging).

        Raises:
            ValidationError: If the defendant is linked to one or more cases.
        """
        cases_count = defendant.cases.count()
        if cases_count > 0:
            raise ValidationError(
                f"Cannot delete defendant {defendant.full_name}. "
                f"They are associated with {cases_count} case(s). "
                f"Please remove them from all cases before deletion."
            )

        settings.LOGGER.warning(f"User {user} deleted defendant: {defendant}")
        defendant.delete()

    @staticmethod
    @transaction.atomic
    def merge_defendants(primary_id, secondary_ids):
        """Merge secondary defendants into a primary defendant.

        Reassigns all cases from each secondary defendant to the primary,
        then deletes the secondary records.

        Args:
            primary_id: PK of the defendant to keep.
            secondary_ids: List of PKs of defendants to merge into primary.

        Returns:
            A dict with merge results including cases_reassigned count.

        Raises:
            ValidationError: If input is invalid or defendants do not exist.
        """
        from cases.models import Submission

        if not primary_id:
            raise ValidationError({"primary_id": "primary_id is required."})

        if (
            not secondary_ids
            or not isinstance(secondary_ids, list)
            or len(secondary_ids) == 0
        ):
            raise ValidationError(
                {"secondary_ids": "At least one secondary_id is required."}
            )

        if primary_id in secondary_ids:
            raise ValidationError(
                {"primary_id": "primary_id cannot appear in secondary_ids."}
            )

        # Verify all defendants exist
        all_ids = [primary_id] + secondary_ids
        existing = set(
            Defendant.objects.filter(pk__in=all_ids).values_list("pk", flat=True)
        )
        missing = set(all_ids) - existing
        if missing:
            raise ValidationError(
                {"defendants": f"Defendant(s) not found: {sorted(missing)}"}
            )

        primary = Defendant.objects.get(pk=primary_id)
        cases_reassigned = 0

        for secondary_id in secondary_ids:
            secondary = Defendant.objects.get(pk=secondary_id)
            cases_with_secondary = Submission.objects.filter(defendants=secondary)

            for case in cases_with_secondary:
                case.defendants.add(primary)
                case.defendants.remove(secondary)
                cases_reassigned += 1

            secondary.delete()

        return {
            "message": "Merge completed successfully.",
            "primary_id": primary_id,
            "cases_reassigned": cases_reassigned,
        }

    @staticmethod
    def export_defendants(queryset, export_format, user):
        """Export a defendant queryset in CSV or JSON format.

        Uses streaming responses for datasets over 1000 records.

        Args:
            queryset: Pre-filtered queryset of defendants.
            export_format: Either 'csv' or 'json'.
            user: The user performing the export (for logging).

        Returns:
            An HttpResponse or StreamingHttpResponse with the exported data.

        Raises:
            ValidationError: If the format is invalid or dataset too large.
        """
        if export_format not in ("csv", "json"):
            raise ValidationError(
                {"detail": "Invalid format. Supported formats: csv, json"}
            )

        max_export_limit = getattr(settings, "MAX_EXPORT_LIMIT", 10000)
        total_count = queryset.count()

        if total_count > max_export_limit:
            raise ValidationError(
                f"Dataset too large for export. "
                f"Maximum {max_export_limit} records allowed. "
                f"Total: {total_count}."
            )

        if total_count > 1000:
            if export_format == "csv":
                response = DefendantService._stream_csv_response(queryset)
            else:
                response = DefendantService._stream_json_response(queryset)
        else:
            if export_format == "csv":
                response = DefendantService._csv_response(queryset)
            else:
                response = DefendantService._json_response(queryset)

        settings.LOGGER.info(
            f"User {user} exported {total_count} defendants as {export_format}"
        )
        return response

    @staticmethod
    def _csv_response(queryset):
        """Generate CSV response for smaller datasets."""
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(
            [
                "ID",
                "Given Names",
                "Last Name",
                "Full Name",
                "Cases Count",
                "Created At",
                "Updated At",
            ]
        )

        for defendant in queryset:
            writer.writerow(
                [
                    defendant.id,
                    defendant.given_names or "",
                    defendant.last_name,
                    defendant.full_name,
                    defendant.cases_count,
                    defendant.created_at.isoformat() if defendant.created_at else "",
                    defendant.updated_at.isoformat() if defendant.updated_at else "",
                ]
            )

        response = HttpResponse(output.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="defendants_export.csv"'
        return response

    @staticmethod
    def _json_response(queryset):
        """Generate JSON response for smaller datasets."""
        serializer = DefendantTinySerializer(queryset, many=True)
        data = {"count": queryset.count(), "results": serializer.data}

        response = HttpResponse(
            json.dumps(data, indent=2), content_type="application/json"
        )
        response["Content-Disposition"] = (
            'attachment; filename="defendants_export.json"'
        )
        return response

    @staticmethod
    def _stream_csv_response(queryset):
        """Generate streaming CSV response for large datasets."""

        def csv_generator():
            output = io.StringIO()
            writer = csv.writer(output)

            writer.writerow(
                [
                    "ID",
                    "Given Names",
                    "Last Name",
                    "Full Name",
                    "Cases Count",
                    "Created At",
                    "Updated At",
                ]
            )
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

            chunk_size = 100
            for i in range(0, queryset.count(), chunk_size):
                chunk = queryset[i : i + chunk_size]
                for defendant in chunk:
                    writer.writerow(
                        [
                            defendant.id,
                            defendant.given_names or "",
                            defendant.last_name,
                            defendant.full_name,
                            defendant.cases_count,
                            (
                                defendant.created_at.isoformat()
                                if defendant.created_at
                                else ""
                            ),
                            (
                                defendant.updated_at.isoformat()
                                if defendant.updated_at
                                else ""
                            ),
                        ]
                    )
                yield output.getvalue()
                output.seek(0)
                output.truncate(0)

        response = StreamingHttpResponse(csv_generator(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="defendants_export.csv"'
        return response

    @staticmethod
    def _stream_json_response(queryset):
        """Generate streaming JSON response for large datasets."""

        def json_generator():
            yield '{"count": ' + str(queryset.count()) + ', "results": ['

            chunk_size = 100
            first_chunk = True

            for i in range(0, queryset.count(), chunk_size):
                chunk = queryset[i : i + chunk_size]
                serializer = DefendantTinySerializer(chunk, many=True)

                for j, item in enumerate(serializer.data):
                    if not first_chunk or j > 0:
                        yield ","
                    yield json.dumps(item)
                    first_chunk = False

            yield "]}"

        response = StreamingHttpResponse(
            json_generator(), content_type="application/json"
        )
        response["Content-Disposition"] = (
            'attachment; filename="defendants_export.json"'
        )
        return response
