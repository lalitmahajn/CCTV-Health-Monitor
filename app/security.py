import os
import re
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit, urlunsplit
from cryptography.fernet import Fernet
from app.paths import get_data_dir

KEY_FILE = Path(get_data_dir()) / ".secret.key"
ENV_KEY_VAR = "CCTV_SECRET_KEY"

_cipher: Optional[Fernet] = None
_raw_key: Optional[bytes] = None

def get_cipher() -> Fernet:
    """
    Returns the singleton Fernet cipher instance.
    Loads key from CCTV_SECRET_KEY environment variable or .secret.key file.
    Generates a secure key if none exists.
    """
    global _cipher, _raw_key
    if _cipher is not None:
        return _cipher

    key = os.environ.get(ENV_KEY_VAR)
    if not key:
        if KEY_FILE.exists():
            try:
                key = KEY_FILE.read_text(encoding="utf-8").strip()
            except Exception:
                key = None
        if not key:
            generated = Fernet.generate_key().decode("utf-8")
            try:
                KEY_FILE.write_text(generated, encoding="utf-8")
                # Set read/write only for owner if supported
                try:
                    os.chmod(KEY_FILE, 0o600)
                except Exception:
                    pass
            except Exception:
                pass
            key = generated

    key_bytes = key.encode("utf-8") if isinstance(key, str) else key
    try:
        _cipher = Fernet(key_bytes)
        _raw_key = key_bytes
    except Exception:
        fresh = Fernet.generate_key()
        _cipher = Fernet(fresh)
        _raw_key = fresh

    return _cipher


def get_secret_key() -> bytes:
    """Returns the secret key bytes for JWT signing and token verification."""
    get_cipher()
    global _raw_key
    return _raw_key


def encrypt_val(val: Optional[str]) -> Optional[str]:
    """
    Encrypts a sensitive string at rest. Adds an 'enc:' prefix.
    If already encrypted or empty, returns unmodified.
    """
    if val is None or val == "":
        return val
    val_str = str(val)
    if val_str.startswith("enc:"):
        return val_str  # Already encrypted

    cipher = get_cipher()
    encrypted = cipher.encrypt(val_str.encode("utf-8")).decode("utf-8")
    return f"enc:{encrypted}"


def decrypt_val(val: Optional[str]) -> Optional[str]:
    """
    Decrypts a sensitive string.
    If not encrypted (legacy plaintext), gracefully returns as-is.
    """
    if val is None or val == "":
        return val
    val_str = str(val)
    if not val_str.startswith("enc:"):
        return val_str  # Plaintext legacy value

    token = val_str[4:]  # Remove 'enc:' prefix
    try:
        cipher = get_cipher()
        decrypted = cipher.decrypt(token.encode("utf-8")).decode("utf-8")
        return decrypted
    except Exception:
        return val_str


def mask_rtsp_url(url: Optional[str]) -> str:
    """
    Masks BOTH username and password in RTSP URL for secure UI and API display.
    e.g. rtsp://admin:secret123@192.168.1.10:554/ch1 -> rtsp://*****:*****@192.168.1.10:554/ch1
    e.g. rtsp://admin@192.168.1.10:554/ch1 -> rtsp://*****@192.168.1.10:554/ch1
    """
    if not url:
        return ""

    url_str = str(url)
    if url_str.startswith("enc:"):
        url_str = decrypt_val(url_str) or ""

    try:
        parts = urlsplit(url_str)
        if parts.username or parts.password:
            netloc = parts.netloc
            if "@" in netloc:
                userinfo, hostport = netloc.rsplit("@", 1)
                masked_userinfo = "*****:*****" if ":" in userinfo else "*****"
                netloc = f"{masked_userinfo}@{hostport}"
                return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))
    except Exception:
        pass

    # Regex fallback for non-standard / complex characters (e.g. passwords containing @)
    if "@" in url_str:
        m = re.match(r"^(rtsp[s]?://)(.*)@([^@/]+(?::\d+)?(?:/.*)?)$", url_str)
        if m:
            scheme, creds, rest = m.groups()
            masked_creds = "*****:*****" if ":" in creds else "*****"
            return f"{scheme}{masked_creds}@{rest}"

    return url_str


def is_masked_url(url: Optional[str]) -> bool:
    """
    Returns True if the URL contains masked credential placeholders.
    Used during camera updates to prevent overwriting existing encrypted credentials with asterisks.
    """
    if not url:
        return False
    return "*****" in str(url) or "***" in str(url)
