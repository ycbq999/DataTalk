import json

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.forms import UserCreationForm
from django.db import DatabaseError, IntegrityError, transaction
from django.db.models import Prefetch, Q
from django.http import FileResponse, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.csrf import csrf_failure as django_csrf_failure
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.auth_limits import auth_retry_after
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


def account_response(user, *, status=200):
    account = {"id": user.pk, "username": user.get_username()} if user.is_authenticated else None
    return JsonResponse({"user": account}, status=status)


def credentials(request):
    try:
        data = json.loads(request.body)
    except ValueError:
        return None
    if not isinstance(data, dict):
        return None
    username, password = data.get("username"), data.get("password")
    if not isinstance(username, str) or not isinstance(password, str):
        return None
    return username.strip(), password


def throttle(request, action):
    retry_after = auth_retry_after(request, action)
    if retry_after:
        return JsonResponse(
            {"detail": "Too many attempts. Please wait a few minutes and try again."},
            status=429, headers={"Retry-After": str(retry_after)},
        )
    return None


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
        limited = throttle(request, "sign-in")
        if limited is not None:
            return limited
        submitted = credentials(request)
        if submitted is None:
            return JsonResponse({"detail": "Enter a username and password."}, status=400)
        username, password = submitted
        if len(username) > 150 or len(password) > 4096:
            return JsonResponse({"detail": "Invalid username or password."}, status=403)
        user = authenticate(
            request=request, username=get_user_model().normalize_username(username), password=password
        )
        if user is None:
            return JsonResponse({"detail": "Invalid username or password."}, status=403)
        login(request, user)

    return account_response(request.user)


@csrf_protect
@never_cache
@require_POST
def register(request):
    if request.user.is_authenticated:
        return JsonResponse({"detail": "Sign out before creating another account."}, status=409)
    if request.content_type != "application/json":
        return JsonResponse({"detail": "Send credentials as JSON."}, status=415)
    limited = throttle(request, "sign-up")
    if limited is not None:
        return limited
    submitted = credentials(request)
    if submitted is None:
        return JsonResponse({"detail": "Enter a username and password."}, status=400)
    username, password = submitted
    if len(username) > 150 or len(password) > 4096:
        return JsonResponse({"detail": "Your username or password is too long."}, status=400)

    form = UserCreationForm({"username": username, "password1": password, "password2": password})
    if not form.is_valid():
        errors = {
            "password" if field.startswith("password") else field: list(messages)
            for field, messages in form.errors.items()
        }
        return JsonResponse(errors, status=400)
    try:
        with transaction.atomic():
            user = form.save()
    except IntegrityError:
        return JsonResponse({"username": ["This username is already in use."]}, status=409)
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return account_response(user, status=201)


class SecurityList(APIView):
    def get(self, request):
        query = request.query_params.get("q", "").strip()[:160]
        exchange = request.query_params.get("exchange", "").strip()[:12]
        securities = Security.objects.all()
        if exchange:
            securities = securities.filter(exchange__iexact=exchange)
        if query:
            securities = securities.filter(
                Q(symbol__icontains=query) | Q(exchange__iexact=query) | Q(name__icontains=query)
            )
        return Response(SecuritySerializer(securities[:25], many=True).data)


class PublicSecurityList(SecurityList):
    authentication_classes = ()
    permission_classes = (AllowAny,)


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
