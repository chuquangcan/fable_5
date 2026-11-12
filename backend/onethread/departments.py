"""Departments: the one mapping from an object's `attributes.stage` and a record's `source` system to the
department that owns it. Mirrored in frontend/src/lib/labels.ts (test_departments checks the two agree)."""
from pydantic import BaseModel

DEPARTMENTS = ("purchasing", "quality", "production", "warehouse", "logistics", "design", "maintenance")

STAGE_DEPT: dict[str, str] = {
    "cung_ung": "purchasing",
    "kho": "warehouse",
    "san_xuat": "production",
    "dinh_kem": "quality",
    "logistics": "logistics",
    "khach_hang": "logistics",
    "hau_mai": "quality",
}

# `meeting` is a sending channel, not a department that has to act.
SOURCE_DEPT: dict[str, str] = {
    "ERP": "purchasing",
    "WMS": "warehouse",
    "QMS": "quality",
    "PLM": "design",
    "CMMS": "maintenance",
    "PLC1": "production",
    "PLC2": "production",
    "PLC3": "production",
    "MES": "production",
    "ENV-L1": "production",
    "HR": "production",
    "Meeting": "meeting",
}


class Channel(BaseModel):
    id: str
    dept: str
    system: str | None


# One chip per department and system on the plant twin's department strip.
CHANNELS: list[Channel] = [
    Channel(id="purchasing", dept="purchasing", system="ERP"),
    Channel(id="quality", dept="quality", system="QMS"),
    Channel(id="design", dept="design", system="PLM"),
    Channel(id="warehouse", dept="warehouse", system="WMS"),
    Channel(id="maintenance", dept="maintenance", system="CMMS"),
    Channel(id="logistics", dept="logistics", system=None),
    Channel(id="meeting", dept="meeting", system=None),
]


def dept_of_stage(stage: str | None) -> str | None:
    return STAGE_DEPT.get(stage) if stage else None


def dept_of_source(source: str | None) -> str | None:
    return SOURCE_DEPT.get(source) if source else None
