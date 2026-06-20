from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import serializers

from yatranepal.geometry import Point, parse_point_value
from users.models import UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    home_location = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            "user_type",
            "home_city",
            "home_location",
            "nationality",
            "phone",
            "created_at",
        ]

    def get_home_location(self, obj):
        parsed = parse_point_value(obj.home_location)
        if not parsed:
            return None
        lon, lat = parsed
        return {
            "lat": lat,
            "lon": lon,
            "coordinates": [lon, lat],
        }


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "profile"]


class RegisterSerializer(serializers.Serializer):
    user_type = serializers.ChoiceField(choices=UserProfile.USER_TYPE_CHOICES)
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20)
    home_city = serializers.CharField(max_length=100)
    nationality = serializers.CharField(max_length=50)
    password = serializers.CharField(write_only=True, min_length=8)
    signup_code = serializers.CharField(write_only=True)
    home_location_lat = serializers.FloatField(required=False, allow_null=True)
    home_location_lon = serializers.FloatField(required=False, allow_null=True)

    def validate_signup_code(self, value):
        from django.conf import settings
        if value != settings.SIGNCODE:
            raise serializers.ValidationError("Invalid signup verification code.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated_data):
        validated_data.pop("signup_code", None)
        lat = validated_data.pop("home_location_lat", None)
        lon = validated_data.pop("home_location_lon", None)
        password = validated_data.pop("password")
        name = validated_data.pop("name")
        email = validated_data.pop("email")

        username = email
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=name.split(" ", 1)[0],
            last_name=name.split(" ", 1)[1] if " " in name else "",
        )

        home_location = Point(lon, lat, srid=4326) if lat is not None and lon is not None else None
        profile = UserProfile.objects.create(user=user, home_location=home_location, **validated_data)
        return user, profile


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")
        user = authenticate(username=email, password=password)
        if not user:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("This account is disabled.")
        attrs["user"] = user
        return attrs
