from sqlalchemy import URL, create_engine

from backend.app.config import settings

from sqlalchemy.orm import DeclarativeBase


database_url = URL.create(
    drivername="postgresql+psycopg",
    username=settings.postgres_user,
    password=settings.postgres_password.get_secret_value(),
    host=settings.postgres_host,
    port=settings.postgres_port,
    database=settings.postgres_db,
)

engine = create_engine(
    database_url,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 5},
)

class Base(DeclarativeBase):
    pass