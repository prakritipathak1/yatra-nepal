from django.contrib.auth.models import User
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from users.serializers import LoginSerializer, RegisterSerializer, UserSerializer


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, profile = serializer.save()
        tokens = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(tokens.access_token),
                "refresh": str(tokens),
                "user": UserSerializer(user).data,
                "profile": {
                    "user_type": profile.user_type,
                    "home_city": profile.home_city,
                    "home_location": (
                        {"lat": profile.home_location.y, "lon": profile.home_location.x}
                        if profile.home_location
                        else None
                    ),
                    "nationality": profile.nationality,
                    "phone": profile.phone,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        tokens = RefreshToken.for_user(user)
        profile = getattr(user, "profile", None)
        return Response(
            {
                "access": str(tokens.access_token),
                "refresh": str(tokens),
                "user": UserSerializer(user).data,
                "profile": {
                    "user_type": profile.user_type if profile else None,
                    "home_city": profile.home_city if profile else None,
                    "home_location": (
                        {"lat": profile.home_location.y, "lon": profile.home_location.x}
                        if profile and profile.home_location
                        else None
                    ),
                    "nationality": profile.nationality if profile else None,
                    "phone": profile.phone if profile else None,
                },
            }
        )
