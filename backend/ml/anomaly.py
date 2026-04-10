import numpy as np
from sklearn.ensemble import IsolationForest
import pandas as pd
import pickle
import os

class AnomalyEngine:
    def __init__(self):
        self.model_path = "backend/ml/anomaly_model.pkl"
        self.model = self._load_or_train()

    def _load_or_train(self):
        if os.path.exists(self.model_path):
            with open(self.model_path, "rb") as f:
                return pickle.load(f)
        
        # Synthetic Training Data: normal transaction amounts and times
        # (normalized between 0 and 1)
        data = np.random.normal(0.5, 0.1, (1000, 2))
        model = IsolationForest(contamination=0.05, random_state=42)
        model.fit(data)
        
        with open(self.model_path, "wb") as f:
            pickle.dump(model, f)
        return model

    def score(self, amount: float, hour: int) -> float:
        """
        Calculates an anomaly score between 0 and 100.
        Higher score = more anomalous.
        """
        # Simple normalization for demo
        norm_amount = min(amount / 5000.0, 1.0)
        norm_hour = hour / 24.0
        
        features = np.array([[norm_amount, norm_hour]])
        # decision_function returns signed distance (negative = anomaly)
        # We transform it into original anomaly score (0 to 1)
        score = -self.model.decision_function(features)[0]
        
        # Scale to 0-100 range for the UI
        scaled_score = max(0, min(100, (score + 0.5) * 100))
        return scaled_score
