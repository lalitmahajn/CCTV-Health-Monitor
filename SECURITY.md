# Security Policy

## Supported Versions

We provide security patches and updates for the following versions of **CCTV Health Monitoring System**:

| Version | Supported          |
| :---    | :---               |
| `1.0.x` | :white_check_mark: |
| `< 1.0` | :x:                |

---

## Reporting a Vulnerability

The safety and privacy of physical surveillance networks is of utmost importance. If you discover a security vulnerability, **please do NOT disclose it publicly in GitHub Issues or Discussions.**

### How to Report

Please report security vulnerabilities through one of the following methods:

1. **GitHub Private Vulnerability Reporting**:
   - Navigate to the [Security tab](https://github.com/lalitmahajn/CCTV-Health-Monitor/security) of the repository.
   - Click **"Report a vulnerability"** to submit an advisory securely.

2. **Direct Maintainer Contact**:
   - Contact the project lead via GitHub profile: [@lalitmahajn](https://github.com/lalitmahajn).

### What to Include in Your Report

To help us investigate and resolve the issue quickly, please provide:
- A clear description of the vulnerability and its potential impact.
- Step-by-step instructions or proof-of-concept (PoC) to reproduce the vulnerability safely.
- Operating system and environment details.
- Any suggested fixes or remediation steps.

### Our Response Commitment

- **Acknowledgment**: We aim to acknowledge receipt of your report within **48 hours**.
- **Assessment**: We will evaluate the severity, confirm reproducibility, and determine impact.
- **Fix & Disclosure**: We will prepare and verify a security patch before releasing an updated installer and publishing a security advisory with credit to the reporter.

---

## Security Architecture Principles

- **On-Premise Privacy**: No RTSP video streams, snapshots, or plant camera IP addresses are transmitted outside your local network.
- **Credential Storage**: Passwords and sensitive tokens are encrypted using AES-256 (Fernet) cryptography. Never commit `.secret.key` or `cctv_monitor.db` to source control.
- **Database Isolation**: The installer is compiled to exclude any local database files to prevent exposing internal infrastructure configurations.
