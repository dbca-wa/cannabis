from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import (
    Defendant,
    Submission,
    DrugBag,
    BotanicalAssessment,
    Certificate,
    Invoice,
    AdditionalInvoiceFee,
)


# ============================================================================
# INLINE ADMIN CLASSES
# ============================================================================


class DrugBagInline(admin.TabularInline):
    """Inline for drug bags in submission admin"""

    model = DrugBag
    extra = 0
    fields = (
        "seal_tag_numbers",
        "content_type",
        "property_reference",
    )
    readonly_fields = ("created_at",)


class BotanicalAssessmentInline(admin.StackedInline):
    """Inline for botanical assessment in drug bag admin"""

    model = BotanicalAssessment
    extra = 0
    fields = ("determination", "assessment_date", "botanist_notes")
    readonly_fields = ("created_at", "updated_at")


class CertificateInline(admin.TabularInline):
    """Inline for certificates in submission admin"""

    model = Certificate
    extra = 0
    fields = ("certificate_number", "pdf_generating", "pdf_file", "pdf_size")
    readonly_fields = ("certificate_number", "pdf_size", "created_at")


class InvoiceInline(admin.TabularInline):
    """Inline for invoices in submission admin"""

    model = Invoice
    extra = 0
    fields = ("invoice_number", "customer_number", "total", "pdf_generating")
    readonly_fields = ("invoice_number", "subtotal", "tax_amount", "total")


class AdditionalInvoiceFeeInline(admin.TabularInline):
    """Inline for additional fees in submission admin"""

    model = AdditionalInvoiceFee
    extra = 0
    fields = ("claim_kind", "units", "description", "calculated_cost")
    readonly_fields = ("calculated_cost",)


# ============================================================================
# MODEL ADMIN CLASSES
# ============================================================================


@admin.register(Defendant)
class DefendantAdmin(admin.ModelAdmin):
    list_display = ("id", "pdf_name", "submission_count", "created_at")
    search_fields = ("first_name", "last_name")
    ordering = ("last_name", "first_name")

    fieldsets = (
        (
            "Personal Information",
            {
                "fields": ("first_name", "last_name"),
                "classes": ("wide",),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    readonly_fields = ("created_at", "updated_at")

    def submission_count(self, obj):
        """Count of submissions this defendant is involved in"""
        count = obj.submissions.count()
        if count > 0:
            return format_html(
                '<a href="{}?defendants__id__exact={}">{} submissions</a>',
                reverse("admin:submissions_submission_changelist"),
                obj.id,
                count,
            )
        return "No submissions"

    submission_count.short_description = "Submissions"


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
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
        "requesting_officer__first_name",
        "requesting_officer__last_name",
        "defendants__first_name",
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
                "fields": ("approved_botanist", "finance_officer"),
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
            {
                "fields": ("defendants",),
                "classes": ("wide",),
            },
        ),
        (
            "Workflow",
            {
                "fields": ("phase", "internal_comments"),
                "classes": ("wide",),
            },
        ),
        (
            "Workflow Timestamps",
            {
                "fields": (
                    "finance_approved_at",
                    "botanist_approved_at",
                    "certificates_generated_at",
                    "invoices_generated_at",
                    "emails_sent_at",
                    "completed_at",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Audit",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    readonly_fields = (
        "created_at",
        "updated_at",
        "finance_approved_at",
        "botanist_approved_at",
        "certificates_generated_at",
        "invoices_generated_at",
        "emails_sent_at",
        "completed_at",
    )

    filter_horizontal = ("defendants",)

    inlines = [
        DrugBagInline,
        CertificateInline,
        InvoiceInline,
        AdditionalInvoiceFeeInline,
    ]

    # Custom actions
    actions = ["advance_to_finance", "advance_to_botanist", "mark_complete"]

    def phase_colored(self, obj):
        """Color-coded phase display"""
        colors = {
            "data_entry_start": "#6c757d",
            "finance_approval_provided": "#17a2b8",
            "botanist_approval_provided": "#28a745",
            "in_review": "#ffc107",
            "certificate_generation_start": "#6f42c1",
            "invoice_generation_start": "#e83e8c",
            "sending_emails": "#fd7e14",
            "complete": "#28a745",
        }
        color = colors.get(obj.phase, "#6c757d")
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">{}</span>',
            color,
            obj.get_phase_display(),
        )

    phase_colored.short_description = "Phase"

    def bags_count(self, obj):
        """Display number of bags"""
        count = obj.bags.count()
        return format_html(
            '<span style="background: #e8f4fd; padding: 2px 6px; border-radius: 3px;">{} bags</span>',
            count,
        )

    bags_count.short_description = "Bags"

    def cannabis_status(self, obj):
        """Show cannabis presence status"""
        if obj.cannabis_present:
            return format_html(
                '<span style="background: #d4edda; color: #155724; padding: 2px 6px; border-radius: 3px;">Cannabis Present</span>'
            )
        else:
            return format_html(
                '<span style="background: #f8d7da; color: #721c24; padding: 2px 6px; border-radius: 3px;">No Cannabis</span>'
            )

    cannabis_status.short_description = "Cannabis"

    def advance_to_finance(self, request, queryset):
        """Move submissions to finance approval"""
        updated = queryset.update(
            phase=Submission.PhaseChoices.FINANCE_APPROVAL_PROVIDED
        )
        self.message_user(request, f"{updated} submissions moved to finance approval")

    advance_to_finance.short_description = "Advance to finance approval"

    def advance_to_botanist(self, request, queryset):
        """Move submissions to botanist approval"""
        updated = queryset.update(
            phase=Submission.PhaseChoices.BOTANIST_APPROVAL_PROVIDED
        )
        self.message_user(request, f"{updated} submissions moved to botanist approval")

    advance_to_botanist.short_description = "Advance to botanist approval"

    def mark_complete(self, request, queryset):
        """Mark submissions as complete"""
        from django.utils import timezone

        updated = queryset.update(
            phase=Submission.PhaseChoices.COMPLETE, completed_at=timezone.now()
        )
        self.message_user(request, f"{updated} submissions marked as complete")

    mark_complete.short_description = "Mark as complete"

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
    list_filter = (
        "content_type",
        "submission__phase",
        "created_at",
    )
    search_fields = (
        "seal_tag_numbers",
        "new_seal_tag_numbers",
        "property_reference",
        "submission__case_number",
    )
    ordering = ("-created_at",)

    fieldsets = (
        (
            "Bag Information",
            {
                "fields": ("submission", "content_type"),
                "classes": ("wide",),
            },
        ),
        (
            "Identification",
            {
                "fields": (
                    "seal_tag_numbers",
                    "new_seal_tag_numbers",
                    "property_reference",
                ),
                "classes": ("wide",),
            },
        ),
        (
            "Weight Measurements",
            {
                "fields": ("gross_weight", "net_weight"),
                "classes": ("collapse",),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    readonly_fields = ("created_at", "updated_at")
    inlines = [BotanicalAssessmentInline]

    def submission_link(self, obj):
        """Link to parent submission"""
        url = reverse("admin:submissions_submission_change", args=[obj.submission.pk])
        return format_html('<a href="{}">{}</a>', url, obj.submission.case_number)

    submission_link.short_description = "Submission"

    def assessment_status(self, obj):
        """Show assessment status"""
        if hasattr(obj, "assessment"):
            if obj.assessment.determination:
                color = "#28a745" if obj.assessment.is_cannabis else "#6c757d"
                return format_html(
                    '<span style="background: {}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">{}</span>',
                    color,
                    obj.assessment.get_determination_display(),
                )
            else:
                return format_html(
                    '<span style="background: #ffc107; color: #212529; padding: 2px 6px; border-radius: 3px; font-size: 11px;">Pending</span>'
                )
        else:
            return format_html(
                '<span style="background: #f8d7da; color: #721c24; padding: 2px 6px; border-radius: 3px; font-size: 11px;">Not Assessed</span>'
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
    list_display = (
        "drug_bag_link",
        "determination_colored",
        "assessment_date",
        "created_at",
    )
    list_filter = (
        "determination",
        "assessment_date",
        "created_at",
    )
    search_fields = (
        "drug_bag__seal_tag_numbers",
        "drug_bag__submission__case_number",
        "botanist_notes",
    )
    ordering = ("-created_at",)

    fieldsets = (
        (
            "Assessment Details",
            {
                "fields": ("drug_bag", "determination", "assessment_date"),
                "classes": ("wide",),
            },
        ),
        (
            "Notes",
            {
                "fields": ("botanist_notes",),
                "classes": ("wide",),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    readonly_fields = ("created_at", "updated_at")

    def drug_bag_link(self, obj):
        """Link to drug bag"""
        url = reverse("admin:submissions_drugbag_change", args=[obj.drug_bag.pk])
        return format_html('<a href="{}">{}</a>', url, obj.drug_bag.seal_tag_numbers)

    drug_bag_link.short_description = "Drug Bag"

    def determination_colored(self, obj):
        """Color-coded determination"""
        if obj.determination:
            color = "#28a745" if obj.is_cannabis else "#6c757d"
            return format_html(
                '<span style="background: {}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">{}</span>',
                color,
                obj.get_determination_display(),
            )
        return "Not determined"

    determination_colored.short_description = "Determination"


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = (
        "certificate_number",
        "submission_link",
        "pdf_status",
        "pdf_size_formatted",
        "created_at",
    )
    list_filter = (
        "pdf_generating",
        "created_at",
    )
    search_fields = (
        "certificate_number",
        "submission__case_number",
    )
    ordering = ("-created_at",)

    readonly_fields = ("certificate_number", "pdf_size", "created_at", "updated_at")

    def submission_link(self, obj):
        """Link to submission"""
        url = reverse("admin:submissions_submission_change", args=[obj.submission.pk])
        return format_html('<a href="{}">{}</a>', url, obj.submission.case_number)

    submission_link.short_description = "Submission"

    def pdf_status(self, obj):
        """PDF generation status"""
        if obj.pdf_generating:
            return format_html(
                '<span style="background: #ffc107; color: #212529; padding: 2px 6px; border-radius: 3px;">Generating...</span>'
            )
        elif obj.pdf_file:
            return format_html(
                '<span style="background: #28a745; color: white; padding: 2px 6px; border-radius: 3px;">Ready</span>'
            )
        else:
            return format_html(
                '<span style="background: #6c757d; color: white; padding: 2px 6px; border-radius: 3px;">Not Generated</span>'
            )

    pdf_status.short_description = "PDF Status"

    def pdf_size_formatted(self, obj):
        """Format PDF size"""
        if obj.pdf_size > 0:
            return f"{obj.pdf_size / 1024:.1f} KB"
        return "0 KB"

    pdf_size_formatted.short_description = "PDF Size"


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = (
        "invoice_number",
        "submission_link",
        "customer_number",
        "total",
        "pdf_status",
        "created_at",
    )
    list_filter = (
        "pdf_generating",
        "created_at",
    )
    search_fields = (
        "invoice_number",
        "customer_number",
        "submission__case_number",
    )
    ordering = ("-created_at",)

    readonly_fields = (
        "invoice_number",
        "subtotal",
        "tax_amount",
        "total",
        "pdf_size",
        "created_at",
        "updated_at",
    )

    def submission_link(self, obj):
        """Link to submission"""
        url = reverse("admin:submissions_submission_change", args=[obj.submission.pk])
        return format_html('<a href="{}">{}</a>', url, obj.submission.case_number)

    submission_link.short_description = "Submission"

    def pdf_status(self, obj):
        """PDF generation status"""
        if obj.pdf_generating:
            return format_html(
                '<span style="background: #ffc107; color: #212529; padding: 2px 6px; border-radius: 3px;">Generating...</span>'
            )
        elif obj.pdf_file:
            return format_html(
                '<span style="background: #28a745; color: white; padding: 2px 6px; border-radius: 3px;">Ready</span>'
            )
        else:
            return format_html(
                '<span style="background: #6c757d; color: white; padding: 2px 6px; border-radius: 3px;">Not Generated</span>'
            )

    pdf_status.short_description = "PDF Status"


@admin.register(AdditionalInvoiceFee)
class AdditionalInvoiceFeeAdmin(admin.ModelAdmin):
    list_display = (
        "submission_link",
        "claim_kind",
        "units",
        "calculated_cost",
        "description",
        "created_at",
    )
    list_filter = (
        "claim_kind",
        "created_at",
    )
    search_fields = (
        "submission__case_number",
        "description",
    )
    ordering = ("-created_at",)

    readonly_fields = ("calculated_cost", "created_at", "updated_at")

    def submission_link(self, obj):
        """Link to submission"""
        url = reverse("admin:submissions_submission_change", args=[obj.submission.pk])
        return format_html('<a href="{}">{}</a>', url, obj.submission.case_number)

    submission_link.short_description = "Submission"
