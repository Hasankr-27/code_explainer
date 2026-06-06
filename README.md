# Code Explainer

A web app that analyzes source code using the Claude API and explains what it does.

## Stack

- **Frontend**: Plain HTML, CSS, JavaScript
- **Backend**: FastAPI (Python)
- **AI**: Anthropic Claude API (`claude-sonnet-4-20250514`)

## Features

- Upload one or multiple files via drag & drop or file picker
- Supported languages: Python, JavaScript, Java, C, C++ (max 100 KB each)
- Per-session limit of 10 analysis requests
- Rate limiting: 10 requests/minute per IP
- Structured results: summary, error list, per-class/function breakdowns

## Setup

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then add your ANTHROPIC_API_KEY
uvicorn main:app --reload
```

The backend starts on **http://localhost:8000** and also serves the frontend at that address.

### 2. Frontend

Open **http://localhost:8000** in your browser — the backend serves the frontend automatically.

Alternatively, open `frontend/index.html` directly; the JavaScript will target `http://localhost:8000` automatically.

## Project Structure

```
code_explainer/
├── backend/
│   ├── main.py            # FastAPI app
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── README.md
```
