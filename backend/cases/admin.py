from django.contrib import admin
from django.db.models import Count, Exists, OuterRef, Prefetch
from django.urls import reverse
from django.utils.html import format_html

from common.admin_mixins import PracticeAwareAdminMixin, PracticeAwareInlineMixin

from .models import (
    Batch,
    BotanicalAssessment,
    Case,
    CaseDraft,
    CasePhaseHistory,
    Certificate,
    DrugBag,
    Priority3Form,
    SectionCTemplate,
)

PHASE_COLORS = {
    "assessment": "#17a2b8",
    "unsigned_generation": "#28a745",
    "batching": "#6f42c1",
    "in_batch": "#fd7e14",
    "complete": "#10b981",
}


def _badge(label, background, color, font_size=None):
    """Render a coloured status badge, escaping every interpolated value."""
    size = f" font-size: {font_size};" if font_size else ""
    return format_html(
        '<span style="background: {}; color: {}; padding: 2px 6px; '
        'border-radius: 3px;{}">{}</span>',
        background,
        color,
        size,
        label,
    )


# ============================================================================
# INLINE ADMIN CLASSES
# ============================================================================


class DrugBagInline(PracticeAwareInlineMixin, admin.TabularInline):
    """Inline for drug bags under a Priority 3 form"""

    model = DrugBag
    extra = 0
    fields = ("seal_tag_numbers", "content_type", "property_reference")
    readonly_fields = ("created_at",)


class BotanicalAssessmentInline(PracticeAwareInlineMixin, admin.StackedInline):
    """Inline for botanical assessment in drug bag admin"""

    model = BotanicalAssessment
    extra = 0
    fields = ("determination", "assessment_date", "botanist_notes")
    readonly_fields = ("created_at", "updated_at")


class CertificateInline(PracticeAwareInlineMixin, admin.TabularInline):
    """Inline for a Priority 3 form's single certificate"""

    model = Certificate
    extra = 0
    fields = ("certificate_number", "certified_date", "pdf_generating", "pdf_file")
    readonly_fields = ("certificate_number", "created_at")


class Priority3FormInline(PracticeAwareInlineMixin, admin.TabularInline):
    """Inline for Priority 3 forms within a case"""

    model = Priority3Form
    extra = 0
    fields = ("phase", "security_movement_envelope", "scanned_image")
    readonly_fields = ("created_at",)
    show_change_link = True


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
class CaseAdmin(PracticeAwareAdminMixin, admin.ModelAdmin):
    list_display = (
        "case_number",
        "status_colored",
        "approved_botanist",
        "finance_officer",
        "bags_count",
        "cannabis_status",
        "received",
    )
    list_filter = (
        "approved_botanist",
        "finance_officer",
        "is_legacy",
        "received",
        "created_at",
    )
    search_fields = (
        "case_number",
        "forms__security_movement_envelope",
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
                "fields": ("case_number", "received", "is_legacy", "legacy_id"),
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
                "fields": ("requesting_officer", "submitting_officer", "station"),
                "classes": ("wide",),
            },
        ),
        (
            "Defendants",
            {"fields": ("defendants",), "classes": ("wide",)},
        ),
        (
            "Notes",
            {
                "fields": ("internal_comments",),
                "classes": ("wide",),
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
    )

    filter_horizontal = ("defendants",)

    inlines = [
        Priority3FormInline,
        SubmissionPhaseHistoryInline,
    ]

    def status_colored(self, obj):
        status = obj.derived_status
        color = PHASE_COLORS.get(status, "#6c757d")
        label = dict(Case.PhaseChoices.choices).get(status, status)
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 6px; '
            'border-radius: 3px; font-size: 11px;">{}</span>',
            color,
            label,
        )

    status_colored.short_description = "Status"

    @admin.display(description="Bags", ordering="_bag_count")
    def bags_count(self, obj):
        return format_html(
            '<span style="background: #e8f4fd; padding: 2px 6px; '
            'border-radius: 3px;">{} bags</span>',
            obj._bag_count,
        )

    @admin.display(description="Cannabis", ordering="_cannabis_present")
    def cannabis_status(self, obj):
        if obj._cannabis_present:
            return _badge("Cannabis Present", "#d4edda", "#155724")
        return _badge("No Cannabis", "#f8d7da", "#721c24")

    def get_queryset(self, request):
        # Counts and the forms prefetch read every row (practice included) so
        # practice cases show their real totals; the model properties would go
        # through the context-filtered default manager instead.
        cannabis_bags = DrugBag.all_objects.filter(
            form__case=OuterRef("pk"),
            assessment__determination__icontains="cannabis",
        )
        return (
            super()
            .get_queryset(request)
            .select_related(
                "approved_botanist",
                "finance_officer",
                "requesting_officer",
                "submitting_officer",
            )
            .prefetch_related(
                Prefetch("forms", queryset=Priority3Form.all_objects.all())
            )
            .annotate(
                _bag_count=Count("forms__bags", distinct=True),
                _cannabis_present=Exists(cannabis_bags),
            )
        )


@admin.register(Priority3Form)
class Priority3FormAdmin(PracticeAwareAdminMixin, admin.ModelAdmin):
    list_display = (
        "id",
        "case_link",
        "phase_colored",
        "bags_count",
        "security_movement_envelope",
        "created_at",
    )
    list_filter = ("phase", "created_at")
    search_fields = (
        "case__case_number",
        "security_movement_envelope",
    )
    ordering = ("case", "id")
    readonly_fields = (
        "created_at",
        "updated_at",
        "certificates_generated_at",
        "completed_at",
    )
    inlines = [DrugBagInline, CertificateInline]

    def case_link(self, obj):
        url = reverse("admin:submissions_case_change", args=[obj.case.pk])
        return format_html('<a href="{}">{}</a>', url, obj.case.case_number)

    case_link.short_description = "Case"

    def phase_colored(self, obj):
        color = PHASE_COLORS.get(obj.phase, "#6c757d")
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 6px; '
            'border-radius: 3px; font-size: 11px;">{}</span>',
            color,
            obj.get_phase_display(),
        )

    phase_colored.short_description = "Phase"

    @admin.display(description="Bags", ordering="_bag_count")
    def bags_count(self, obj):
        return format_html(
            '<span style="background: #e8f4fd; padding: 2px 6px; '
            'border-radius: 3px;">{} bags</span>',
            obj._bag_count,
        )

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("case")
            .annotate(_bag_count=Count("bags"))
        )


@admin.register(DrugBag)
class DrugBagAdmin(PracticeAwareAdminMixin, admin.ModelAdmin):
    list_display = (
        "seal_tag_numbers",
        "case_link",
        "content_type",
        "assessment_status",
        "created_at",
    )
    list_filter = ("content_type", "form__phase", "created_at")
    search_fields = (
        "seal_tag_numbers",
        "new_seal_tag_numbers",
        "property_reference",
        "form__case__case_number",
    )
    ordering = ("-created_at",)
    readonly_fields = ("created_at", "updated_at")
    inlines = [BotanicalAssessmentInline]

    def case_link(self, obj):
        case = obj.form.case
        url = reverse("admin:submissions_case_change", args=[case.pk])
        return format_html('<a href="{}">{}</a>', url, case.case_number)

    case_link.short_description = "Case"

    def assessment_status(self, obj):
        if hasattr(obj, "assessment") and obj.assessment.determination:
            color = "#28a745" if obj.assessment.is_cannabis else "#6c757d"
            return format_html(
                '<span style="background: {}; color: white; padding: 2px 6px; '
                'border-radius: 3px; font-size: 11px;">{}</span>',
                color,
                obj.assessment.get_determination_display(),
            )
        return _badge("Pending", "#ffc107", "#212529", font_size="11px")

    assessment_status.short_description = "Assessment"

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("form", "form__case")
            .prefetch_related("assessment")
        )


@admin.register(BotanicalAssessment)
class BotanicalAssessmentAdmin(PracticeAwareAdminMixin, admin.ModelAdmin):
    list_display = ("drug_bag", "determination", "assessment_date", "created_at")
    list_filter = ("determination", "assessment_date", "created_at")
    search_fields = (
        "drug_bag__seal_tag_numbers",
        "drug_bag__form__case__case_number",
        "botanist_notes",
    )
    ordering = ("-created_at",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(Certificate)
class CertificateAdmin(PracticeAwareAdminMixin, admin.ModelAdmin):
    list_display = (
        "certificate_number",
        "case_link",
        "certified_date",
        "batch",
        "pdf_status",
        "created_at",
    )
    list_filter = ("pdf_generating", "batch", "created_at")
    search_fields = ("certificate_number", "form__case__case_number")
    ordering = ("-created_at",)
    readonly_fields = ("certificate_number", "pdf_size", "created_at", "updated_at")

    def case_link(self, obj):
        case = obj.form.case
        url = reverse("admin:submissions_case_change", args=[case.pk])
        return format_html('<a href="{}">{}</a>', url, case.case_number)

    case_link.short_description = "Case"

    def pdf_status(self, obj):
        if obj.pdf_generating:
            return _badge("Generating...", "#ffc107", "#212529")
        if obj.pdf_file:
            return _badge("Ready", "#28a745", "white")
        return _badge("Not Generated", "#6c757d", "white")

    pdf_status.short_description = "PDF Status"

    def get_queryset(self, request):
        return (
            super().get_queryset(request).select_related("form", "form__case", "batch")
        )


@admin.register(Batch)
class BatchAdmin(PracticeAwareAdminMixin, admin.ModelAdmin):
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
class CasePhaseHistoryAdmin(PracticeAwareAdminMixin, admin.ModelAdmin):
    """Admin for phase history audit trail"""

    list_display = (
        "submission_link",
        "form",
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
        "form",
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
        # The trail is immutable for staff. Superusers may delete it, which is
        # also what lets them delete a case or form: the admin refuses any
        # delete whose cascade reaches a model the user cannot delete.
        return request.user.is_superuser

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
        return (
            super().get_queryset(request).select_related("submission", "form", "user")
        )


@admin.register(SectionCTemplate)
class SectionCTemplateAdmin(PracticeAwareAdminMixin, admin.ModelAdmin):
    list_display = ("name", "created_at", "updated_at")
    search_fields = ("name", "content")
    ordering = ("name",)


@admin.register(CaseDraft)
class CaseDraftAdmin(PracticeAwareAdminMixin, admin.ModelAdmin):
    """Saved case-wizard state, one per user. Mainly for inspecting or clearing
    a user's stuck draft."""

    list_display = ("user", "current_step", "updated_at")
    search_fields = ("user__email", "user__given_names", "user__last_name")
    ordering = ("-updated_at",)
    list_select_related = ("user",)
