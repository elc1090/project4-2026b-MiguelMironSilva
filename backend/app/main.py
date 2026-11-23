from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import movies, auth, user_movies, admin, reviews, google_login


app = FastAPI(
    title="Webapp Filmes API",
    version="0.1.0",
)

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://effervescent-cranachan-cb04c0.netlify.app",
    settings.frontend_url,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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