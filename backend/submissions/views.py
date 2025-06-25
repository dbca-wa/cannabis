from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import get_object_or_404
from .models import Submission, Baggy, Certificate
from .serializers import (
    SubmissionSerializer,  # Keep original for compatibility
    SubmissionListSerializer,
    SubmissionDetailSerializer,
    BaggySerializer,
    CertificateSerializer,
)


class Submissions(APIView):
    """
    View to list all submissions and create new submissions.
    """

    def get(self, request):
        submissions = Submission.objects.select_related(
            "police_officer__user", "police_submitter__user", "dbca_submitter__user"
        ).prefetch_related("baggies")

        # Use list serializer for performance
        serializer = SubmissionListSerializer(submissions, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = SubmissionDetailSerializer(data=request.data)
        if serializer.is_valid():
            # Create the submission first
            submission = serializer.save()

            # Handle staff profile assignment based on user type
            if hasattr(request.user, "dbca_staff_profile"):
                submission.dbca_submitter = request.user.dbca_staff_profile
                submission.save()
            elif hasattr(request.user, "police_staff_profile"):
                submission.police_officer = request.user.police_staff_profile
                submission.police_submitter = request.user.police_staff_profile
                submission.save()

            return Response(
                SubmissionDetailSerializer(submission).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SubmissionDetail(APIView):
    """
    View to retrieve, update, and delete a single submission instance.
    """

    def get_object(self, id):
        return get_object_or_404(
            Submission.objects.select_related(
                "police_officer__user", "police_submitter__user", "dbca_submitter__user"
            ).prefetch_related(
                "baggies",
                "certificate_set",  # Note: Django creates this reverse relation automatically
            ),
            id=id,
        )

    def get(self, request, id):
        submission = self.get_object(id)
        serializer = SubmissionDetailSerializer(submission)
        return Response(serializer.data)

    def put(self, request, id):
        submission = self.get_object(id)
        serializer = SubmissionDetailSerializer(
            submission, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, id):
        submission = self.get_object(id)
        submission.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# Additional views for Baggies and Certificates (if you want separate endpoints)
class Baggies(APIView):
    """
    View to list all baggies and create new baggies.
    """

    def get(self, request):
        submission_id = request.GET.get("submission")
        baggies = Baggy.objects.select_related("submission")

        if submission_id:
            baggies = baggies.filter(submission_id=submission_id)

        serializer = BaggySerializer(baggies, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = BaggySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BaggyDetail(APIView):
    """
    View to retrieve, update, and delete a single baggy instance.
    """

    def get_object(self, id):
        return get_object_or_404(Baggy.objects.select_related("submission"), id=id)

    def get(self, request, id):
        baggy = self.get_object(id)
        serializer = BaggySerializer(baggy)
        return Response(serializer.data)

    def put(self, request, id):
        baggy = self.get_object(id)
        serializer = BaggySerializer(baggy, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, id):
        baggy = self.get_object(id)
        baggy.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class Certificates(APIView):
    """
    View to list all certificates and create new certificates.
    """

    def get(self, request):
        submission_id = request.GET.get("submission")
        certificates = Certificate.objects.select_related("submission")

        if submission_id:
            certificates = certificates.filter(submission_id=submission_id)

        serializer = CertificateSerializer(certificates, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CertificateSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CertificateDetail(APIView):
    """
    View to retrieve, update, and delete a single certificate instance.
    """

    def get_object(self, id):
        return get_object_or_404(
            Certificate.objects.select_related("submission"), id=id
        )

    def get(self, request, id):
        certificate = self.get_object(id)
        serializer = CertificateSerializer(certificate)
        return Response(serializer.data)

    def put(self, request, id):
        certificate = self.get_object(id)
        serializer = CertificateSerializer(certificate, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, id):
        certificate = self.get_object(id)
        certificate.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
