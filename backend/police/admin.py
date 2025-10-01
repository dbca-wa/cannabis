from django.contrib import admin
from .models import PoliceStation, PoliceOfficer


@admin.register(PoliceStation)
class PoliceStationAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone', 'officer_count', 'created_at')
    list_filter = ('created_at', 'updated_at')
    search_fields = ('name', 'address', 'phone')
    ordering = ('name',)
    
    fieldsets = (
        ('Station Information', {
            'fields': ('name', 'address', 'phone'),
            'classes': ('wide',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    
    readonly_fields = ('created_at', 'updated_at')
    
    def officer_count(self, obj):
        """Display number of officers at this station"""
        return obj.officers.count()
    officer_count.short_description = 'Officers'
    officer_count.admin_order_field = 'officers__count'
    
    def get_queryset(self, request):
        """Optimize queryset with prefetch for officer count"""
        return super().get_queryset(request).prefetch_related('officers')


class PoliceStationInline(admin.TabularInline):
    """Inline for showing officers at a station"""
    model = PoliceOfficer
    extra = 0
    fields = ('full_name', 'badge_number', 'rank', 'is_sworn')
    readonly_fields = ('full_name', 'is_sworn')
    can_delete = False
    
    def has_add_permission(self, request, obj=None):
        return False


@admin.register(PoliceOfficer)
class PoliceOfficerAdmin(admin.ModelAdmin):
    list_display = (
        'full_name', 
        'badge_number', 
        'get_rank_display', 
        'is_sworn',
        'station', 
        'created_at'
    )
    list_filter = (
        'rank',
        'station',
        'created_at',
        'updated_at',
    )
    search_fields = (
        'first_name', 
        'last_name', 
        'badge_number',
        'station__name'
    )
    ordering = ('last_name', 'first_name')
    
    fieldsets = (
        ('Officer Information', {
            'fields': (
                ('first_name', 'last_name'),
                'badge_number',
                'rank',
            ),
            'classes': ('wide',),
        }),
        ('Assignment', {
            'fields': ('station',),
            'classes': ('wide',),
        }),
        ('Computed Fields', {
            'fields': ('full_name', 'is_sworn'),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    
    readonly_fields = ('full_name', 'is_sworn', 'created_at', 'updated_at')
    
    # Custom filters
    def get_queryset(self, request):
        """Optimize queryset with select_related for station"""
        return super().get_queryset(request).select_related('station')
    
    # Custom actions
    actions = ['mark_as_sworn', 'mark_as_unsworn', 'clear_station_assignment']
    
    def mark_as_sworn(self, request, queryset):
        """Mark selected officers as constables (sworn)"""
        updated = queryset.update(rank=PoliceOfficer.SeniorityChoices.CONSTABLE)
        self.message_user(request, f'{updated} officers marked as Constable (sworn)')
    mark_as_sworn.short_description = 'Mark selected officers as Constable (sworn)'
    
    def mark_as_unsworn(self, request, queryset):
        """Mark selected officers as unsworn"""
        updated = queryset.update(rank=PoliceOfficer.SeniorityChoices.UNSWORN)
        self.message_user(request, f'{updated} officers marked as unsworn')
    mark_as_unsworn.short_description = 'Mark selected officers as unsworn'
    
    def clear_station_assignment(self, request, queryset):
        """Clear station assignments for selected officers"""
        updated = queryset.update(station=None)
        self.message_user(request, f'Station assignments cleared for {updated} officers')
    clear_station_assignment.short_description = 'Clear station assignments'


# Add officers inline to PoliceStation admin
PoliceStationAdmin.inlines = [PoliceStationInline]