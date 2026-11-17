from django.contrib import admin
from django.contrib.auth.decorators import login_required
from django.urls import include, path

from core.views import dashboard


urlpatterns = [
    path("", dashboard, name="home"),
    path("sign-in/", dashboard, name="sign-in"),
    path("sign-up/", dashboard, name="sign-up"),
    path("workspace/", login_required(dashboard, login_url="sign-in"), name="workspace"),
    path("admin/", admin.site.urls),
    path("api/v1/", include("core.urls")),
]
