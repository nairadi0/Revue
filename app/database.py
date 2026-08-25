from dotenv import load_dotenv 
import os 
from sqlalchemy import create_engine 
from sqlalchemy.orm import sessionmaker, declarative_base
import psycopg

load_dotenv()
url = os.environ["DATABASE_URL"]
engine = create_engine(url)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

