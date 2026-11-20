"""Legacy import tasks on the Settings page. Maintainers only.

GET    legacy-import/bundle        the uploaded bundle's details (never its content)
POST   legacy-import/bundle        upload a bundle (replaces any earlier one)
DELETE legacy-import/bundle        delete the uploaded bundle
GET    legacy-import/runs          recent runs
POST   legacy-import/runs          start a run: {"action": "dry_run" | "import" | "reconcile" | "undo"}
GET    legacy-import/runs/<pk>     one run, with its log and full report
"""

import hashlib

from django.conf import settings
from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.status import HTTP_201_CREATED, HTTP_204_NO_CONTENT
from rest_framework.views import APIView

from cases.legacy_import import jobs
from cases.models import LegacyImportBundle, LegacyImportRun
from common.logging import describe_user
from common.practice import is_in_practice_mode
from users.permissions import IsMaintainer

MAX_BUNDLE_BYTES = 50 * 1024 * 1024


class LegacyImportBundleSerializer(serializers.ModelSerializer):
    uploaded_by = serializers.StringRelatedField()

    class Meta:
        model = LegacyImportBundle
        fields = [
            "id",
            "filename",
            "size",
            "sha256",
            "summary",
            "uploaded_by",
            "uploaded_at",
        ]


class LegacyImportRunSerializer(serializers.ModelSerializer):
    started_by = serializers.StringRelatedField()
    action_display = serializers.CharField(source="get_action_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = LegacyImportRun
        fields = [
            "id",
            "action",
            "action_display",
            "status",
            "status_display",
            "started_by",
            "started_at",
            "finished_at",
            "bundle_sha256",
            "summary",
            "log",
            "error",
        ]


class LegacyImportRunDetailSerializer(LegacyImportRunSerializer):
    class Meta(LegacyImportRunSerializer.Meta):
        fields = LegacyImportRunSerializer.Meta.fields + ["report"]


def _refuse_in_practice(user):
    # The import changes real, shared data, so practice mode cannot run it.
    if is_in_practice_mode(user):
        raise PermissionDenied("Turn practice mode off to run the legacy import.")


class LegacyImportBundleView(APIView):
    permission_classes = [IsMaintainer]
    parser_classes = [MultiPartParser, JSONParser]

    def get(self, request):
        bundle = jobs.latest_bundle()
        return Response(
            {"bundle": LegacyImportBundleSerializer(bundle).data if bundle else None}
        )

    def post(self, request):
        from etl.bundle import BundleError, read_bundle

        _refuse_in_practice(request.user)
        upload = request.FILES.get("file")
        if upload is None:
            raise ValidationError({"file": ["Choose the bundle file to upload."]})
        if upload.size > MAX_BUNDLE_BYTES:
            raise ValidationError(
                {"file": ["The file is larger than a bundle can be."]}
            )
        content = upload.read()
        try:
            parsed = read_bundle(content)
        except BundleError as error:
            raise ValidationError({"file": [str(error)]})
        with transaction.atomic():
            # Only the newest bundle is ever used; keep no stale copies of the data.
            LegacyImportBundle.objects.all().delete()
            bundle = LegacyImportBundle.objects.create(
                content=content,
                filename=upload.name[:255],
                size=len(content),
                sha256=hashlib.sha256(content).hexdigest(),
                summary=parsed.summary,
                uploaded_by=request.user,
            )
        settings.LOGGER.info(
            f"{describe_user(request.user)} uploaded legacy import bundle "
            f"{bundle.filename} ({bundle.pk}) with {len(parsed.rows)} source rows"
        )
        return Response(
            {"bundle": LegacyImportBundleSerializer(bundle).data},
            status=HTTP_201_CREATED,
        )

    def delete(self, request):
        _refuse_in_practice(request.user)
        removed, _ = LegacyImportBundle.objects.all().delete()
        if removed:
            settings.LOGGER.info(
                f"{describe_user(request.user)} deleted the legacy import bundle"
            )
        return Response(status=HTTP_204_NO_CONTENT)


class LegacyImportRunListView(APIView):
    permission_classes = [IsMaintainer]

    def get(self, request):
        runs = LegacyImportRun.objects.select_related("started_by")[:20]
        return Response({"runs": LegacyImportRunSerializer(runs, many=True).data})

    def post(self, request):
        _refuse_in_practice(request.user)
        run = jobs.start_run(request.data.get("action"), request.user)
        return Response(
            {"run": LegacyImportRunSerializer(run).data}, status=HTTP_201_CREATED
        )


class LegacyImportRunDetailView(APIView):
    permission_classes = [IsMaintainer]

    def get(self, request, pk):
        run = LegacyImportRun.objects.select_related("started_by").filter(pk=pk).first()
        if run is None:
            from rest_framework.exceptions import NotFound

            raise NotFound("No such run.")
        return Response({"run": LegacyImportRunDetailSerializer(run).data})
