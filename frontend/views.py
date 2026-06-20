from django.shortcuts import render, redirect
from django.views.generic import TemplateView
from django.views import View
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.mixins import LoginRequiredMixin
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from rest_framework.authentication import SessionAuthentication

from users.models import UserProfile


class IndexView(TemplateView):
    template_name = "index.html"


class PlanTripView(LoginRequiredMixin, TemplateView):
    template_name = "plan_trip.html"
    login_url = "/login/"


class DashboardView(LoginRequiredMixin, TemplateView):
    template_name = "dashboard.html"
    login_url = "/login/"


class GisExplorerView(LoginRequiredMixin, TemplateView):
    template_name = "gis_explorer.html"
    login_url = "/login/"


class LoginView(View):
    def get(self, request):
        if request.user.is_authenticated:
            return redirect("/")
        return render(request, "login.html")

    def post(self, request):
        email = request.POST.get("email")
        password = request.POST.get("password")
        
        # Authenticate against username/email
        user = authenticate(request, username=email, password=password)
        if user is not None:
            login(request, user)
            return redirect(request.GET.get("next", "/"))
        else:
            return render(request, "login.html", {"error": "Invalid email/username or password."})


class SignupView(View):
    def get(self, request):
        if request.user.is_authenticated:
            return redirect("/")
        return render(request, "signup.html")

    def post(self, request):
        name = request.POST.get("name")
        email = request.POST.get("email")
        password = request.POST.get("password")
        phone = request.POST.get("phone")
        home_city = request.POST.get("home_city")
        nationality = request.POST.get("nationality")
        user_type = request.POST.get("user_type")
        signup_code = request.POST.get("signup_code")

        if signup_code != settings.SIGNCODE:
            return render(request, "signup.html", {"error": "Invalid signup verification code."})

        if User.objects.filter(username__iexact=email).exists() or User.objects.filter(email__iexact=email).exists():
            return render(request, "signup.html", {"error": "An account with this email already exists."})

        try:
            # Create user and profile
            user = User.objects.create_user(
                username=email,
                email=email,
                password=password,
                first_name=name.split(" ", 1)[0],
                last_name=name.split(" ", 1)[1] if " " in name else "",
            )
            UserProfile.objects.create(
                user=user,
                user_type=user_type,
                home_city=home_city,
                nationality=nationality,
                phone=phone,
            )
            # Authenticate and login
            authenticated_user = authenticate(request, username=email, password=password)
            if authenticated_user:
                login(request, authenticated_user)
            return redirect("/")
        except Exception as e:
            return render(request, "signup.html", {"error": f"Registration failed: {str(e)}"})


class LogoutView(View):
    def get(self, request):
        logout(request)
        return redirect("/")


class MapConfigView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"key": getattr(settings, "GOOGLE_MAPS_API_KEY", "")})
