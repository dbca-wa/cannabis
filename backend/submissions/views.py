from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import get_object_or_404
from .models import Submission
from .serializers import SubmissionSerializer


class Submissions(APIView):
    """
    View to list all submissions and create new submissions.
    """

    def get(self, request):
        submissions = Submission.objects.all()
        serializer = SubmissionSerializer(submissions, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = SubmissionSerializer(
            data=request.data, context={"request": request}
        )
        if serializer.is_valid():
            serializer.save(
                dbca_submitter=(
                    request.user.dbcastaffprofile.first()
                    if hasattr(request.user, "dbcastaffprofile")
                    else None
                ),
                police_officer=(
                    request.user.policestaffprofile.first()
                    if hasattr(request.user, "policestaffprofile")
                    else None
                ),
                police_submitter=(
                    request.user.policestaffprofile.first()
                    if hasattr(request.user, "policestaffprofile")
                    else None
                ),
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SubmissionDetail(APIView):
    """
    View to retrieve, update, and delete a single submission instance.
    """

    def get_object(self, id):
        return get_object_or_404(Submission, id=id)

    def get(self, request, id):
        submission = self.get_object(id)
        serializer = SubmissionSerializer(submission)
        return Response(serializer.data)

    def put(self, request, id):
        submission = self.get_object(id)
        serializer = SubmissionSerializer(
            submission, data=request.data, context={"request": request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, id):
        submission = self.get_object(id)
        submission.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
