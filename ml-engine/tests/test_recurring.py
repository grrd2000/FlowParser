from __future__ import annotations

import unittest
from typing import List, Dict

from fastapi.testclient import TestClient

from app.main import app, engine


class RecurringMLFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        engine._models.clear()
        self.client = TestClient(app)

    @staticmethod
    def _sample_transactions(labeled: bool) -> List[Dict]:
        base = [
            {
                "transaction_id": 1,
                "date": "2024-01-05",
                "amount": -49.99,
                "description": "Spotify subscription",
            },
            {
                "transaction_id": 2,
                "date": "2024-02-05",
                "amount": -50.10,
                "description": "Spotify subscription",
            },
            {
                "transaction_id": 3,
                "date": "2024-03-06",
                "amount": -50.00,
                "description": "Spotify subscription",
            },
            {
                "transaction_id": 4,
                "date": "2024-03-07",
                "amount": -120.00,
                "description": "Jednorazowy zakup",
            },
        ]
        if not labeled:
            return base
        labeled_base = []
        for item in base:
            labeled_base.append(
                {
                    **item,
                    "label": 1 if item["transaction_id"] in {1, 2, 3} else 0,
                }
            )
        return labeled_base

    def test_train_to_detect_flow(self):
        train_payload = {
            "algorithm": "lightgbm",
            "transactions": self._sample_transactions(labeled=True),
        }
        train_resp = self.client.post("/recurring/train", json=train_payload)
        self.assertEqual(train_resp.status_code, 200, train_resp.text)

        status = self.client.get("/model-status", params={"algorithm": "lightgbm"})
        self.assertEqual(status.status_code, 200)
        self.assertTrue(status.json().get("trained"))

        predict_payload = {
            "algorithm": "lightgbm",
            "transactions": self._sample_transactions(labeled=False),
        }
        detect_resp = self.client.post("/recurring/detect", json=predict_payload)
        self.assertEqual(detect_resp.status_code, 200, detect_resp.text)

        data = detect_resp.json()
        self.assertEqual(len(data["scores"]), len(predict_payload["transactions"]))
        for score in data["scores"]:
            self.assertIn("transaction_id", score)
            self.assertIn("score", score)

        self.assertGreaterEqual(len(data.get("groups", [])), 1)
        group = data["groups"][0]
        for field in ["id", "name", "cadence", "next_date", "average_amount", "transaction_ids"]:
            self.assertIn(field, group)

    def test_predict_requires_trained_model(self):
        predict_payload = {
            "algorithm": "xgboost",
            "transactions": self._sample_transactions(labeled=False),
        }
        resp = self.client.post("/recurring/predict", json=predict_payload)
        self.assertEqual(resp.status_code, 400)
        detail = resp.json().get("detail", "")
        self.assertIn("not trained", detail.lower())


if __name__ == "__main__":
    unittest.main()
