import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report
import pickle
import os

def generate_synthetic_data(n_samples=5000):
    np.random.seed(42)
    # Target: 0 = Non Urgent, 1 = Moderate, 2 = Urgent, 3 = Critical
    # Create somewhat imbalanced dataset initially
    triage_levels = np.random.choice([0, 1, 2, 3], size=n_samples, p=[0.4, 0.3, 0.2, 0.1])
    
    data = []
    
    for level in triage_levels:
        # Baseline Demographics
        age = np.random.randint(18, 90)
        gender = np.random.choice([0, 1])
        
        # Baselines
        hr = np.random.normal(75, 12)
        sys_bp = np.random.normal(120, 15)
        dia_bp = np.random.normal(80, 10)
        resp = np.random.normal(16, 2)
        spo2 = np.random.normal(98, 1)
        temp = np.random.normal(37.0, 0.4)
        
        # Binary Symptom Flags
        cp = 0; sob = 0; dizz = 0; vom = 0; fever = 0; ha = 0; abd = 0; fat = 0; loc = 0
        
        # Med History Flags
        htn = np.random.choice([0, 1], p=[0.7, 0.3])
        dm = np.random.choice([0, 1], p=[0.8, 0.2])
        cardiac = np.random.choice([0, 1], p=[0.9, 0.1])
        asthma = np.random.choice([0, 1], p=[0.9, 0.1])
        
        if level == 0: # Non urgent
            if np.random.rand() < 0.4: ha = 1
            if np.random.rand() < 0.3: fat = 1
        elif level == 1: # Moderate
            if np.random.rand() < 0.5: fever = 1
            if np.random.rand() < 0.4: abd = 1
            if np.random.rand() < 0.3: vom = 1
            hr += 10
            temp += 1.2
        elif level == 2: # Urgent
            if np.random.rand() < 0.6: sob = 1
            if np.random.rand() < 0.5: dizz = 1
            hr += 20
            sys_bp += 25
            spo2 -= 4
            resp += 6
            if asthma and np.random.rand() < 0.5: sob = 1
        elif level == 3: # Critical
            if np.random.rand() < 0.8: cp = 1
            if np.random.rand() < 0.7: loc = 1
            if np.random.rand() < 0.7: sob = 1
            hr += 35
            # could be very high or very low Sys BP
            if np.random.rand() < 0.5:
                sys_bp -= 35 # shock
            else:
                sys_bp += 50 # hypertensive crisis
            spo2 -= 10
            resp += 12
            
        data.append({
            'age': age, 'gender_encoded': gender,
            'heart_rate': hr, 'blood_pressure_systolic': sys_bp, 'blood_pressure_diastolic': dia_bp,
            'respiratory_rate': resp, 'oxygen_saturation': spo2, 'temperature': temp,
            'chest_pain': cp, 'shortness_of_breath': sob, 'dizziness': dizz,
            'vomiting': vom, 'fever': fever, 'headache': ha, 'abdominal_pain': abd,
            'fatigue': fat, 'loss_of_consciousness': loc,
            'hypertension': htn, 'diabetes': dm, 'cardiac_history': cardiac, 'asthma': asthma,
            'triage_level': level
        })
        
    df = pd.DataFrame(data)
    df['oxygen_saturation'] = df['oxygen_saturation'].clip(upper=100)
    return df

def main():
    print("Generating synthetic dataset...")
    df = generate_synthetic_data(10000)
    
    # Feature Engineering/Definition
    features = [
        'age', 'gender_encoded', 'heart_rate', 'blood_pressure_systolic', 'blood_pressure_diastolic',
        'respiratory_rate', 'oxygen_saturation', 'temperature', 'chest_pain', 'shortness_of_breath',
        'dizziness', 'vomiting', 'fever', 'headache', 'abdominal_pain', 'fatigue', 'loss_of_consciousness',
        'hypertension', 'diabetes', 'cardiac_history', 'asthma'
    ]
    target = 'triage_level'
    
    X = df[features]
    y = df[target]
    
    print("Class distribution before split:")
    print(y.value_counts(normalize=True))
    
    # Train Test Split with Stratification as requested in the prompt
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    print("\nTraining RandomForestClassifier with class weighting...")
    # Using class_weight='balanced' to handle the imbalance in the target classes securely
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        min_samples_split=4,
        min_samples_leaf=2,
        class_weight='balanced',
        random_state=42
    )
    
    model.fit(X_train, y_train)
    
    print("\nEvaluating Model...")
    y_pred = model.predict(X_test)
    
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, average='weighted')
    rec = recall_score(y_test, y_pred, average='weighted')
    f1 = f1_score(y_test, y_pred, average='weighted')
    
    print(f"Accuracy: {acc:.4f}")
    print(f"Precision (Weighted): {prec:.4f}")
    print(f"Recall (Weighted): {rec:.4f}")
    print(f"F1 Score (Weighted): {f1:.4f}")
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred))
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    
    # Export Model
    model_path = os.path.join(os.path.dirname(__file__), 'triage_model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
        
    print(f"\nModel exported successfully to {model_path}")

if __name__ == "__main__":
    main()
