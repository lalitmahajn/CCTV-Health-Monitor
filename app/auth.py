import datetime
from datetime import timezone
from typing import Optional, Dict, Any
import bcrypt
import jwt
from fastapi import Request, HTTPException
from app.security import get_secret_key

JWT_ALGORITHM = "HS256"
SESSION_COOKIE_NAME = "cctv_session"
DEFAULT_EXPIRE_DAYS = 7


def hash_password(password: str) -> str:
    """Hashes a plaintext password using bcrypt with salt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Verifies a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_session_token(username: str, expires_days: int = DEFAULT_EXPIRE_DAYS) -> str:
    """Generates an HMAC-SHA256 signed JWT session token."""
    secret = get_secret_key().decode("utf-8")
    now = datetime.datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "iat": int(now.timestamp()),
        "exp": int((now + datetime.timedelta(days=expires_days)).timestamp())
    }
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def decode_session_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates a session JWT token."""
    try:
        secret = get_secret_key().decode("utf-8")
        payload = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
        return payload
    except Exception:
        return None


async def require_admin(request: Request) -> Dict[str, Any]:
    """
    FastAPI dependency enforcing valid admin session cookie or Bearer token.
    Raises 401 if missing, expired, or invalid.
    """
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token and "authorization" in request.headers:
        auth_header = request.headers["authorization"]
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = decode_session_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return payload


async def get_optional_admin(request: Request) -> Optional[Dict[str, Any]]:
    """
    FastAPI dependency returning decoded payload if cookie or Bearer header is valid, else None.
    Does not raise HTTPException.
    """
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token and "authorization" in request.headers:
        auth_header = request.headers["authorization"]
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if not token:
        return None
    return decode_session_token(token)
