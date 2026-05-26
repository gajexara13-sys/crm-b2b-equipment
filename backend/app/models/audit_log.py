from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class AuditLog(Base):
    """Журнал важных действий пользователей (в первую очередь — удалений).

    Хранит:
      - кто (user_id, email, role)
      - что (action: 'delete_request', 'delete_task' и т.д.)
      - над чем (entity_type, entity_id)
      - подробности (details — короткий JSON: например, номер заявки или ID связанных записей)
      - откуда (ip)
      - когда (created_at)
    """
    __tablename__ = "audit_log"

    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    user_email  = Column(String, nullable=True)
    user_role   = Column(String, nullable=True)
    action      = Column(String, nullable=False, index=True)   # 'delete_request', 'delete_task', ...
    entity_type = Column(String, nullable=False, index=True)   # 'request', 'task', 'quote', ...
    entity_id   = Column(Integer, nullable=True, index=True)
    details     = Column(Text, nullable=True)                  # короткое JSON-описание
    ip          = Column(String, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), index=True)
