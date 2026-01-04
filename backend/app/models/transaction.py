from sqlalchemy import Column, Integer, String, Float, Date, Text, Boolean, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import synonym

Base = declarative_base()

# Transaction 모델 (기존 구조를 유지하고 'type' 컬럼을 실제 DB 컬럼으로 사용)
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


# FixedExpense 모델: 고정 지출 정의 (필수 필드: major_category, sub_category, amount, start_date, end_date, day_of_month)
class FixedExpense(Base):
    __tablename__ = "fixed_expense"

    id = Column(Integer, primary_key=True)
    major_category = Column(String, nullable=False)
    sub_category = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    amount = Column(Float, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    day_of_month = Column(Integer, nullable=False)  # 발생일 (1-31)
    active = Column(Boolean, nullable=False, default=True)


# Saving 모델: 저축 계정/적금 등
class Saving(Base):
    __tablename__ = "saving"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=True)
    kind = Column(String, nullable=False)  # 적금/예금/파킹/주식/기타
    initial_balance = Column(Float, nullable=False, default=0.0)  # 초기 보유액
    contribution_amount = Column(Float, nullable=False, default=0.0)  # 정기 투입 금액
    start_date = Column(Date, nullable=True)   # 정기 투입 시작 (선택)
    end_date = Column(Date, nullable=True)     # 정기 투입 종료 (선택)
    day_of_month = Column(Integer, nullable=True)  # 매달 몇일에 투입되는지 (선택)
    frequency = Column(String, nullable=True, default="monthly")  # 'monthly' 기본
    withdrawn = Column(Boolean, nullable=False, default=False)  # 출금 여부
    active = Column(Boolean, nullable=False, default=True)


# 간단한 SQLite 엔진과 유틸리티: 필요에 따라 환경변수로 바꿔 사용 가능
# ...기본값은 개발용 로컬 DB 파일입니다.
engine = create_engine("sqlite:///./money_calendar.db", connect_args={"check_same_thread": False})

def create_db_and_tables():
    # 호출 시 Base.metadata.create_all(engine)로 테이블 생성
    Base.metadata.create_all(engine)
