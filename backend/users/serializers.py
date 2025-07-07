from medias.models import UserAvatar
from users.models import DBCAStaffProfile, PoliceStaffProfile, User
from rest_framework import serializers
from django.db import transaction


class UserSerializer(serializers.ModelSerializer):
    # Add fields for role and profile data
    role = serializers.CharField(required=False)

    # Make email optional and allow blank
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)

    # Police profile fields
    police_id = serializers.CharField(required=False, allow_blank=True)
    station_id = serializers.IntegerField(
        required=False, allow_null=True
    )  # Changed from station to station_id
    rank = serializers.CharField(required=False, allow_blank=True)
    is_sworn = serializers.BooleanField(required=False)

    # DBCA profile fields (if needed later)
    dbca_role = serializers.CharField(required=False, allow_blank=True)
    it_asset_id = serializers.IntegerField(required=False, allow_null=True)
    employee_id = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        exclude = ["password"]

    def validate_email(self, value):
        """Custom validation for email field"""
        # If email is empty/None, that's fine - return None for the database
        if not value or not value.strip():
            return None

        # If email is provided, validate it's unique
        email = value.strip()
        if self.instance:
            # For updates, exclude current instance
            if User.objects.filter(email=email).exclude(pk=self.instance.pk).exists():
                raise serializers.ValidationError(
                    "A user with this email already exists."
                )
        else:
            # For creation, check if email exists
            if User.objects.filter(email=email).exists():
                raise serializers.ValidationError(
                    "A user with this email already exists."
                )

        return email

    def create(self, validated_data):
        """Custom create method to handle profile creation"""
        # Extract profile-related data
        role = validated_data.pop("role", "none")
        police_id = validated_data.pop("police_id", "")
        station_id = validated_data.pop("station_id", None)
        rank = validated_data.pop("rank", "officer")
        is_sworn = validated_data.pop("is_sworn", False)

        # DBCA fields
        dbca_role = validated_data.pop("dbca_role", None)
        it_asset_id = validated_data.pop("it_asset_id", None)
        employee_id = validated_data.pop("employee_id", "")

        with transaction.atomic():
            # Create the user using the custom manager
            # The manager expects username as the first parameter (swapped from email due to external users)
            username = validated_data.pop("username")
            email = validated_data.pop("email", None)

            user = User.objects.create_user(
                username=username, email=email, **validated_data
            )

            # Create profile based on role
            self._handle_role_update(
                user,
                role,
                {
                    "police_id": police_id,
                    "station_id": station_id,
                    "rank": rank,
                    "is_sworn": is_sworn,
                    "dbca_role": dbca_role,
                    "it_asset_id": it_asset_id,
                    "employee_id": employee_id,
                },
            )

            return user

    def create(self, validated_data):
        """Custom create method to handle profile creation"""
        # Extract profile-related data
        role = validated_data.pop("role", "none")
        police_id = validated_data.pop("police_id", "")
        station_id = validated_data.pop("station_id", None)
        rank = validated_data.pop("rank", "officer")
        is_sworn = validated_data.pop("is_sworn", False)

        # DBCA fields
        dbca_role = validated_data.pop("dbca_role", None)
        it_asset_id = validated_data.pop("it_asset_id", None)
        employee_id = validated_data.pop("employee_id", "")

        with transaction.atomic():
            # Create the user
            user = User.objects.create_user(**validated_data)

            # Create profile based on role
            self._handle_role_update(
                user,
                role,
                {
                    "police_id": police_id,
                    "station_id": station_id,
                    "rank": rank,
                    "is_sworn": is_sworn,
                    "dbca_role": dbca_role,
                    "it_asset_id": it_asset_id,
                    "employee_id": employee_id,
                },
            )

            return user

    def update(self, instance, validated_data):
        # Extract profile-related data
        role = validated_data.pop("role", None)
        police_id = validated_data.pop("police_id", None)
        station_id = validated_data.pop(
            "station_id", None
        )  # Changed from station to station_id
        rank = validated_data.pop("rank", None)
        is_sworn = validated_data.pop("is_sworn", None)

        # DBCA fields
        dbca_role = validated_data.pop("dbca_role", None)
        it_asset_id = validated_data.pop("it_asset_id", None)
        employee_id = validated_data.pop("employee_id", None)

        with transaction.atomic():
            # Update base user fields
            instance = super().update(instance, validated_data)

            if role is not None:
                self._handle_role_update(
                    instance,
                    role,
                    {
                        "police_id": police_id,
                        "station_id": station_id,  # Changed from station to station_id
                        "rank": rank,
                        "is_sworn": is_sworn,
                        "dbca_role": dbca_role,
                        "it_asset_id": it_asset_id,
                        "employee_id": employee_id,
                    },
                )

            return instance

    def _handle_role_update(self, user, role, profile_data):
        """Handle role changes and profile creation/deletion"""

        # Remove existing profiles if role is changing
        if role == "none":
            # Remove both profiles
            if hasattr(user, "dbca_staff_profile"):
                user.dbca_staff_profile.delete()
            if hasattr(user, "police_staff_profile"):
                user.police_staff_profile.delete()

        elif role == "police":
            # Remove DBCA profile if exists
            if hasattr(user, "dbca_staff_profile"):
                user.dbca_staff_profile.delete()

            # Create or update police profile
            police_profile, created = PoliceStaffProfile.objects.get_or_create(
                user=user,
                defaults={
                    "police_id": profile_data.get("police_id", ""),
                    "seniority": profile_data.get("rank", "officer"),
                    "sworn": profile_data.get("is_sworn", False),
                },
            )

            if not created:
                # Update existing profile
                if profile_data.get("police_id") is not None:
                    police_profile.police_id = profile_data["police_id"]
                if profile_data.get("rank") is not None:
                    police_profile.seniority = profile_data["rank"]
                if profile_data.get("is_sworn") is not None:
                    police_profile.sworn = profile_data["is_sworn"]
                police_profile.save()

            # Handle station membership
            station_id = profile_data.get("station_id")
            if station_id:
                try:
                    from organisations.models import (
                        PoliceStation,
                        PoliceStationMembership,
                    )

                    station = PoliceStation.objects.get(id=station_id)

                    # Create or update station membership
                    membership, membership_created = (
                        PoliceStationMembership.objects.get_or_create(
                            user=user, defaults={"station": station}
                        )
                    )

                    if not membership_created:
                        membership.station = station
                        membership.save()

                    # Link the membership to the police profile
                    police_profile.station_membership = membership
                    police_profile.save()

                except PoliceStation.DoesNotExist:
                    pass  # Invalid station ID, ignore

        elif role in ["botanist", "finance"]:
            # Remove police profile if exists
            if hasattr(user, "police_staff_profile"):
                user.police_staff_profile.delete()

            # Create or update DBCA profile
            dbca_profile, created = DBCAStaffProfile.objects.get_or_create(
                user=user,
                defaults={
                    "role": role,
                    "it_asset_id": profile_data.get("it_asset_id"),
                    "employee_id": profile_data.get("employee_id", ""),
                },
            )

            if not created:
                # Update existing profile
                dbca_profile.role = role
                if profile_data.get("it_asset_id") is not None:
                    dbca_profile.it_asset_id = profile_data["it_asset_id"]
                if profile_data.get("employee_id") is not None:
                    dbca_profile.employee_id = profile_data["employee_id"]
                dbca_profile.save()

    def to_representation(self, instance):
        """Add profile data to the serialized output"""
        data = super().to_representation(instance)

        # Add role information
        data["role"] = self._get_user_role(instance)

        # Add police_data structure to match UserDetail interface
        if hasattr(instance, "police_staff_profile"):
            profile = instance.police_staff_profile

            # Create police_data object matching IPoliceData interface
            station_data = None
            if profile.station_membership and profile.station_membership.station:
                station_data = {
                    "id": profile.station_membership.station.id,
                    "name": profile.station_membership.station.name,
                }

            data["police_data"] = {
                "user": {
                    "id": instance.id,
                    "first_name": instance.first_name,
                    "last_name": instance.last_name,
                },
                "station": station_data,
                "police_id": profile.police_id or "",
                "sworn": profile.sworn,
                "seniority": profile.seniority,
            }

            # Also add flat fields for form compatibility
            data.update(
                {
                    "police_id": profile.police_id or "",
                    "station_id": station_data["id"] if station_data else None,
                    "rank": profile.seniority,
                    "is_sworn": profile.sworn,
                }
            )
        else:
            # Set police_data to None when no police profile exists
            data["police_data"] = None
            # Set flat fields to empty/default values
            data.update(
                {
                    "police_id": "",
                    "station_id": None,
                    "rank": "",
                    "is_sworn": False,
                }
            )

        # Add DBCA profile data if exists
        if hasattr(instance, "dbca_staff_profile"):
            profile = instance.dbca_staff_profile
            data.update(
                {
                    "dbca_role": profile.role,
                    "it_asset_id": profile.it_asset_id,
                    "employee_id": profile.employee_id,
                }
            )

        return data

    def _get_user_role(self, obj):
        """Return the user's role type: 'dbca', 'police', or 'none'"""
        try:
            profile = obj.dbca_staff_profile
            return profile.role  # Returns 'botanist', 'finance', etc.
        except DBCAStaffProfile.DoesNotExist:
            pass

        try:
            obj.police_staff_profile
            return "police"
        except PoliceStaffProfile.DoesNotExist:
            pass

        return "none"


class TinyUserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "name",
            "username",
            "email",
            "is_staff",
            "is_superuser",
            "role",
        )

    def get_name(self, obj):
        return obj.get_display_name()

    def get_role(self, obj):
        """Return the user's role type: 'dbca', 'police', or 'none'"""
        try:
            profile = obj.dbca_staff_profile
            return profile.role  # Returns 'botanist', 'finance', etc.
        except DBCAStaffProfile.DoesNotExist:
            pass

        try:
            obj.police_staff_profile
            return "police"
        except PoliceStaffProfile.DoesNotExist:
            pass

        return "none"


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = User
        fields = ("email", "username", "password")

    def validate_email(self, value):
        """Check if email already exists"""
        if not value or not value.strip():
            return None

        email = value.strip()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("Email already registered")
        return email

    def validate_username(self, value):
        """Check if username already exists"""
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already taken")
        return value


class UserAvatarSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAvatar
        fields = ("id", "image")
