from django.urls import path

from core import views
from research.views import SecurityResearch


urlpatterns = [
    path("health/", views.health),
    path("ready/", views.ready),
    path("session/", views.session),
    path("securities/", views.SecurityList.as_view()),
    path("securities/<int:security_id>/note/", views.Note.as_view()),
    path("securities/<int:security_id>/research/", SecurityResearch.as_view()),
    path("watchlists/", views.Watchlists.as_view()),
    path("watchlists/<int:watchlist_id>/", views.WatchlistDetail.as_view()),
    path("watchlists/<int:watchlist_id>/entries/", views.Entries.as_view()),
    path("watchlists/<int:watchlist_id>/entries/<int:entry_id>/", views.EntryDetail.as_view()),
]
