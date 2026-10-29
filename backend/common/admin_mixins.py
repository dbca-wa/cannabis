"""Shared admin behaviour for practice-capable and audited models.

Practice-capable models use ``RealManager`` as their default manager, which
hides practice rows outside a practice-mode request. The admin never runs in a
practice context, so without these mixins it would hide practice rows from
changelists, inlines, foreign-key dropdowns and filters, and reject saving any
record that points at a practice row. Admin is a superuser inspection tool, so
these mixins route every lookup through the unfiltered ``all_objects`` manager
and label practice rows wherever they are offered as a choice.
"""

from django.contrib import admin
from django.contrib.admin.utils import get_fields_from_path
from django.forms.models import BaseInlineFormSet

AUDIT_FIELDS = (
    "created_at",
    "updated_at",
    "created_by",
    "updated_by",
    "deleted_at",
    "deleted_by",
)
PRACTICE_FIELDS = ("is_practice", "practice_owner")


def _is_practice_capable(model):
    return model is not None and hasattr(model, "all_objects")


def _practice_label(obj):
    return f"{obj} [practice]" if getattr(obj, "is_practice", False) else str(obj)


def _all_rows_formfield(formfield, related_model):
    """Point a relation form field at every row and label practice rows."""
    if formfield is not None and _is_practice_capable(related_model):
        # Keep the ordering the admin chose (the related admin's, or the model's).
        ordering = formfield.queryset.query.order_by or related_model._meta.ordering
        formfield.queryset = related_model.all_objects.order_by(*ordering)
        formfield.label_from_instance = _practice_label
    return formfield


class AllObjectsRelatedFieldListFilter(admin.RelatedFieldListFilter):
    """Related-field filter whose choices include practice rows."""

    def field_choices(self, field, request, model_admin):
        ordering = self.field_admin_ordering(field, request, model_admin) or ()
        rows = field.related_model.all_objects.order_by(*ordering)
        return [(row.pk, _practice_label(row)) for row in rows]


class CreatorListFilter(admin.RelatedOnlyFieldListFilter):
    """Filter by the user who created a row, listing only users who have.

    Always rendered, even before any row has a recorded creator, so the
    "-" choice can be used to find rows created without one (for example by
    the ETL or before creators were recorded).
    """

    def has_output(self):
        return True


class _RelationFieldsMixin:
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        formfield = super().formfield_for_foreignkey(db_field, request, **kwargs)
        return _all_rows_formfield(formfield, db_field.related_model)

    def formfield_for_manytomany(self, db_field, request, **kwargs):
        formfield = super().formfield_for_manytomany(db_field, request, **kwargs)
        return _all_rows_formfield(formfield, db_field.related_model)

    def _all_rows_queryset(self, request):
        qs = self.model.all_objects.get_queryset()
        ordering = self.get_ordering(request)
        return qs.order_by(*ordering) if ordering else qs


class AllObjectsInlineFormSet(BaseInlineFormSet):
    """Inline formset whose hidden row-id field accepts practice rows.

    Django builds that field from the model's default manager rather than the
    formset's queryset, so without this every practice child row fails
    validation with "Select a valid choice" and the parent cannot be saved.
    """

    def add_fields(self, form, index):
        super().add_fields(form, index)
        pk_name = self._pk_field.name
        if pk_name in form.fields and _is_practice_capable(self.model):
            form.fields[pk_name].queryset = self.model.all_objects.all()


class PracticeAwareInlineMixin(_RelationFieldsMixin):
    """Inline that lists and edits practice children alongside real ones."""

    formset = AllObjectsInlineFormSet

    def get_queryset(self, request):
        if not _is_practice_capable(self.model):
            return super().get_queryset(request)
        qs = self._all_rows_queryset(request)
        if not self.has_view_or_change_permission(request):
            qs = qs.none()
        return qs


class PracticeAwareAdminMixin(_RelationFieldsMixin):
    """ModelAdmin that exposes every row and every model field.

    * Lists practice rows alongside real ones, with an ``is_practice`` filter.
    * Relation dropdowns and filters offer practice rows, labelled as such.
    * Any concrete model field missing from the declared fieldsets is appended
      in a "Practice" or "Audit" section (read-only for audit fields), so no
      stored data is hidden from the admin.
    """

    def get_queryset(self, request):
        if not _is_practice_capable(self.model):
            return super().get_queryset(request)
        return self._all_rows_queryset(request)

    def get_list_filter(self, request):
        filters = []
        for item in super().get_list_filter(request):
            if isinstance(item, str):
                try:
                    field = get_fields_from_path(self.model, item)[-1]
                except Exception:  # noqa: BLE001 - leave unusual entries untouched
                    field = None
                if (
                    field is not None
                    and field.is_relation
                    and _is_practice_capable(field.related_model)
                ):
                    filters.append((item, AllObjectsRelatedFieldListFilter))
                    continue
            filters.append(item)
        if _is_practice_capable(self.model) and "is_practice" not in filters:
            filters.append("is_practice")
        return filters

    def get_readonly_fields(self, request, obj=None):
        readonly = list(super().get_readonly_fields(request, obj))
        model_fields = {f.name for f in self.model._meta.concrete_fields}
        for name in AUDIT_FIELDS:
            if name in model_fields and name not in readonly:
                readonly.append(name)
        return readonly

    def get_fieldsets(self, request, obj=None):
        fieldsets = list(super().get_fieldsets(request, obj))
        declared = set()
        for _, opts in fieldsets:
            for entry in opts.get("fields", ()):
                declared.update(entry if isinstance(entry, (list, tuple)) else (entry,))
        model_fields = {f.name for f in self.model._meta.concrete_fields}
        exclude = set(self.get_exclude(request, obj) or ())

        def missing(names):
            return [
                n
                for n in names
                if n in model_fields and n not in declared and n not in exclude
            ]

        practice = missing(PRACTICE_FIELDS)
        audit = missing(AUDIT_FIELDS)
        if practice:
            fieldsets.append(
                ("Practice", {"fields": practice, "classes": ("collapse",)})
            )
            declared.update(practice)
        if audit:
            fieldsets.append(("Audit", {"fields": audit, "classes": ("collapse",)}))
            declared.update(audit)
        readonly = set(self.get_readonly_fields(request, obj))
        other = missing(
            f.name
            for f in self.model._meta.concrete_fields
            if f.name != self.model._meta.pk.name and (f.editable or f.name in readonly)
        )
        if other:
            fieldsets.append(("Other", {"fields": other, "classes": ("collapse",)}))
        return fieldsets
