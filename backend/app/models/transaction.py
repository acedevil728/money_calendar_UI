from sqlalchemy import Column, Integer, String, Float, Date, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import synonym

Base = declarative_base()

class Transaction(Base):
    __tablename__ = "transaction"

    id = Column(Integer, primary_key=True)
    date = Column(Date, nullable=False)
    amount = Column(Float, nullable=False)
    # 실제 DB 컬럼명 "type" 사용
    type = Column("type", String, nullable=True)
    major_category = Column(String, nullable=True)
    sub_category = Column(String, nullable=True)
    category = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    account = Column(String, nullable=True)
    remarks = Column(Text, nullable=True)
    raw_source = Column(Text, nullable=True)

    # .direction 으로 접근하면 .type 컬럼을 사용하도록 동기화
    direction = synonym("type")
