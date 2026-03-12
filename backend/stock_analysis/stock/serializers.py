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
            'today_open',
            'today_close',
            'min_price',
            'max_price',
            'avg_price_last_month',
            'pe_ratio',
            'created_at',
            'modified_at'
        ]


    def validate_title(self, value):
        value = value.strip()
        return value


    def validate_ticker(self, value):
        value = value.upper().strip()
        return value


    def validate(self, attrs):
        portfolio = attrs.get('portfolio') or getattr(self.instance, 'portfolio', None)
        ticker = attrs.get('ticker') or getattr(self.instance, 'ticker', None)

        if portfolio is not None and ticker:
            qs = Stock.objects.filter(portfolio=portfolio, ticker__iexact=ticker)
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"ticker": "This ticker already exists in the selected portfolio."}
                )

        return attrs


    # 🔹 Validate Portfolio Exists
    def validate_portfolio(self, value):
        if not Portfolio.objects.filter(id=value.id).exists():
            raise serializers.ValidationError("Portfolio does not exist.")

        request = self.context.get('request')
        if request and request.user.is_authenticated and value.owner_id != request.user.id:
            raise serializers.ValidationError("You can only add stocks to your own portfolio.")

        return value
