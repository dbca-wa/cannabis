"""Police permissions.

No custom permission classes are needed for the police app.
Police officers are data records, not system users who authenticate.
All police views use standard IsAuthenticated from DRF.
"""

__all__: list[str] = []
