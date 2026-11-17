from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Security
from core.tenancy import owner_scope

from .models import ResearchRun, Thesis
from .service import ResearchAccessDenied, ResearchLimit, is_enabled, request_research


class RunSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResearchRun
        fields = ("id", "status", "created_at", "started_at", "finished_at", "error")


class ThesisSerializer(serializers.ModelSerializer):
    class Meta:
        model = Thesis
        fields = ("id", "version", "created_at", "model", "report", "sources")


@method_decorator(never_cache, name="dispatch")
class SecurityResearch(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, security_id):
        get_object_or_404(Security, pk=security_id)
        owner_id = request.user.pk
        with owner_scope(owner_id):
            runs = ResearchRun.objects.filter(owner_id=owner_id, security_id=security_id).order_by("-pk")[:25]
            theses = Thesis.objects.filter(owner_id=owner_id, security_id=security_id).order_by("-version")
            return Response(
                {
                    "enabled": is_enabled(),
                    "runs": RunSerializer(runs, many=True).data,
                    "theses": ThesisSerializer(theses, many=True).data,
                }
            )

    def post(self, request, security_id):
        security = get_object_or_404(Security, pk=security_id)
        if not is_enabled():
            return Response(
                {"detail": "Research is not enabled in this environment."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        try:
            run = request_research(request.user.pk, security)
        except ResearchAccessDenied as exc:
            raise PermissionDenied("The research account is no longer active.") from exc
        except ResearchLimit as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        return Response(RunSerializer(run).data, status=status.HTTP_202_ACCEPTED)
