from __future__ import annotations

from dataclasses import dataclass, field
from threading import Lock

from app.models import Paper


@dataclass
class SessionData:
    papers: list[Paper] = field(default_factory=list)


class SessionStore:
    def __init__(self) -> None:
        self._data: dict[str, SessionData] = {}
        self._lock = Lock()

    def create(self, session_id: str, papers: list[Paper]) -> None:
        with self._lock:
            self._data[session_id] = SessionData(papers=papers)

    def get(self, session_id: str) -> SessionData | None:
        with self._lock:
            return self._data.get(session_id)


store = SessionStore()
