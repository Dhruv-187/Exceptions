from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
import datetime
from database import Base

class Patient(Base):
    __tablename__ = "patients"
    patient_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String, nullable=False)
    symptoms_text = Column(String)
    arrival_time = Column(DateTime, default=datetime.datetime.utcnow)
    
    vitals = relationship("Vitals", back_populates="patient", uselist=False)
    triage_result = relationship("TriageResult", back_populates="patient", uselist=False)

class Vitals(Base):
    __tablename__ = "vitals"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.patient_id"))
    heart_rate = Column(Float)
    blood_pressure = Column(String)
    temperature = Column(Float)
    spo2 = Column(Float)
    respiratory_rate = Column(Float)
    
    patient = relationship("Patient", back_populates="vitals")

class TriageResult(Base):
    __tablename__ = "triage_results"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.patient_id"))
    ml_prediction = Column(Integer, nullable=False)
    confidence_score = Column(Float, nullable=False)
    llm_reasoning = Column(String)
    triage_level = Column(String, nullable=False)
    doctor_override = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    patient = relationship("Patient", back_populates="triage_result")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="admin")
