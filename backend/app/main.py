from urllib.parse import urlsplit

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import movies, auth, user_movies, admin, reviews, google_login


app = FastAPI(
    title="Webapp Filmes API",
    version="0.1.0",
)

def allowed_frontend_origins(frontend_url: str) -> list[str]:
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://effervescent-cranachan-cb04c0.netlify.app",
        frontend_url,
    ]
    frontend = urlsplit(frontend_url)
    if frontend.hostname in {"localhost", "127.0.0.1"}:
        # `localhost` and its IPv4 address are different browser origins. Limit
        # the alias to the configured port, including custom Compose ports.
        alias = "127.0.0.1" if frontend.hostname == "localhost" else "localhost"
        port = f":{frontend.port}" if frontend.port is not None else ""
        origins.append(f"{frontend.scheme}://{alias}{port}")
        origins.extend(("http://localhost:4173", "http://127.0.0.1:4173"))
    return list(dict.fromkeys(origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_frontend_origins(settings.frontend_url),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(movies.router)
app.include_router(auth.router)
app.include_router(google_login.router)
app.include_router(admin.router)
app.include_router(user_movies.router)
app.include_router(reviews.router)
app.include_router(reviews.personal_router)


@app.get("/")
def root():
    return {
        "message": "API Webapp Filmes está rodando"
    }


@app.get("/health")
def health():
    return {
        "status": "ok"
    }