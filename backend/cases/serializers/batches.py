from rest_framework import serializers

from ..models import Batch, Certificate


class BatchCaseTinySerializer(serializers.Serializer):
    """Lightweight case summary for batch listings."""

    id = serializers.IntegerField()
    case_number = serializers.CharField()
    bags_count = serializers.SerializerMethodField()
    certificate_count = serializers.SerializerMethodField()

    def get_bags_count(self, obj):
        return obj.bag_count

    def get_certificate_count(self, obj):
        return Certificate.objects.filter(form__case=obj).count()


class BatchCreateSerializer(serializers.Serializer):
    """Validate the payload for creating a batch from certificate ids."""

    certificate_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=False
    )


class InvoiceRaisedSerializer(serializers.Serializer):
    """Validate recording an invoice-raised number on a batch."""

    invoice_raised_number = serializers.CharField(max_length=50)


class BatchListSerializer(serializers.ModelSerializer):
    """Batch row for the Batches table."""

    botanists = serializers.SerializerMethodField()
    submitting_officers = serializers.SerializerMethodField()
    case_numbers = serializers.SerializerMethodField()
    certificate_numbers = serializers.SerializerMethodField()
    date_batched = serializers.DateTimeField(source="created_at", read_only=True)
    is_invoiced = serializers.ReadOnlyField()

    class Meta:
        model = Batch
        fields = [
            "id",
            "batch_number",
            "date_batched",
            "certificate_count",
            "bag_count",
            "cert_rate",
            "bag_rate",
            "tax_percentage",
            "cert_cost",
            "bag_cost",
            "subtotal",
            "tax_amount",
            "total",
            "certificate_number_range",
            "certificate_numbers",
            "invoice_raised_number",
            "invoice_raised_at",
            "is_invoiced",
            "botanists",
            "submitting_officers",
            "case_numbers",
            "created_at",
        ]

    def _dedupe(self, items):
        seen = []
        for item in items:
            if item and item not in seen:
                seen.append(item)
        return seen

    def _cases(self, obj):
        """Distinct cases behind this batch's certificates, in a stable order."""
        cases = []
        seen = set()
        certificates = obj.certificates.select_related(
            "form__case__approved_botanist",
            "form__case__submitting_officer",
        )
        for certificate in certificates:
            case = certificate.form.case
            if case.pk not in seen:
                seen.add(case.pk)
                cases.append(case)
        return cases

    def get_botanists(self, obj):
        return self._dedupe(
            [
                case.approved_botanist.full_name
                for case in self._cases(obj)
                if case.approved_botanist
            ]
        )

    def get_submitting_officers(self, obj):
        officers = []
        for case in self._cases(obj):
            officer = case.submitting_officer
            if officer:
                badge = f" ({officer.badge_number})" if officer.badge_number else ""
                officers.append(f"{officer.full_name}{badge}")
        return self._dedupe(officers)

    def get_case_numbers(self, obj):
        return [case.case_number for case in self._cases(obj)]

    def get_certificate_numbers(self, obj):
        numbers = obj.certificates.values_list("certificate_number", flat=True)
        return sorted(n for n in numbers if n)


class BatchDetailSerializer(BatchListSerializer):
    """Batch detail including the included cases and ZIP availability."""

    cases = serializers.SerializerMethodField()
    zip_available = serializers.SerializerMethodField()

    class Meta(BatchListSerializer.Meta):
        fields = BatchListSerializer.Meta.fields + ["cases", "zip_available"]

    def get_cases(self, obj):
        return BatchCaseTinySerializer(
            self._cases(obj), many=True, context=self.context
        ).data

    def get_zip_available(self, obj):
        return bool(obj.zip_file)
