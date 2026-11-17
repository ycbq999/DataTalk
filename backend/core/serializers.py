from rest_framework import serializers

from core.models import Security, Watchlist, WatchlistEntry


class SecuritySerializer(serializers.ModelSerializer):
    class Meta:
        model = Security
        fields = ("id", "symbol", "exchange", "name")


class EntrySerializer(serializers.ModelSerializer):
    security = SecuritySerializer(read_only=True)
    security_id = serializers.PrimaryKeyRelatedField(
        queryset=Security.objects.all(), source="security", write_only=True
    )

    class Meta:
        model = WatchlistEntry
        fields = ("id", "security", "security_id")


class WatchlistSerializer(serializers.ModelSerializer):
    entries = EntrySerializer(many=True, read_only=True)

    class Meta:
        model = Watchlist
        fields = ("id", "name", "entries")


class NoteSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=2000, allow_blank=True, trim_whitespace=False)
