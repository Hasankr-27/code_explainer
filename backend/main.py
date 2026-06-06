from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import anthropic
import os
import json
import secrets
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Code Explainer API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

sessions: dict[str, int] = {}
MAX_SESSION_REQUESTS = 10
MAX_FILE_SIZE = 100 * 1024  # 100KB
SUPPORTED_EXTENSIONS = {".py", ".js", ".java", ".c", ".cpp"}

SYSTEM_PROMPT = "Sen bir kod analiz uzmanısın. Verilen kodu Türkçe olarak analiz et ve analyze_code aracını kullanarak sonucu döndür."

ANALYZE_TOOL = {
    "name": "analyze_code",
    "description": "Kod analizinin yapılandırılmış sonucunu döndür",
    "input_schema": {
        "type": "object",
        "properties": {
            "summary": {
                "type": "string",
                "description": "Kodun genel olarak ne yaptığının açık ve kapsamlı Türkçe açıklaması"
            },
            "errors": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Bulunan mantıksal veya algoritmik hatalar (yoksa boş liste)"
            },
            "classes": {
                "type": "array",
                "description": "Üst düzey sınıflar ve bağımsız fonksiyonlar",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "type": {"type": "string", "enum": ["class", "function"]},
                        "explanation": {"type": "string", "description": "Türkçe detaylı açıklama"},
                        "methods": {
                            "type": "array",
                            "description": "Sınıf içindeki metotlar (fonksiyon ise boş liste)",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string"},
                                    "type": {"type": "string", "enum": ["method"]},
                                    "explanation": {"type": "string", "description": "Türkçe açıklama"}
                                },
                                "required": ["name", "type", "explanation"]
                            }
                        }
                    },
                    "required": ["name", "type", "explanation", "methods"]
                }
            }
        },
        "required": ["summary", "errors", "classes"]
    }
}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze")
@limiter.limit("10/minute")
async def analyze_code(request: Request, file: UploadFile = File(...)):
    session_id = request.headers.get("X-Session-ID", "").strip()
    if not session_id or session_id not in sessions:
        session_id = secrets.token_urlsafe(32)
        sessions[session_id] = 0

    if sessions[session_id] >= MAX_SESSION_REQUESTS:
        raise HTTPException(
            status_code=429,
            detail="Limitiniz doldu. Daha fazla analiz için lütfen daha sonra tekrar deneyin.",
        )

    filename = file.filename or "unknown"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Desteklenmeyen dosya türü. Desteklenen türler: .py, .js, .java, .c, .cpp",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Dosya boyutu 100KB sınırını aşıyor ({len(content) // 1024}KB).",
        )

    try:
        code_text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Dosya UTF-8 formatında okunamadı.")

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="API anahtarı yapılandırılmamış.")

    client = anthropic.Anthropic(api_key=api_key)

    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=[ANALYZE_TOOL],
            tool_choice={"type": "tool", "name": "analyze_code"},
            messages=[
                {
                    "role": "user",
                    "content": f"Bu {ext[1:].upper()} kodunu analiz et (dosya: '{filename}'):\n\n{code_text}",
                }
            ],
        )

        tool_blocks = [b for b in message.content if b.type == "tool_use"]
        if not tool_blocks:
            content_text = " | ".join(
                b.text for b in message.content if hasattr(b, "text")
            )
            raise HTTPException(status_code=500, detail=f"Claude tool yanıtı döndürmedi: {content_text[:300]}")
        result = tool_blocks[0].input

    except HTTPException:
        raise
    except anthropic.APIStatusError as e:
        raise HTTPException(status_code=502, detail=f"Claude API hatası: {e.message}")
    except anthropic.APIConnectionError:
        raise HTTPException(status_code=503, detail="Claude API'ye bağlanılamadı.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Beklenmeyen hata: {str(e)}")

    sessions[session_id] += 1
    remaining = MAX_SESSION_REQUESTS - sessions[session_id]

    return {
        "summary": result.get("summary", ""),
        "errors": result.get("errors", []),
        "classes": result.get("classes", []),
        "remaining_requests": remaining,
        "session_id": session_id,
        "filename": filename,
    }


# Serve frontend static files — must be mounted last
_frontend_dir = Path(__file__).parent.parent / "frontend"
if _frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")
