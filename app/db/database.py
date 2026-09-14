"""Engine setup and a non-blocking background writer for telemetry rows.

Telemetry must never slow down the gesture pipeline, so writes are queued and
flushed in batches on a worker task. If the queue is full the row is dropped:
losing a measurement sample is always preferable to adding latency.
"""
from __future__ import annotations
import asyncio
import logging
from typing import Any

from sqlalchemy import Table, create_engine

from app.config import settings
from app.core.concurrency import run_in_thread
from app.db.models import metadata

logger = logging.getLogger(__name__)

_engine = None
_write_queue: asyncio.Queue | None = None
_writer_task: asyncio.Task | None = None

QUEUE_MAX_SIZE = 2000
BATCH_SIZE = 50
FLUSH_INTERVAL = 1.0


def get_engine():
    return _engine


def is_enabled() -> bool:
    return _engine is not None


def init_engine() -> None:
    global _engine
    if not settings.database_url:
        logger.warning("DATABASE_URL is not set - persistence and telemetry are disabled")
        return
    try:
        _engine = create_engine(
            settings.database_url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=5,
        )
        metadata.create_all(_engine)
        logger.info("Database ready")
    except Exception as exc:
        _engine = None
        logger.error("Database unavailable, continuing without persistence: %s", exc)


def execute(statement) -> None:
    """Run a statement synchronously. Callers must be off the event loop."""
    if _engine is None:
        return
    try:
        with _engine.begin() as conn:
            conn.execute(statement)
    except Exception as exc:
        logger.error("Database write failed: %s", exc)


async def execute_async(statement) -> None:
    if _engine is None:
        return
    await run_in_thread(execute, statement)


def enqueue(table: Table, values: dict[str, Any]) -> None:
    """Queue a telemetry row. Never blocks, never raises."""
    if _engine is None or _write_queue is None:
        return
    try:
        _write_queue.put_nowait((table, values))
    except asyncio.QueueFull:
        pass


def _flush(batch: list[tuple[Table, dict[str, Any]]]) -> None:
    if _engine is None or not batch:
        return
    grouped: dict[Table, list[dict[str, Any]]] = {}
    for table, values in batch:
        grouped.setdefault(table, []).append(values)
    try:
        with _engine.begin() as conn:
            for table, rows in grouped.items():
                conn.execute(table.insert(), rows)
    except Exception as exc:
        logger.error("Telemetry flush failed (%d rows dropped): %s", len(batch), exc)


async def _writer_loop() -> None:
    assert _write_queue is not None
    batch: list[tuple[Table, dict[str, Any]]] = []
    while True:
        try:
            try:
                item = await asyncio.wait_for(_write_queue.get(), timeout=FLUSH_INTERVAL)
                batch.append(item)
            except asyncio.TimeoutError:
                pass

            while len(batch) < BATCH_SIZE:
                try:
                    batch.append(_write_queue.get_nowait())
                except asyncio.QueueEmpty:
                    break

            if batch:
                pending, batch = batch, []
                await run_in_thread(_flush, pending)
        except asyncio.CancelledError:
            if batch:
                await run_in_thread(_flush, batch)
            raise
        except Exception as exc:
            logger.error("Telemetry writer error: %s", exc)
            batch = []


async def start_writer() -> None:
    global _write_queue, _writer_task
    if _engine is None or not settings.telemetry_enabled:
        return
    _write_queue = asyncio.Queue(maxsize=QUEUE_MAX_SIZE)
    _writer_task = asyncio.create_task(_writer_loop())


async def stop_writer() -> None:
    global _writer_task, _write_queue
    if _writer_task is None:
        return
    _writer_task.cancel()
    try:
        await _writer_task
    except asyncio.CancelledError:
        pass
    _writer_task = None
    _write_queue = None
