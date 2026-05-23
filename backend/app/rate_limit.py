"""Простой in-memory rate-limiter для защиты эндпоинтов от перебора.

Не использует Redis или внешние зависимости — словарь {ключ -> [список таймстампов]}.
При перезапуске backend счётчики сбрасываются (это норм для нашего случая —
атакующий теряет прогресс).

Использование:
    from fastapi import Depends, Request
    from app.rate_limit import rate_limit_dep

    @router.post("/login", dependencies=[Depends(rate_limit_dep("login", 5, 60))])
    def login(...): ...

Параметры:
    name        — имя счётчика (чтобы разные эндпоинты не мешали друг другу)
    max_hits    — сколько попыток допускается
    window_sec  — окно в секундах

При превышении возвращается 429 Too Many Requests.
"""

from __future__ import annotations

import time
import threading
from collections import defaultdict
from typing import Callable

from fastapi import Depends, HTTPException, Request, status


# {(name, ip): [ts1, ts2, ...]} — таймстампы попыток в окне
_HITS: dict[tuple[str, str], list[float]] = defaultdict(list)
# {(name, ip): block_until_ts} — до какого момента заблокирован
_BLOCK: dict[tuple[str, str], float] = {}
_LOCK = threading.Lock()


def _client_ip(request: Request) -> str:
    # Приоритет: X-Forwarded-For (за nginx), потом client.host
    fwd = (request.headers.get("X-Forwarded-For") or "").split(",")
    if fwd and fwd[0].strip():
        return fwd[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit_dep(name: str, max_hits: int, window_sec: int, block_sec: int | None = None) -> Callable:
    """Фабрика зависимости FastAPI для лимита.

    Если block_sec не задан — равен window_sec.
    """
    block_sec = block_sec if block_sec is not None else window_sec

    def _check(request: Request) -> None:
        ip = _client_ip(request)
        key = (name, ip)
        now = time.time()
        with _LOCK:
            # Проверяем блокировку
            blocked_until = _BLOCK.get(key, 0)
            if blocked_until > now:
                remain = int(blocked_until - now)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Слишком много попыток. Повторите через {remain} сек.",
                )
            # Чистим старые попытки за пределами окна
            lst = _HITS[key]
            cutoff = now - window_sec
            lst = [t for t in lst if t > cutoff]
            lst.append(now)
            _HITS[key] = lst
            # Если превышено — блокируем
            if len(lst) > max_hits:
                _BLOCK[key] = now + block_sec
                _HITS[key] = []
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Слишком много попыток. Повторите через {block_sec} сек.",
                )

    return _check
