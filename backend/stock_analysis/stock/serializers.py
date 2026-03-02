from rest_framework import serializers
from .models import Stock
from portfolio.models import Portfolio


class StockSerializer(serializers.ModelSerializer):

    class Meta:
        model = Stock
        fields = [
            'id',
            'portfolio',   # ForeignKey field
            'title',
            'ticker',
            'created_at',
            'modified_at'
        ]


    def validate_title(self, value):
        value = value.strip()
        return value


    def validate_ticker(self, value):
        value = value.upper().strip()
        return value


    # 🔹 Validate Portfolio Exists
    def validate_portfolio(self, value):
        if not Portfolio.objects.filter(id=value.id).exists():
            raise serializers.ValidationError("Portfolio does not exist.")
        return value
