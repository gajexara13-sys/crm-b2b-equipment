from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class EmailMessage(Base):
    __tablename__ = "email_messages"

    id              = Column(Integer, primary_key=True)
    message_uid     = Column(String, nullable=True, index=True)   # IMAP UID
    message_id_hdr  = Column(String, nullable=True, index=True)   # заголовок Message-ID
    thread_id       = Column(String, nullable=True, index=True)   # сгруппированные треды
    direction       = Column(String, nullable=False, default="in") # "in" | "out"

    from_email      = Column(String, nullable=True, index=True)
    from_name       = Column(String, nullable=True)
    to_email        = Column(Text, nullable=True)   # может быть несколько, JSON-список
    cc_email        = Column(Text, nullable=True)
    subject         = Column(Text, nullable=True)
    body_text       = Column(Text, nullable=True)
    body_html       = Column(Text, nullable=True)
    attachments_json = Column(Text, nullable=True)  # JSON [{name, url, size}]

    sent_at         = Column(DateTime(timezone=True), nullable=True)
    received_at     = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    is_read         = Column(Boolean, default=False, nullable=False)
    is_deleted      = Column(Boolean, default=False, nullable=False)

    linked_request_id = Column(Integer, ForeignKey("requests.id", ondelete="SET NULL"), nullable=True, index=True)
    linked_client_id  = Column(Integer, ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True)
