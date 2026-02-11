import os
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Integer,
    MetaData,
    String,
    Table,
    create_engine,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert

DATABASE_URL = os.getenv("DATABASE_URL")

metadata = MetaData()

client_sessions = Table(
    "client_sessions",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("client_id", String(64), unique=True, nullable=False),
    Column("consent_accepted", Boolean, nullable=False, default=False),
    Column("consent_at", DateTime, nullable=True),
    Column("client_ip", String(64), nullable=True),
    Column("origin", String(512), nullable=True),
    Column("user_agent", String(512), nullable=True),
    Column("created_at", DateTime, nullable=False, default=datetime.utcnow),
    Column("updated_at", DateTime, nullable=False, default=datetime.utcnow),
    Column("last_seen_at", DateTime, nullable=True),
)

engine = create_engine(DATABASE_URL) if DATABASE_URL else None


def init_db():
    if engine is None:
        return
    metadata.create_all(engine)


def upsert_client(
    client_id,
    consent_accepted=None,
    consent_at=None,
    client_ip=None,
    origin=None,
    user_agent=None,
    last_seen_at=None,
):
    if engine is None:
        return
    now = datetime.utcnow()
    values = {
        "client_id": client_id,
        "updated_at": now,
    }
    if consent_accepted is not None:
        values["consent_accepted"] = consent_accepted
    if consent_at is not None:
        values["consent_at"] = consent_at
    if client_ip is not None:
        values["client_ip"] = client_ip
    if origin is not None:
        values["origin"] = origin
    if user_agent is not None:
        values["user_agent"] = user_agent
    if last_seen_at is not None:
        values["last_seen_at"] = last_seen_at

    stmt = pg_insert(client_sessions).values(
        client_id=client_id,
        consent_accepted=values.get("consent_accepted", False),
        consent_at=values.get("consent_at"),
        client_ip=values.get("client_ip"),
        origin=values.get("origin"),
        user_agent=values.get("user_agent"),
        created_at=now,
        updated_at=now,
        last_seen_at=values.get("last_seen_at"),
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["client_id"],
        set_=values,
    )
    with engine.begin() as conn:
        conn.execute(stmt)
