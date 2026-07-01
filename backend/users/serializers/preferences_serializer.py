"""User preferences serializers."""

from rest_framework import serializers

from users.models import UserPreferences


class UserPreferencesSerializer(serializers.ModelSerializer):
    """Serializer for user preferences"""

    class Meta:
        model = UserPreferences
        exclude = ["user"]

    def to_representation(self, instance):
        """Add computed fields for frontend"""
        data = super().to_representation(instance)

        # Add helper methods as computed fields
        data["is_dark_mode"] = instance.is_dark_mode()
        data["css_theme_class"] = instance.get_css_theme_class()
        data["display_preferences"] = instance.get_display_preferences()

        return data

    def validate_default_search_settings(self, value):
        """Validate search settings JSON structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Search settings must be a JSON object")
        return value

    def validate_table_filter_preferences(self, value):
        """Validate table filter preferences JSON structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError(
                "Table filter preferences must be a JSON object"
            )
        return value

    def validate_ui_preferences(self, value):
        """Validate UI preferences JSON structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("UI preferences must be a JSON object")
        return value
