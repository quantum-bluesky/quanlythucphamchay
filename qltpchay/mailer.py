import smtplib
from email.message import EmailMessage


def send_mail_notification(
    *,
    mail_config: dict,
    subject: str,
    body: str,
) -> dict:
    config = mail_config if isinstance(mail_config, dict) else {}
    if not bool(config.get("enabled")):
        return {"sent": False, "skipped": True, "reason": "disabled"}

    smtp_host = str(config.get("smtp_host") or "").strip()
    from_email = str(config.get("from_email") or "").strip()
    recipients = [
        str(email or "").strip()
        for email in (config.get("to_emails") or [])
        if str(email or "").strip()
    ]
    if not smtp_host or not from_email or not recipients:
        return {"sent": False, "skipped": True, "reason": "missing-config"}

    subject_prefix = str(config.get("subject_prefix") or "").strip()
    clean_subject = str(subject or "").strip()
    if subject_prefix:
        clean_subject = f"{subject_prefix} {clean_subject}".strip()

    message = EmailMessage()
    message["Subject"] = clean_subject
    message["From"] = from_email
    message["To"] = ", ".join(recipients)
    message.set_content(str(body or "").strip())

    smtp_port = int(config.get("smtp_port") or 587)
    username = str(config.get("username") or "").strip()
    password = str(config.get("password") or "")
    use_ssl = bool(config.get("use_ssl"))
    use_tls = bool(config.get("use_tls"))

    if use_ssl:
        smtp_client = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20)
    else:
        smtp_client = smtplib.SMTP(smtp_host, smtp_port, timeout=20)

    with smtp_client as server:
        if not use_ssl and use_tls:
            server.starttls()
        if username:
            server.login(username, password)
        server.send_message(message)

    return {
        "sent": True,
        "skipped": False,
        "reason": "",
        "recipient_count": len(recipients),
    }
