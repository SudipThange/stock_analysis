from rest_framework import serializers
from .models import Portfolio


class PortfolioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Portfolio
        fields = ['id', 'title', 'desc', 'created_at', 'updated_at']

    def validate_title(self, value):
        """
        Ensure title contains only alphabets and spaces.
        """
        if not value.replace(" ", "").isalpha():
            raise serializers.ValidationError(
                "Title must contain only letters and spaces."
            )
        return value


    def validate_desc(self, value):
        """
        Ensure description length does not exceed 500.
        """
        if len(value) > 500:
            raise serializers.ValidationError(
                "Description cannot exceed 500 characters."
            )
        return value