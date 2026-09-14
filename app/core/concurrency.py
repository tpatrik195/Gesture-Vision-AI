"""Thread offloading helper.

asyncio.to_thread() only exists from Python 3.9, but the project must also run
on the 3.8 interpreters found on older Linux distributions.
"""
from __future__ import annotations
import asyncio
import functools
from typing import Any, Callable

try:
    from asyncio import to_thread as _to_thread
except ImportError:  # Python 3.8
    async def _to_thread(func: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, functools.partial(func, *args, **kwargs))


async def run_in_thread(func: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
    return await _to_thread(func, *args, **kwargs)
