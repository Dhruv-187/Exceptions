import shap
import numpy as np
import logging

logger = logging.getLogger(__name__)

def generate_patient_shap_values(model, feature_vector: list, feature_names: list) -> list:
    """
    Generates SHAP values for a specific patient's prediction to explain the model's decision.
    Returns a list of the top influencing features.
    """
    try:
        # For RandomForestClassifier, shap.TreeExplainer is very fast
        explainer = shap.TreeExplainer(model)
        
        # We need a 2D array for SHAP
        data = np.array(feature_vector).reshape(1, -1)
        shap_values = explainer.shap_values(data)
        
        # For classification, shap_values is a list of arrays (one per class).
        # We want the explanation for the predicted class.
        pred_class = int(model.predict(data)[0])
        
        # Select SHAP values for the predicted class
        if isinstance(shap_values, list):
            class_shap_values = shap_values[pred_class][0]
        else:
            class_shap_values = shap_values[0, ..., pred_class] if len(shap_values.shape) > 2 else shap_values[0]

        # Combine feature names and their impact scores
        feature_impacts = []
        for name, value in zip(feature_names, class_shap_values):
            if abs(value) > 0.001: # Filter out negligible impacts
                feature_impacts.append({
                    "feature": name,
                    "impact": float(value)
                })
        
        # Sort by absolute impact descending
        feature_impacts.sort(key=lambda x: abs(x["impact"]), reverse=True)
        return feature_impacts[:5] # Return top 5 factors
    except Exception as e:
        logger.error(f"Failed to generate SHAP explanation: {e}")
        return []
