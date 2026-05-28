from sqlalchemy import Column, Integer, String, Boolean
from app.database import Base


class EmailSettings(Base):
    """Одна строка — настройки SMTP/IMAP для всей системы."""
    __tablename__ = "email_settings"

    id               = Column(Integer, primary_key=True, default=1)

    # SMTP
    smtp_host        = Column(String, default="smtp.yandex.ru")
    smtp_port        = Column(Integer, default=587)
    smtp_use_tls     = Column(Boolean, default=True)
    smtp_username    = Column(String, nullable=True)
    smtp_password    = Column(String, nullable=True)   # хранится в открытом виде (пароль приложения)
    from_name        = Column(String, default="CRM RUTEST")
    from_email       = Column(String, nullable=True)   # если отличается от username

    # IMAP
    imap_host        = Column(String, default="imap.yandex.ru")
    imap_port        = Column(Integer, default=993)
    imap_use_ssl     = Column(Boolean, default=True)
    imap_username    = Column(String, nullable=True)
    imap_password    = Column(String, nullable=True)
    imap_folder      = Column(String, default="INBOX")
    sync_interval_min = Column(Integer, default=5)
    is_enabled       = Column(Boolean, default=False)
