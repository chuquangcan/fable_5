from fastapi import FastAPI

app = FastAPI(title="One Thread demo API")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
