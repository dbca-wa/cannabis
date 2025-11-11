"""
Custom pagination classes for the cannabis management system.
Based on patterns from spms.
"""

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from collections import OrderedDict


class StandardResultsSetPagination(PageNumberPagination):
    """
    Standard pagination class that provides consistent pagination across all endpoints.

    Features:
    - Configurable page size via 'limit' query parameter
    - Consistent response structure
    - Proper handling of user preferences for items_per_page
    """

    page_size = 25  # Default page size (matches frontend default)
    page_size_query_param = "limit"  # Allow frontend to control page size
    max_page_size = 100  # Maximum allowed page size

    def get_paginated_response(self, data):
        """
        Return a paginated style Response with consistent structure.
        This matches the expected frontend response format.
        """
        return Response(
            OrderedDict(
                [
                    ("count", self.page.paginator.count),
                    ("next", self.get_next_link()),
                    ("previous", self.get_previous_link()),
                    ("results", data),
                ]
            )
        )

    def get_page_size(self, request):
        """
        Get the page size for the request.
        Respects the user's items_per_page preference if available.
        """
        # First check if limit is provided in query params
        if self.page_size_query_param:
            try:
                page_size = int(request.query_params[self.page_size_query_param])
                if page_size > 0:
                    return min(page_size, self.max_page_size)
            except (KeyError, ValueError):
                pass

        # Check if user has a preference set
        if hasattr(request, "user") and request.user.is_authenticated:
            try:
                user_preferences = request.user.get_preferences()
                if user_preferences and user_preferences.items_per_page:
                    return min(user_preferences.items_per_page, self.max_page_size)
            except Exception:
                # If there's any error getting user preferences, fall back to default
                pass

        # Fall back to default page size
        return self.page_size
