from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

from .models import (
    Batch,
    BotanicalAssessment,
    Case,
    CasePhaseHistory,
    Certificate,
    DrugBag,
)

PHASE_COLORS = {
    "assessment": "#17a2b8",
    "unsigned_generation": "#28a745",
    "batching": "#6f42c1",
    "complete": "#10b981",
}


# ============================================================================
# INLINE ADMIN CLASSES
# ============================================================================


class DrugBagInline(admin.TabularInline):
    """Inline for drug bags in case admin"""

    model = DrugBag
    extra = 0
    fields = ("seal_tag_numbers", "content_type", "property_reference")
    readonly_fields = ("created_at",)


class BotanicalAssessmentInline(admin.StackedInline):
    """Inline for botanical assessment in drug bag admin"""

    model = BotanicalAssessment
    extra = 0
    fields = ("determination", "assessment_date", "botanist_notes")
    readonly_fields = ("created_at", "updated_at")


class CertificateInline(admin.TabularInline):
    """Inline for certificates in case admin"""

    model = Certificate
    extra = 0
    fields = ("certificate_number", "certified_date", "pdf_generating", "pdf_file")
    readonly_fields = ("certificate_number", "created_at")


class SubmissionPhaseHistoryInline(admin.TabularInline):
    """Inline for phase history in case admin"""

    model = CasePhaseHistory
    extra = 0
    fields = ("from_phase", "to_phase", "action", "user", "timestamp")
    readonly_fields = (
        "from_phase",
        "to_phase",
        "action",
        "user",
        "timestamp",
    )
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


# ============================================================================
# MODEL ADMIN CLASSES
# ============================================================================


@admin.register(Case)
class CaseAdmin(admin.ModelAdmin):
    list_display = (
        "case_number",
        "phase_colored",
        "approved_botanist",
        "finance_officer",
        "bags_count",
        "cannabis_status",
        "received",
    )
    list_filter = (
        "phase",
        "approved_botanist",
        "finance_officer",
        "received",
        "created_at",
    )
    search_fields = (
        "case_number",
        "security_movement_envelope",
        "requesting_officer__given_names",
        "requesting_officer__last_name",
        "defendants__given_names",
        "defendants__last_name",
    )
    ordering = ("-received",)

    fieldsets = (
        (
            "Case Information",
            {
                "fields": ("case_number", "received", "security_movement_envelope"),
                "classes": ("wide",),
            },
        ),
        (
            "Staff Assignments",
            {
                "fields": ("approved_botanist", "finance_officer", "last_actioned_by"),
                "classes": ("wide",),
            },
        ),
        (
            "Police Officers",
            {
                "fields": ("requesting_officer", "submitting_officer"),
                "classes": ("wide",),
            },
        ),
        (
            "Defendants",
            {"fields": ("defendants",), "classes": ("wide",)},
        ),
        (
            "Workflow",
            {"fields": ("phase", "batch", "internal_comments"), "classes": ("wide",)},
        ),
        (
            "Workflow Timestamps",
            {
                "fields": ("certificates_generated_at", "completed_at"),
                "classes": ("collapse",),
            },
        ),
        (
            "Audit",
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )

    readonly_fields = (
        "created_at",
        "updated_at",
        "certificates_generated_at",
        "completed_at",
    )

    filter_horizontal = ("defendants",)

    inlines = [
        DrugBagInline,
        SubmissionPhaseHistoryInline,
        CertificateInline,
    ]

    def phase_colored(self, obj):
        color = PHASE_COLORS.get(obj.phase, "#6c757d")
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 6px; '
            'border-radius: 3px; font-size: 11px;">{}</span>',
            color,
            obj.get_phase_display(),
        )

    phase_colored.short_description = "Phase"

    def bags_count(self, obj):
        return format_html(
            '<span style="background: #e8f4fd; padding: 2px 6px; '
            'border-radius: 3px;">{} bags</span>',
            obj.bags.count(),
        )

    bags_count.short_description = "Bags"

    def cannabis_status(self, obj):
        if obj.cannabis_present:
            return format_html(
                '<span style="background: #d4edda; color: #155724; padding: 2px 6px; '
                'border-radius: 3px;">Cannabis Present</span>'
            )
        return format_html(
            '<span style="background: #f8d7da; color: #721c24; padding: 2px 6px; '
            'border-radius: 3px;">No Cannabis</span>'
        )

    cannabis_status.short_description = "Cannabis"

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related(
                "approved_botanist",
                "finance_officer",
                "requesting_officer",
                "submitting_officer",
            )
            .prefetch_related("defendants", "bags")
        )


@admin.register(DrugBag)
class DrugBagAdmin(admin.ModelAdmin):
    list_display = (
        "seal_tag_numbers",
        "submission_link",
        "content_type",
        "assessment_status",
        "created_at",
    )
    list_filter = ("content_type", "submission__phase", "created_at")
    search_fields = (
        "seal_tag_numbers",
        "new_seal_tag_numbers",
        "property_reference",
        "submission__case_number",
    )
    ordering = ("-created_at",)
    readonly_fields = ("created_at", "updated_at")
    inlines = [BotanicalAssessmentInline]

    def submission_link(self, obj):
        url = reverse("admin:submissions_case_change", args=[obj.submission.pk])
        return format_html('<a href="{}">{}</a>', url, obj.submission.case_number)

    submission_link.short_description = "Case"

    def assessment_status(self, obj):
        if hasattr(obj, "assessment") and obj.assessment.determination:
            color = "#28a745" if obj.assessment.is_cannabis else "#6c757d"
            return format_html(
                '<span style="background: {}; color: white; padding: 2px 6px; '
                'border-radius: 3px; font-size: 11px;">{}</span>',
                color,
                obj.assessment.get_determination_display(),
            )
        return format_html(
            '<span style="background: #ffc107; color: #212529; padding: 2px 6px; '
            'border-radius: 3px; font-size: 11px;">Pending</span>'
        )

    assessment_status.short_description = "Assessment"

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("submission")
            .prefetch_related("assessment")
        )


@admin.register(BotanicalAssessment)
class BotanicalAssessmentAdmin(admin.ModelAdmin):
    list_display = ("drug_bag", "determination", "assessment_date", "created_at")
    list_filter = ("determination", "assessment_date", "created_at")
    search_fields = (
        "drug_bag__seal_tag_numbers",
        "drug_bag__submission__case_number",
        "botanist_notes",
    )
    ordering = ("-created_at",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = (
        "certificate_number",
        "submission_link",
        "certified_date",
        "pdf_status",
        "created_at",
    )
    list_filter = ("pdf_generating", "created_at")
    search_fields = ("certificate_number", "submission__case_number")
    ordering = ("-created_at",)
    readonly_fields = ("certificate_number", "pdf_size", "created_at", "updated_at")

    def submission_link(self, obj):
        url = reverse("admin:submissions_case_change", args=[obj.submission.pk])
        return format_html('<a href="{}">{}</a>', url, obj.submission.case_number)

    submission_link.short_description = "Case"

    def pdf_status(self, obj):
        if obj.pdf_generating:
            return format_html(
                '<span style="background: #ffc107; color: #212529; padding: 2px 6px; '
                'border-radius: 3px;">Generating...</span>'
            )
        if obj.pdf_file:
            return format_html(
                '<span style="background: #28a745; color: white; padding: 2px 6px; '
                'border-radius: 3px;">Ready</span>'
            )
        return format_html(
            '<span style="background: #6c757d; color: white; padding: 2px 6px; '
            'border-radius: 3px;">Not Generated</span>'
        )

    pdf_status.short_description = "PDF Status"


@admin.register(Batch)
class BatchAdmin(admin.ModelAdmin):
    list_display = (
        "batch_number",
        "certificate_count",
        "bag_count",
        "total",
        "invoice_raised_number",
        "created_at",
    )
    list_filter = ("created_at",)
    search_fields = ("batch_number", "invoice_raised_number")
    ordering = ("-created_at",)
    readonly_fields = (
        "batch_number",
        "cert_rate",
        "bag_rate",
        "tax_percentage",
        "certificate_count",
        "bag_count",
        "cert_cost",
        "bag_cost",
        "subtotal",
        "tax_amount",
        "total",
        "certificate_number_range",
        "created_at",
        "updated_at",
    )


@admin.register(CasePhaseHistory)
class CasePhaseHistoryAdmin(admin.ModelAdmin):
    """Admin for phase history audit trail"""

    list_display = (
        "submission_link",
        "from_phase",
        "to_phase",
        "action",
        "user_link",
        "timestamp",
    )
    list_filter = ("action", "from_phase", "to_phase", "timestamp")
    search_fields = (
        "submission__case_number",
        "user__email",
        "user__given_names",
        "user__last_name",
    )
    ordering = ("-timestamp",)
    readonly_fields = (
        "submission",
        "from_phase",
        "to_phase",
        "action",
        "user",
        "timestamp",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def submission_link(self, obj):
        url = reverse("admin:submissions_case_change", args=[obj.submission.pk])
        return format_html('<a href="{}">{}</a>', url, obj.submission.case_number)

    submission_link.short_description = "Case"

    def user_link(self, obj):
        if obj.user:
            url = reverse("admin:users_user_change", args=[obj.user.pk])
            return format_html(
                '<a href="{}">{}</a>', url, obj.user.get_full_name() or obj.user.email
            )
        return "System"

    user_link.short_description = "User"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("submission", "user")
