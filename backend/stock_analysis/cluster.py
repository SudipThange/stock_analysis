import os
import json

import django
import pandas as pd


def _setup_django() -> None:
	os.environ.setdefault("DJANGO_SETTINGS_MODULE", "stock_analysis.settings")
	django.setup()


def _build_stock_dataframe() -> pd.DataFrame:
	from stock.models import Stock

	queryset = (
		Stock.objects
		.select_related("portfolio")
		.order_by("portfolio_id", "id")
		.values(
			"id",
			"portfolio_id",
			"portfolio__title",
			"title",
			"ticker",
			"today_open",
			"today_close",
			"min_price",
			"max_price",
			"avg_price_last_month",
			"pe_ratio",
			"created_at",
			"modified_at",
		)
	)

	df = pd.DataFrame(list(queryset))
	if df.empty:
		return df

	df = df.rename(
		columns={
			"id": "stock_id",
			"portfolio__title": "portfolio_title",
		}
	)

	ordered_columns = [
		"stock_id",
		"portfolio_id",
		"portfolio_title",
		"title",
		"ticker",
		"today_open",
		"today_close",
		"min_price",
		"max_price",
		"avg_price_last_month",
		"pe_ratio",
		"created_at",
		"modified_at",
	]

	return df[ordered_columns]


def main() -> None:
	_setup_django()

	from django.conf import settings

	df = _build_stock_dataframe()
	if df.empty:
		print("No stocks found in database.")
		return

	os.makedirs(os.path.join(settings.MEDIA_ROOT, "stock_data"), exist_ok=True)
	report_path = os.path.join(settings.MEDIA_ROOT, "stock_data", "cluster_report_from_db.csv")
	json_report_path = os.path.join(settings.MEDIA_ROOT, "stock_data", "cluster_report_from_db.json")
	df.to_csv(report_path, index=False)

	print("\nDataFrame built from Stock table:")
	print(df.to_string(index=False))

	print("\nCSV content (same data as file):")
	print(df.to_csv(index=False))

	read_df = pd.read_csv(report_path)
	json_records = json.loads(read_df.to_json(orient="records", date_format="iso"))

	print("\nJSON content (read from CSV file):")
	print(json.dumps(json_records, indent=2))

	with open(json_report_path, "w", encoding="utf-8") as json_file:
		json.dump(json_records, json_file, indent=2)

	print(f"CSV exported to: {report_path}")
	print(f"JSON exported to: {json_report_path}")


if __name__ == "__main__":
	main()
