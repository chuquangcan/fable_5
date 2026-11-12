"""One department mapping, defined in the backend and mirrored in frontend/src/lib/labels.ts."""
import re
from pathlib import Path

from onethread.departments import CHANNELS, SOURCE_DEPT, STAGE_DEPT, dept_of_source, dept_of_stage

REPO = Path(__file__).resolve().parents[2]


def test_mapping_values():
    assert dept_of_source("PLC2") == "production" and dept_of_source("Meeting") == "meeting"
    assert dept_of_source("PLM") == "design" and dept_of_source("HR") == "production"
    assert dept_of_stage("dinh_kem") == "quality" and dept_of_stage("khach_hang") == "logistics"
    assert dept_of_source("XYZ") is None and dept_of_source(None) is None
    assert [c.id for c in CHANNELS] == ["purchasing", "quality", "design", "warehouse", "maintenance", "logistics", "meeting"]


def test_labels_ts_mirrors_backend():
    ts = (REPO / "frontend/src/lib/labels.ts").read_text()

    def obj(name):  # `export const NAME: Record<string, string> = { a: 'b', 'X-1': 'c' }`
        body = re.search(rf"export const {name}[^=]*=\s*\{{(.*?)\}}", ts, re.S).group(1)
        return dict(re.findall(r"'?([\w-]+)'?:\s*'([^']+)'", body))

    assert obj("DEPT_OF_SOURCE") == SOURCE_DEPT and obj("DEPT_OF_STAGE") == STAGE_DEPT
