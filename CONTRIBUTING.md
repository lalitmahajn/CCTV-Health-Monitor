# Contributing to CCTV Health Monitoring System

Thank you for your interest in contributing to the **CCTV Health Monitoring System**! We welcome contributions from developers, security professionals, and surveillance system integrators.

---

## 📑 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Adding Camera / NVR Support](#adding-camera--nvr-support)
  - [Submitting Pull Requests](#submitting-pull-requests)
- [Development Setup](#development-setup)
  - [Backend Setup (FastAPI & Python)](#backend-setup-fastapi--python)
  - [Frontend Setup (React & Vite)](#frontend-setup-react--vite)
- [Coding & Commit Standards](#coding--commit-standards)
  - [Commit Message Format](#commit-message-format)
  - [Code Style Guidelines](#code-style-guidelines)
- [Testing & Verification](#testing--verification)

---

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior following the guidelines in `CODE_OF_CONDUCT.md`.

---

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report, please check existing [GitHub Issues](https://github.com/lalitmahajn/CCTV-Health-Monitor/issues) to avoid duplicates.

When reporting a bug, use our [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md) and include:
- A clear, descriptive title.
- Exact steps to reproduce the issue.
- Operating system version (e.g. Windows 11 Pro 23H2).
- Python version (e.g. 3.11.9).
- Relevant log output from `cctv_service.log` or browser console errors.
- Expected behavior vs. actual behavior.

### Suggesting Enhancements

Feature requests are welcome! Please open an issue using the [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md) describing:
- The problem you want to solve.
- Your proposed solution or workflow.
- Any alternatives considered.

### Adding Camera / NVR Support

If you have tested feeds from new camera vendors (e.g. Dahua, Hikvision, CP Plus, Uniview, Axis, Hanwha), please share:
- Hardware vendor & model number.
- Verified main stream and substream RTSP URL templates.
- Notes on codec quirks (H.264, H.265, MJPEG).

---

## Development Setup

### Backend Setup (FastAPI & Python)

1. **Fork and Clone** the repository:
   ```bash
   git clone https://github.com/<your-username>/CCTV-Health-Monitor.git
   cd CCTV-Health-Monitor
   ```

2. **Create a virtual environment**:
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```

3. **Install dependencies**:
   ```powershell
   python -m pip install -r requirements.txt
   python -m pip install pystray Pillow pytest
   ```

4. **Run the server in development mode**:
   ```powershell
   python run.py --port 8085
   ```

### Frontend Setup (React & Vite)

1. **Navigate to the frontend directory**:
   ```powershell
   cd frontend
   npm install
   ```

2. **Start the Vite development server**:
   ```powershell
   npm run dev
   ```

3. **Build the production frontend**:
   ```powershell
   npm run build
   ```
   *(Compiled static assets are placed in `frontend/dist/` and served automatically by FastAPI).*

---

## Coding & Commit Standards

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]
```

**Allowed Types:**
- `feat`: A new feature (e.g., `feat(inventory): add CSV export`)
- `fix`: A bug fix (e.g., `fix(scanner): handle RTSP timeout on unequipped channels`)
- `docs`: Documentation changes (e.g., `docs: update setup guide`)
- `style`: Formatting, missing semicolons, no code changes
- `refactor`: Refactoring production code without behavior changes
- `perf`: Performance improvements (e.g., `perf(snapshots): batch parallel requests`)
- `test`: Adding or refactoring tests
- `build`: Build system or dependency updates (e.g., `build: update Inno Setup script`)

### Code Style Guidelines

- **Python**: Follow PEP 8 style guidelines. Use type hints (`typing`) where applicable.
- **Frontend**: Clean TypeScript with functional React components and Tailwind CSS utilities.
- **Database Safety**: Always use parameterized SQL queries (`?`) to prevent SQL injection. Maintain SQLite WAL mode with busy timeout handling.

---

## Testing & Verification

Before submitting a Pull Request:
1. Ensure the backend starts cleanly without unhandled exceptions:
   ```powershell
   python run.py --port 8085
   ```
2. Build the frontend and verify there are no TypeScript or bundling errors:
   ```powershell
   cd frontend
   npm run build
   ```
3. Verify that changes do not alter database migration integrity or expose local configuration secrets.
