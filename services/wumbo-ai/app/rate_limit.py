"""A sliding-window limiter, in memory.

Two windows per caller: a short one that stops a runaway loop, and an hourly one
that stops a patient abuser. Held in this process, which is the right size for a
single instance — move the buckets to Redis before running more than one.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass


@dataclass(frozen=True)
class Decision:
    allowed: bool
    #: Seconds until the caller may try again. Zero when allowed.
    retry_after: int = 0


class SlidingWindowLimiter:
    def __init__(self, per_minute: int, per_hour: int) -> None:
        self._limits = ((per_minute, 60), (per_hour, 3600))
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, now: float | None = None) -> Decision:
        """Records a hit and says whether it was allowed."""
        now = time.monotonic() if now is None else now
        longest = max(window for _, window in self._limits)

        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > longest:
                hits.popleft()

            for limit, window in self._limits:
                in_window = [hit for hit in hits if now - hit <= window]
                if len(in_window) >= limit:
                    # Oldest hit in this window decides when a slot frees up.
                    retry_after = max(1, int(window - (now - in_window[0])) + 1)
                    return Decision(allowed=False, retry_after=retry_after)

            hits.append(now)
            if not self._hits[key]:
                del self._hits[key]
            return Decision(allowed=True)

    def forget(self, key: str) -> None:
        """Test seam, and how a deployment would drop a session on sign-out."""
        with self._lock:
            self._hits.pop(key, None)
