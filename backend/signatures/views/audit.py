"""Views for signature audit log retrieval."""

from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.views import APIView

from ..models import SignatureAuditLog
from ..serializers import SignatureAuditLogSerializer


class MyAuditLogView(APIView):
    """List signature audit log entries for the current user."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Return all audit log entries for the requesting user."""
        entries = SignatureAuditLog.objects.filter(user=request.user)
        serializer = SignatureAuditLogSerializer(entries, many=True)
        return Response(serializer.data, status=HTTP_200_OK)


class UserAuditLogView(APIView):
    """List signature audit log entries for a specific user (staff only)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        """Return all audit log entries for the given user."""
        if not request.user.is_staff:
            raise PermissionDenied(
                "You do not have permission to access this signature."
            )

        entries = SignatureAuditLog.objects.filter(user_id=user_id)
        serializer = SignatureAuditLogSerializer(entries, many=True)
        return Response(serializer.data, status=HTTP_200_OK)
