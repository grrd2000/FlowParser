from __future__ import annotations

import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
sys.path.append(str(PROJECT_ROOT))

from app.engine import RecurringPaymentEngine, load_sample_dataset  # noqa: E402


def main():
    data_path = Path(__file__).resolve().parent.parent / "data" / "sample_transactions.csv"
    df = load_sample_dataset(str(data_path))

    engine = RecurringPaymentEngine()
    result = engine.train(df)

    sample_predictions = engine.predict(df.head(5))

    print("Training metrics (macro avg):")
    print(json.dumps(result.metrics.get("macro avg", {}), indent=2))
    print("\nFirst five prediction scores:")
    print([round(float(score), 4) for score in sample_predictions])


if __name__ == "__main__":
    main()
