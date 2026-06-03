"""FastAPI reserve assessment engine."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from reserve import assess_reserve
from snow_lookup import load_climate_table, load_code_editions

app = FastAPI(title="Building Code Lookup Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SitePayload(BaseModel):
    constructionYear: int | None = None
    locationKey: str | None = None
    lat: float | None = None
    lng: float | None = None
    replaceBallastedWithAdhered: bool = False
    isWoodStructure: bool = False
    satisfactoryPerformance: bool = False
    roofWeightExistingKPa: float = 0.35
    roofWeightNewKPa: float = 0.22


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/climate")
def climate():
    return load_climate_table()


@app.get("/editions")
def editions():
    return load_code_editions()


@app.post("/assess")
def assess(site: SitePayload):
    return assess_reserve(site.model_dump())
