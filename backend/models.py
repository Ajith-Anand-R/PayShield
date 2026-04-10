from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    avg_txn_amount = Column(Float, default=0.0)
    behavior_baseline = Column(Float, default=220.0)  # Average typing delay
    created_at = Column(DateTime, default=datetime.utcnow)

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Float)
    risk_score = Column(Float)
    decision = Column(String)  # ALLOW, STEP-UP, BLOCK
    has_mule_behavior = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")
