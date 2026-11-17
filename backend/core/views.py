import json

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.db import DatabaseError, IntegrityError
from django.db.models import Prefetch, Q
from django.http import FileResponse, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.csrf import csrf_failure as django_csrf_failure
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_http_methods
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Security, SecurityNote, Watchlist, WatchlistEntry
from core.serializers import EntrySerializer, NoteSerializer, SecuritySerializer, WatchlistSerializer
from core.tenancy import owner_scope


@require_GET
@never_cache
def dashboard(request):
    try:
        index = (settings.UI_DIST_DIR / "index.html").open("rb")
    except FileNotFoundError:
        return JsonResponse({"detail": "The dashboard build is unavailable."}, status=503)
    return FileResponse(index, content_type="text/html; charset=utf-8")


@require_GET
def health(request):
    return JsonResponse({"status": "ok"})


@require_GET
@never_cache
def ready(request):
    try:
        Security.objects.exists()
    except DatabaseError:
        return JsonResponse({"status": "unavailable"}, status=503)
    return JsonResponse({"status": "ok"})


def csrf_failure(request, reason=""):
    if request.path.startswith("/api/"):
        return JsonResponse({"detail": "Security token expired. Reload the page and try again."}, status=403)
    return django_csrf_failure(request, reason=reason)


@csrf_protect
@ensure_csrf_cookie
@never_cache
@require_http_methods(["GET", "POST", "DELETE"])
def session(request):
    if request.method == "DELETE":
        logout(request)
        return HttpResponse(status=204)
    if request.method == "POST":
        if request.content_type != "application/json":
            return JsonResponse({"detail": "Send credentials as JSON."}, status=415)
        try:
            data = json.loads(request.body)
        except (ValueError, UnicodeError):
            data = None
        username = data.get("username") if isinstance(data, dict) else None
        password = data.get("password") if isinstance(data, dict) else None
        if not isinstance(username, str) or not isinstance(password, str):
            return JsonResponse({"detail": "Enter a username and password."}, status=400)
        if len(username) > 150 or len(password) > 4096:
            return JsonResponse({"detail": "Invalid username or password."}, status=403)
        user = authenticate(request=request, username=username.strip(), password=password)
        if user is None:
            return JsonResponse({"detail": "Invalid username or password."}, status=403)
        login(request, user)

    user = request.user
    return JsonResponse({"user": {"id": user.pk, "username": user.get_username()} if user.is_authenticated else None})


class SecurityList(APIView):
    def get(self, request):
        query = request.query_params.get("q", "").strip()[:160]
        securities = Security.objects.all()
        if query:
            securities = securities.filter(
                Q(symbol__icontains=query) | Q(exchange__iexact=query) | Q(name__icontains=query)
            )
        return Response(SecuritySerializer(securities[:25], many=True).data)


def owned_watchlist(request, watchlist_id, *, lock=False):
    watchlists = Watchlist.objects.filter(owner=request.user)
    if lock:
        watchlists = watchlists.select_for_update()
    return get_object_or_404(watchlists, pk=watchlist_id)


class Watchlists(APIView):
    def get(self, request):
        with owner_scope(request.user.pk):
            watchlists = Watchlist.objects.filter(owner=request.user).prefetch_related(
                Prefetch("entries", queryset=WatchlistEntry.objects.select_related("security"))
            )
            return Response(WatchlistSerializer(watchlists, many=True).data)

    def post(self, request):
        serializer = WatchlistSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with owner_scope(request.user.pk):
                serializer.save(owner=request.user)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
        except IntegrityError:
            return Response({"detail": "You already have a watchlist with this name."}, status=409)


class WatchlistDetail(APIView):
    def patch(self, request, watchlist_id):
        try:
            with owner_scope(request.user.pk):
                watchlist = owned_watchlist(request, watchlist_id, lock=True)
                serializer = WatchlistSerializer(watchlist, data=request.data)
                serializer.is_valid(raise_exception=True)
                serializer.save()
                return Response(serializer.data)
        except IntegrityError:
            return Response({"detail": "You already have a watchlist with this name."}, status=409)

    def delete(self, request, watchlist_id):
        with owner_scope(request.user.pk):
            owned_watchlist(request, watchlist_id, lock=True).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class Entries(APIView):
    def post(self, request, watchlist_id):
        with owner_scope(request.user.pk):
            watchlist = owned_watchlist(request, watchlist_id, lock=True)
            serializer = EntrySerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            entry, created = WatchlistEntry.objects.get_or_create(
                watchlist=watchlist, security=serializer.validated_data["security"]
            )
            if not created:
                return Response({"detail": "This stock is already in the watchlist."}, status=409)
            return Response(EntrySerializer(entry).data, status=status.HTTP_201_CREATED)


class EntryDetail(APIView):
    def delete(self, request, watchlist_id, entry_id):
        with owner_scope(request.user.pk):
            watchlist = owned_watchlist(request, watchlist_id, lock=True)
            get_object_or_404(watchlist.entries, pk=entry_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class Note(APIView):
    def get(self, request, security_id):
        get_object_or_404(Security, pk=security_id)
        with owner_scope(request.user.pk):
            note = SecurityNote.objects.filter(owner=request.user, security_id=security_id).first()
            return Response({"text": note.text if note else ""})

    def put(self, request, security_id):
        get_object_or_404(Security, pk=security_id)
        serializer = NoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with owner_scope(request.user.pk):
            note, _ = SecurityNote.objects.update_or_create(
                owner=request.user, security_id=security_id, defaults=serializer.validated_data
            )
            return Response(NoteSerializer(note).data)
