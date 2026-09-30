"""Serializers for practice mode."""

from rest_framework import serializers


class PracticeBriefSerializer(serializers.Serializer):
    """The fake Priority 3 brief shown on the case page in practice mode.

    Read-only; the brief is generated server-side so the sample data (notably
    determinations) stays within the going-forward set.
    """

    case_number = serializers.CharField()
    officer = serializers.DictField()
    station = serializers.CharField()
    defendant = serializers.DictField()
    botanist = serializers.DictField()
    security_movement_envelope = serializers.CharField(allow_blank=True)
    bags = serializers.ListField(child=serializers.DictField())
