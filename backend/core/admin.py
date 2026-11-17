from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin
from core.models import Security


@admin.register(Security)
class SecurityAdmin(admin.ModelAdmin):
    list_display = ("symbol", "exchange", "name")
    search_fields = ("symbol", "exchange", "name")

    def has_delete_permission(self, request, obj=None):
        return False


class ResearchUserAdmin(UserAdmin):
    # Deactivation preserves research history and works under the restricted app role.
    def has_delete_permission(self, request, obj=None):
        return False


admin.site.unregister(get_user_model())
admin.site.register(get_user_model(), ResearchUserAdmin)
admin.site.site_header = "ThesisWatch administration"
