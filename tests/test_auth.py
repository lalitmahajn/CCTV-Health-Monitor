import pytest
from app.auth import hash_password, verify_password, create_session_token, decode_session_token

def test_password_hashing():
    pwd = "secretpassword123"
    hashed = hash_password(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("wrongpassword", hashed) is False

def test_session_token():
    token = create_session_token("admin")
    payload = decode_session_token(token)
    assert payload is not None
    assert payload["sub"] == "admin"
    
    bad_payload = decode_session_token("invalid.token.here")
    assert bad_payload is None
