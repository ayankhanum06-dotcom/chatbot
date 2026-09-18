import os
import sys
import json
import mimetypes
import urllib.request
import urllib.error
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


# ---------------------------------------------------------------------------
# 1. ENVIRONMENT CONFIGURATION & .ENV LOADER
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent

def load_env_file(filepath=None):
    env_path = BASE_DIR / ".env" if filepath is None else Path(filepath)
    if not env_path.exists():
        return
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key:
                    os.environ[key] = val

try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / ".env", override=True)
except ImportError:
    pass

load_env_file()

def get_groq_api_key():
    # Always re-read directly from .env to pick up live edits
    env_path = BASE_DIR / ".env"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip().startswith("GROQ_API_KEY="):
                    val = line.strip().split("=", 1)[1].strip().strip('"').strip("'")
                    if val and val != "your_groq_api_key_here":
                        os.environ["GROQ_API_KEY"] = val
                        return val
    key = os.environ.get("GROQ_API_KEY", "").strip()
    if key and key != "your_groq_api_key_here":
        return key
    return ""

AVAILABLE_MODELS = [
    {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B (Versatile - Recommended)", "desc": "Most powerful, fast reasoning"},
    {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B (Instant)", "desc": "Ultra-fast, lowest latency"},
    {"id": "mixtral-8x7b-32768", "name": "Mixtral 8x7B (32k context)", "desc": "High context window balance"},
    {"id": "gemma2-9b-it", "name": "Gemma 2 9B", "desc": "Efficient Google architecture"}
]

# Check if Flask is installed
try:
    from flask import Flask, request as flask_request, jsonify, render_template, Response, stream_with_context
    from flask_cors import CORS
    HAS_FLASK = True
except ImportError:
    HAS_FLASK = False

# ---------------------------------------------------------------------------
# 2. FLASK SERVER IMPLEMENTATION (When Flask is installed)
# ---------------------------------------------------------------------------
def run_flask(port):
    app = Flask(__name__, template_folder="templates", static_folder="static")
    try:
        CORS(app)
    except Exception:
        pass

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/api/status")
    def status():
        key = get_groq_api_key()
        has_key = bool(key and len(key) > 5)
        return jsonify({
            "status": "online",
            "server": "Flask",
            "has_api_key": has_key,
            "masked_key": f"{key[:6]}...{key[-4:]}" if has_key else "Not set"
        })

    @app.route("/api/models")
    def models():
        return jsonify({"models": AVAILABLE_MODELS})

    @app.route("/api/save-key", methods=["POST"])
    def save_key():
        data = flask_request.get_json(force=True, silent=True) or {}
        new_key = data.get("api_key", "").strip()
        if not new_key:
            return jsonify({"error": "No API key provided"}), 400

        os.environ["GROQ_API_KEY"] = new_key
        env_path = Path(".env")
        lines = []
        replaced = False
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip().startswith("GROQ_API_KEY="):
                        lines.append(f"GROQ_API_KEY={new_key}\n")
                        replaced = True
                    else:
                        lines.append(line)
        if not replaced:
            lines.append(f"GROQ_API_KEY={new_key}\n")
        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(lines)
        return jsonify({"success": True, "message": "API key saved to .env"})

    @app.route("/api/chat", methods=["POST"])
    def chat():
        api_key = get_groq_api_key()
        data = flask_request.get_json(force=True, silent=True) or {}
        if not api_key:
            api_key = data.get("api_key", "").strip()

        if not api_key:
            return jsonify({"error": "GROQ_API_KEY is not configured in .env."}), 401

        prompt = data.get("message", "").strip()
        history = data.get("history", [])
        model = data.get("model", "llama-3.3-70b-versatile")
        system_instruction = data.get("system_prompt", (
            "You are JEN AI, an intelligent, stylish, and futuristic AI companion. "
            "You provide engaging, clear, concise, and helpful answers."
        ))

        messages = [{"role": "system", "content": system_instruction}]
        for item in history[-10:]:
            role = item.get("role", "user")
            content = item.get("content", "")
            if role in ["user", "assistant"] and content:
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": prompt})

        def generate():
            url = "https://api.groq.com/openai/v1/chat/completions"
            payload = json.dumps({
                "model": model,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 2048,
                "stream": True
            }).encode("utf-8")

            req = urllib.request.Request(
                url, data=payload,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            )
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    for line in resp:
                        line = line.decode("utf-8").strip()
                        if line.startswith("data: "):
                            raw = line[6:]
                            if raw == "[DONE]":
                                yield f"data: {json.dumps({'done': True})}\n\n"
                                break
                            try:
                                parsed = json.loads(raw)
                                delta = parsed.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                if delta:
                                    yield f"data: {json.dumps({'content': delta})}\n\n"
                            except Exception:
                                pass
            except urllib.error.HTTPError as err:
                err_text = err.read().decode("utf-8", errors="ignore")
                yield f"data: {json.dumps({'error': err_text})}\n\n"
            except Exception as ex:
                yield f"data: {json.dumps({'error': str(ex)})}\n\n"

        return Response(stream_with_context(generate()), mimetype="text/event-stream")

    print(f"\n[*] JEN AI Flask Server running on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)


# ---------------------------------------------------------------------------
# 3. BUILT-IN PYTHON HTTP SERVER (Zero-dependency fallback if Flask not installed)
# ---------------------------------------------------------------------------
class JenAIRequestHandler(BaseHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        url_path = self.path.split("?")[0]

        # Route: Homepage
        if url_path == "/" or url_path == "/index.html":
            index_file = Path("templates/index.html")
            if index_file.exists():
                content = index_file.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(content)
                return

        # Route: API Status
        elif url_path == "/api/status":
            key = get_groq_api_key()
            has_key = bool(key and len(key) > 5)
            res = json.dumps({
                "status": "online",
                "server": "Python Built-in (Pure Standard Library)",
                "has_api_key": has_key,
                "masked_key": f"{key[:6]}...{key[-4:]}" if has_key else "Not set"
            }).encode("utf-8")

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(res)))
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(res)
            return

        # Route: API Models
        elif url_path == "/api/models":
            res = json.dumps({"models": AVAILABLE_MODELS}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(res)))
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(res)
            return

        # Route: Static Assets (CSS, JS, Images)
        elif url_path.startswith("/static/"):
            rel_path = url_path.lstrip("/")
            file_path = Path(rel_path)
            if file_path.exists() and file_path.is_file():
                mime, _ = mimetypes.guess_type(str(file_path))
                if not mime:
                    if str(file_path).endswith(".js"): mime = "application/javascript"
                    elif str(file_path).endswith(".css"): mime = "text/css"
                    else: mime = "application/octet-stream"
                content = file_path.read_bytes()

                self.send_response(200)
                self.send_header("Content-Type", mime)
                self.send_header("Content-Length", str(len(content)))
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(content)
                return

        # 404
        self.send_response(404)
        self.end_headers()
        self.wfile.write(b"Not Found")

    def do_POST(self):
        url_path = self.path.split("?")[0]
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        try:
            body = json.loads(post_data)
        except Exception:
            body = {}

        if url_path == "/api/save-key":
            new_key = body.get("api_key", "").strip()
            if not new_key:
                res = json.dumps({"error": "No API key provided"}).encode("utf-8")
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(res)
                return

            os.environ["GROQ_API_KEY"] = new_key
            env_path = Path(".env")
            lines = []
            replaced = False
            if env_path.exists():
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.strip().startswith("GROQ_API_KEY="):
                            lines.append(f"GROQ_API_KEY={new_key}\n")
                            replaced = True
                        else:
                            lines.append(line)
            if not replaced:
                lines.append(f"GROQ_API_KEY={new_key}\n")
            with open(env_path, "w", encoding="utf-8") as f:
                f.writelines(lines)

            res = json.dumps({"success": True, "message": "Key saved to .env"}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(res)
            return

        elif url_path == "/api/chat":
            api_key = get_groq_api_key()
            if not api_key:
                api_key = body.get("api_key", "").strip()

            if not api_key:
                res = json.dumps({"error": "GROQ_API_KEY is not configured in .env."}).encode("utf-8")
                self.send_response(401)
                self.send_header("Content-Type", "application/json")
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(res)
                return

            prompt = body.get("message", "").strip()
            history = body.get("history", [])
            model = body.get("model", "llama-3.3-70b-versatile")
            system_instruction = body.get("system_prompt", (
                "You are JEN AI, an intelligent, stylish, and futuristic AI companion. "
                "You provide engaging, clear, concise, and helpful answers."
            ))

            messages = [{"role": "system", "content": system_instruction}]
            for item in history[-10:]:
                role = item.get("role", "user")
                content = item.get("content", "")
                if role in ["user", "assistant"] and content:
                    messages.append({"role": role, "content": content})
            messages.append({"role": "user", "content": prompt})

            # Stream response back using SSE
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_cors_headers()
            self.end_headers()

            url = "https://api.groq.com/openai/v1/chat/completions"
            payload = json.dumps({
                "model": model,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 2048,
                "stream": True
            }).encode("utf-8")

            req = urllib.request.Request(
                url, data=payload,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            )

            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    for line in resp:
                        line = line.decode("utf-8").strip()
                        if line.startswith("data: "):
                            raw = line[6:]
                            if raw == "[DONE]":
                                self.wfile.write(f"data: {json.dumps({'done': True})}\n\n".encode("utf-8"))
                                self.wfile.flush()
                                break
                            try:
                                parsed = json.loads(raw)
                                delta = parsed.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                if delta:
                                    self.wfile.write(f"data: {json.dumps({'content': delta})}\n\n".encode("utf-8"))
                                    self.wfile.flush()
                            except Exception:
                                pass
            except urllib.error.HTTPError as err:
                err_text = err.read().decode("utf-8", errors="ignore")
                self.wfile.write(f"data: {json.dumps({'error': err_text})}\n\n".encode("utf-8"))
                self.wfile.flush()
            except Exception as ex:
                self.wfile.write(f"data: {json.dumps({'error': str(ex)})}\n\n".encode("utf-8"))
                self.wfile.flush()
            return

    def log_message(self, format, *args):
        # Quiet standard HTTP logs to keep terminal clean
        pass


def run_builtin(port):
    server = ThreadingHTTPServer(("0.0.0.0", port), JenAIRequestHandler)
    print("\n" + "="*65)
    print(f"[*] JEN AI Server running on: http://127.0.0.1:{port}")
    print(f"[*] Groq API Key: {'Active from .env' if get_groq_api_key() else 'Not detected'}")
    print("[*] Mode: Zero-Dependency Python High-Performance Server")
    print("="*65 + "\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down JEN AI Server.")
        server.server_close()


# ---------------------------------------------------------------------------
# 4. ENTRYPOINT
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    if HAS_FLASK:
        run_flask(port)
    else:
        run_builtin(port)
