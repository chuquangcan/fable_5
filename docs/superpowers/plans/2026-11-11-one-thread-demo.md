# One Thread Demo CLM-0012 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng bản demo One Thread chạy một lệnh, trình diễn truy vết claim CLM-0012 (bơm MH-20 kêu to sau 3 tháng) tới nguyên nhân gốc Bearing 6203 LOT-B qua 4 màn và AI agent có dẫn nguồn.

**Architecture:** PostgreSQL giữ 6 bảng lõi được seed từ `data/story.yaml` + generator có seed cố định. FastAPI phục vụ REST chỉ đọc; cùng các hàm query đó là tool của agent Claude (vòng tool-use thủ công, stream qua SSE, fallback replay). React + React Flow dựng một màn command-room theo mockup `docs/superpowers/mockups/thread-clm0012.dc.html`.

**Tech Stack:** Python 3.13, uv, FastAPI, psycopg 3, PyYAML, pydantic 2, anthropic ≥ 1.1, sse-starlette, pytest · Node 22, Vite, React 18, TypeScript, @xyflow/react, zustand, Tailwind v4, Vitest + Testing Library · Docker Compose (postgres:16).

**Spec:** `docs/superpowers/specs/2026-11-11-one-thread-demo-design.md` (mục 3.1 "Story bible" là nguồn sự thật cho mọi con số).

## Global Constraints

- Mọi con số/ID hiển thị phải khớp bảng Story bible của spec; không task nào được tự đặt số mới.
- Đồng hồ demo cố định `2027-02-12 09:00`, múi giờ hiển thị luôn UTC+7 (giờ nhà máy), không phụ thuộc TZ của máy.
- Chỉ đọc: API không có endpoint ghi; nút Duyệt/Export/Send chỉ hiện toast.
- Style UI: token và class (`chip`, `cite`, `btn`, `tab`, `gn`, `sec`, `it`) chép từ `<style>` của mockup; font IBM Plex Sans/Mono 12px; khung chuẩn 1440×900, không vỡ ở 1280×800.
- Agent: model `claude-opus-5-5`, `output_config.effort` = env `AGENT_EFFORT` (mặc định `low`), không gửi `thinking`, `tool_choice` mặc định (auto), bật `betas=["server-side-fallback-2026-07-01"]` + `fallbacks="default"`. Câu trả lời tiếng Việt; mọi nhận định có marker `[[cite:<ID>]]`.
- `DEMO_MODE` ∈ `live | replay | auto` (mặc định `auto`), `AGENT_TIMEOUT_S=30`.
- DB: `DATABASE_URL=postgresql://onethread:onethread@localhost:5433/onethread`; test dùng DB `onethread_test` cùng server.
- API prefix `/api`; Vite proxy `/api` → `http://localhost:8000`.
- Không auth, không ingest pipeline, không Plant/Connections (icon tĩnh).

## Review Focus

1. **Máy trình chiếu khác múi giờ** → giờ vẫn hiển thị `11-03 14:05` (UTC+7). Test: `formatPlantTime` dưới `TZ=America/New_York` (Task 6).
2. **ID không tồn tại trong URL** (`/api/trace/MH20-9999`, `/api/impact/LOT-Z`) → 404 JSON `{"detail": "..."}`, không 500. Test ở Task 5.
3. **Agent dẫn nguồn ID không có trong DB** (`[[cite:IQC-9999]]`) → chip cite vẫn hiện nhưng không click được (`target_id: null`). Test ở Task 12 + Task 10.
4. **Claude lỗi/timeout giữa chừng ở chế độ auto** → client nhận `reset` rồi bản replay, không lẫn text dở dang. Test ở Task 13 (backend) + Task 10 (reducer xử lý `reset`).
5. **Người thuyết trình bấm hỏi lại khi đang stream** → stream cũ bị huỷ, không xen kẽ câu trả lời. Test ở Task 10.

---

## File Structure

```
Makefile                         # demo, db, seed, api, web, test, record-agent
docker-compose.yml               # postgres:16 on 5433
.env.example
data/story.yaml                  # hand-written story bible + volume params
backend/
  pyproject.toml
  onethread/
    config.py                    # env settings
    db.py                        # connect(), apply_schema()
    schema.sql                   # 6 core tables
    seed/story.py                # load_story()
    seed/generate.py             # generate_volume()  (pure, no DB)
    seed/__main__.py             # seed(conn, path)   (python -m onethread.seed)
    queries/common.py            # NotFound, ensure_exists()
    queries/claims.py  trace.py  events.py  links.py  docs.py  metrics.py  impact.py
    report.py                    # build_report_draft()
    api.py                       # FastAPI app
    agent/events.py              # AgentEvent pydantic union
    agent/cites.py               # CiteParser
    agent/tools.py               # TOOLS schema + dispatch_tool()
    agent/prompt.py              # SYSTEM_PROMPT
    agent/loop.py                # run_agent(), ClaudeTurn
    agent/replay.py              # replay_events(), record_run()
    agent/stream.py              # agent_event_stream() — mode switch
  tests/conftest.py test_generate.py test_story_consistency.py test_api.py
        test_report.py test_cites.py test_agent_loop.py test_agent_stream.py
frontend/
  package.json vite.config.ts index.html
  public/fixtures/agent_clm0012.json
  src/main.tsx App.tsx
  src/theme/tokens.css
  src/lib/time.ts                # formatPlantTime()
  src/api/types.ts client.ts
  src/store/demo.ts              # zustand store
  src/shell/Header.tsx ActivityBar.tsx TabBar.tsx StatusBar.tsx AppShell.tsx
  src/claims/ClaimsSidebar.tsx
  src/thread/layout.ts ThreadGraph.tsx EntityHeader.tsx ThreadView.tsx
  src/evidence/EvidencePanel.tsx MachineTab.tsx CycleChart.tsx LotTab.tsx ImpactTab.tsx
  src/agent/reducer.ts sources.ts useAgent.ts AgentPanel.tsx
  src/report/ReportView.tsx
  src/**/*.test.ts(x)
docs/demo/script.md checklist.md
```

---

### Task 1 (DEMO-01): Repo scaffold + `make demo`

**Files:**
- Create: `Makefile`, `docker-compose.yml`, `.env.example`, `backend/pyproject.toml`, `backend/onethread/__init__.py`, `backend/onethread/config.py`, `backend/onethread/db.py`, `backend/onethread/api.py`, `backend/tests/test_api.py`, `frontend/*` (Vite React-TS template), `frontend/src/App.tsx`
- Không đụng: `main.py`, root `pyproject.toml`/`uv.lock`/`.python-version` (file của user, chưa track) — backend là uv project riêng trong `backend/`.

**Interfaces:**
- Produces: `onethread.config.settings` (pydantic `BaseSettings`-style dataclass đọc env: `database_url`, `demo_mode`, `agent_model="claude-opus-5-5"`, `agent_effort="low"`, `agent_timeout_s=30`, `replay_fixture="../frontend/public/fixtures/agent_clm0012.json"`); `onethread.db.connect(url: str | None = None) -> psycopg.Connection` (row_factory=`dict_row`, autocommit); `onethread.api.app: FastAPI`; route `GET /api/health -> {"status": "ok"}`.
- Make targets: `db` (compose up -d, chờ healthcheck), `seed`, `api` (uvicorn :8000 --reload), `web` (vite :5173), `demo` (db → seed → api & web), `test` (pytest + vitest).

- [ ] **Step 1: Write the failing test** `backend/tests/test_api.py::test_health`

```python
from fastapi.testclient import TestClient
from onethread.api import app

def test_health():
    assert TestClient(app).get("/api/health").json() == {"status": "ok"}
```

- [ ] **Step 2: Run to verify fail** — `cd backend && uv run pytest tests/test_api.py::test_health -v` → FAIL (`ModuleNotFoundError: onethread`).
- [ ] **Step 3: Implement** pyproject (deps ở Tech Stack; dev: pytest, httpx), config, db, api với `/api/health`. `docker-compose.yml`: service `db` image `postgres:16`, user/pass/db `onethread`, port `5433:5432`, healthcheck `pg_isready`, init script tạo thêm DB `onethread_test`. Frontend: `npm create vite@latest frontend -- --template react-ts`, thêm `@xyflow/react zustand tailwindcss @tailwindcss/vite`, dev: `vitest @testing-library/react @testing-library/jest-dom jsdom`; `vite.config.ts` có proxy `/api` và `test.environment = "jsdom"`. `index.html` link Google Fonts IBM Plex Sans 400/500/600 + Mono 400/500. `App.tsx` render `<div>One Thread</div>`.
- [ ] **Step 4: Verify** — `uv run pytest tests/test_api.py::test_health -v` PASS; `make demo` rồi `curl localhost:8000/api/health` → `{"status":"ok"}`, `localhost:5173` thấy "One Thread", `curl localhost:5173/api/health` (qua proxy) → ok.
- [ ] **Step 5: Commit** — `git add Makefile docker-compose.yml .env.example backend frontend && git commit -m "chore: scaffold backend, frontend and make demo"`

---

### Task 2 (DEMO-02): Story bible + schema 6 bảng

**Files:**
- Create: `data/story.yaml`, `backend/onethread/schema.sql`, `backend/onethread/seed/__init__.py`, `backend/onethread/seed/story.py`, `backend/tests/conftest.py`, `backend/tests/test_generate.py`

**Interfaces:**
- Produces:
  - `schema.sql` (DROP + CREATE, idempotent):
    - `objects(object_id text PK, type text NOT NULL, name text NOT NULL, attributes jsonb NOT NULL DEFAULT '{}')`
    - `aliases(object_id text, system text, local_name text, approved_by text, PRIMARY KEY(system, local_name))`
    - `events(event_id text PK, type text, object_ids text[], event_time timestamptz, time_kind text CHECK IN ('sensor','transaction','effective'), source text, source_record_id text, payload jsonb)` + GIN index on `object_ids`, btree on `event_time`
    - `documents(doc_id text, chunk_id text, file_uri text, type text, source text, page int, text text, extracted_codes text[], effective_from timestamptz, embedding bytea NULL, PRIMARY KEY(doc_id, chunk_id))`
    - `links(link_id bigserial PK, from_id text, to_id text, relation text, tier int CHECK 1..5, status text CHECK IN ('confirmed','inferred','pending','suggested'), score real, rule_version text, evidence jsonb)` + index on `from_id`, `to_id`
    - `time_mappings(source text, offset_s real, uncertainty_s real, valid_from timestamptz)`
  - `onethread.db.apply_schema(conn) -> None`
  - `onethread.seed.story.load_story(path: Path) -> dict` trả về dict với khoá `objects, aliases, links, documents, events, time_mappings, volume` (validate bằng pydantic: mỗi object có `id,type,name`; mỗi link có `from,to,relation,tier,status`).
  - `story.yaml` chứa **đúng** dữ liệu Story bible. Object type dùng: `claim, serial(template), machine, hopper, line, lot, supplier_lot, receipt, purchase_order, supplier, inspection, sales_order, customer, shipment, box(volume)`. ID: `CLM-0012, CLM-0011, CLM-0009, M01, M02, M03, HOP-1, LINE-1, LOT-A, LOT-B, S1-6203-B, RCV-1410, RCV-2810, PO-4410, SUP-S1, IQC-5507, IQC-5531, SO-7781, SO-7790, CUS-C1, CUS-C3, CUS-C5, SHP-1112, SHP-1115, SHP-1120, BRG-6203`. Machine 02 `name: "Machine 02"`, aliases `PLC/PLC2, MES/MC-02, CMMS/Press 2`; `ERP/NCC-S1 → SUP-S1`; `SUPPLIER/S1-6203-B → LOT-B`.
  - Links viết tay (relation, tier, status, score):
    `CLM-0012 about MH20-0001 1 confirmed 1.0` · `CLM-0011 about MH20-2457 1 confirmed` (MH20-2457 là serial viết tay thuộc lô khác, ngoài dải 0001–1000 của generator) · `LOT-B fed_into HOP-1 1 confirmed` (evidence `{"record":"ISS-1103","at":"2026-11-03T13:52:00+07:00"}`) · `LOT-A fed_into HOP-1 1 confirmed` · `HOP-1 fed_into M02 1 confirmed` · `LOT-B received_under RCV-2810 1 confirmed` · `RCV-2810 received_under PO-4410 1 confirmed` · `LOT-B same_as S1-6203-B 2 confirmed 0.97` · `S1-6203-B supplied_by SUP-S1 1 confirmed` · `PO-4410 supplied_by SUP-S1 1 confirmed` · `IQC-5531 inspected LOT-B 1 confirmed` · `IQC-5507 inspected LOT-A 1 confirmed` · `LOT-B part_of BRG-6203 1 confirmed` · `CLM-0009 concerns SUP-S1 3 inferred 0.81` · `IQC-5531 specified_by D-12 4 confirmed 0.95` · `D-09 describes CLM-0009 4 confirmed 0.93` · `D-07 mentions LOT-B 4 pending 0.78` · `D-03 similar_to CLM-0009 5 suggested 0.64` · `SHP-1112 ordered_in SO-7781 1 confirmed` · `SO-7781 delivered_to CUS-C3 1 confirmed` · `SHP-1115 ordered_in SO-7790 1 confirmed` · `SO-7790 delivered_to CUS-C5 1 confirmed`.
  - `volume:` block — `n_parts: 1000`, `serial_prefix: "MH20-"`, `serial0001_cycle_index: 19`, `lot_b_start: "2026-11-03T13:52:00+07:00"`, `lot_b_cycle_s: 42`, `lot_a_start: "2026-11-03T08:00:00+07:00"`, `lot_a_cycle_s: 31`, `cycle_noise_s: 0.8`, `force_kn: {LOT-A: 12.4, LOT-B: 13.1}`, `force_noise_kn: 0.15`, `plc_offset_s: 38`, `shipments: [{id: SHP-1112, parts: 400, boxes: 17, status: delivered, date: "2026-11-12"}, {id: SHP-1115, parts: 240, boxes: 10, status: delivered, date: "2026-11-15"}, {id: SHP-1120, parts: 360, boxes: 15, status: in_warehouse}]`.
- `conftest.py` fixture `conn` (session scope): kết nối `onethread_test`, `apply_schema`; Task 3 thêm fixture `seeded_conn`.

- [ ] **Step 1: Write failing tests** trong `test_generate.py`:

```python
def test_story_loads_core_ids(story):
    ids = {o["id"] for o in story["objects"]}
    assert {"CLM-0012", "M02", "LOT-B", "IQC-5531", "PO-4410", "SUP-S1"} <= ids
    assert story["volume"]["n_parts"] == 1000
    assert sum(s["parts"] for s in story["volume"]["shipments"]) == 1000
    assert sum(s["boxes"] for s in story["volume"]["shipments"]) == 42

def test_schema_applies_twice(conn):
    from onethread.db import apply_schema
    apply_schema(conn); apply_schema(conn)
    assert conn.execute("select count(*) as n from objects").fetchone()["n"] == 0
```
(fixture `story` = `load_story(REPO/"data/story.yaml")` trong conftest.)
- [ ] **Step 2: Run** `uv run pytest tests/test_generate.py -v` → FAIL (file/module missing).
- [ ] **Step 3: Implement** `story.yaml`, `schema.sql`, `apply_schema`, `load_story`. Tài liệu D-03/D-07/D-09/D-12 trong YAML có `text` 1–3 câu tiếng Việt khớp mô tả spec (D-07: "lô B hơi rơ, theo dõi"; D-03 năm 2025, không ghi mã linh kiện), `extracted_codes`, `page` (D-12 page 7), `effective_from`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(data): story bible and core schema"`

---

### Task 3 (DEMO-03): Seed + generator

**Files:**
- Create: `backend/onethread/seed/generate.py`, `backend/onethread/seed/__main__.py`
- Modify: `backend/tests/conftest.py` (session fixture seeds once), `backend/tests/test_generate.py`

**Interfaces:**
- Consumes: `load_story`, `apply_schema`, `connect`.
- Produces:
  - `generate_volume(story: dict, seed: int = 42) -> Volume` — `Volume` là dataclass `objects: list[dict]`, `links: list[dict]`, `events: list[dict]` (cùng shape với hàng DB). Pure, không I/O.
  - `seed(conn, story_path: Path) -> None` — `apply_schema` rồi insert story + volume trong một transaction (idempotent vì schema drop/create). CLI: `python -m onethread.seed [path]`.
- Rule sinh (không suy đoán khác):
  - LOT-B: cycle i = 0..999, `event_time = lot_b_start + i*42s`; serial label: i == 19 → `MH20-0001`, các i khác lần lượt `MH20-0002…MH20-1000` theo thứ tự i. Event `press_cycle`, `object_ids=[M02, serial]`, `time_kind=sensor`, `source=PLC2`, `source_record_id=f"PLC2-{n:06d}"`, payload `{cycle_s, peak_force_kn, lot: "LOT-B", plc_time: event_time+38s}`; `cycle_s = 42 + uniform(-0.8, 0.8)`, force `13.1 ± uniform(0.15)`.
  - LOT-A: từ `lot_a_start` mỗi 31 s, dừng trước 13:52:00; `object_ids=[M02]`, lot `LOT-A`, cycle `31 ± 0.8`, force `12.4 ± 0.15`.
  - Mỗi serial LOT-B: object `type=serial, name=serial`; links `uses_lot→LOT-B`, `processed_on→M02`, `packed_in→BOX-xxx`, `shipped_in→SHP-…` (tier 1 confirmed).
  - Phân serial theo thứ tự label (0001..1000) vào shipments theo `volume.shipments` (400/240/360); trong mỗi shipment chia vào `boxes` thùng bằng `divmod(parts, boxes)` (thùng đầu nhận phần dư); box ID `BOX-001…BOX-042` liên tục; link `BOX-xxx shipped_in SHP-…`. Shipment object attributes `{status, date?, customer}`.
  - Event phụ: `maintenance` PM-0241 `2026-10-20T09:00+07:00` object_ids [M02] source CMMS payload `{result:"normal"}`; `shift` `2026-11-03T12:00+07:00` [M02] source HR payload `{operator:"NV-118", shift:"Ca 2", start:"12:00", end:"20:00", changed:false}`; `env_temp` hằng giờ 12:00–16:00 [LINE-1] source ENV-L1 giá trị `26.2, 26.5, 26.8, 26.9, 26.6`; `goods_receipt` RCV-2810 `2026-10-28T09:10+07:00` [LOT-B, PO-4410] source WMS; `lot_loaded` ISS-1103 `2026-11-03T13:52:00+07:00` [LOT-B, HOP-1] source WMS.

- [ ] **Step 1: Write failing tests** (`test_generate.py`):

```python
def test_volume_counts(story):
    v = generate_volume(story)
    serials = [o for o in v.objects if o["type"] == "serial"]
    boxes = [o for o in v.objects if o["type"] == "box"]
    assert len(serials) == 1000 and len(boxes) == 42

def test_serial_0001_pressed_at_1405(story):
    v = generate_volume(story)
    ev = next(e for e in v.events if "MH20-0001" in e["object_ids"])
    assert ev["event_time"].isoformat() == "2026-11-03T14:05:18+07:00"

def test_generation_is_deterministic(story):
    assert generate_volume(story).events == generate_volume(story).events

def test_seed_idempotent(conn, story_path):
    seed(conn, story_path); seed(conn, story_path)
    assert conn.execute("select count(*) n from objects where type='serial'").fetchone()["n"] == 1000
```
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `generate_volume` (dùng `random.Random(seed)` cục bộ, không random toàn cục), `seed`, `__main__`. Insert bằng `cursor.copy` hoặc `executemany`. Cập nhật conftest: fixture session `seeded_conn` = `conn` sau khi gọi `seed` một lần; Makefile `seed` gọi CLI.
- [ ] **Step 4: Run** `uv run pytest tests/test_generate.py -v` → PASS; `make seed` chạy < 10 s.
- [ ] **Step 5: Commit** `git commit -m "feat(data): deterministic volume generator and seed"`

---

### Task 4 (DEMO-04): Test nhất quán câu chuyện

**Files:**
- Create: `backend/tests/test_story_consistency.py`

**Interfaces:**
- Consumes: fixture `seeded_conn` (Task 3). Chỉ SQL trực tiếp — không phụ thuộc query module.

- [ ] **Step 1: Write the tests** (mỗi assert một test function, tên theo nội dung):
  - `test_cycle_time_jumps_at_1352`: avg `payload->>'cycle_s'` trên M02 `[2026-11-03 12:00, 13:52)` ∈ [30.7, 31.3]; `[13:52, 16:00)` ∈ [41.7, 42.3].
  - `test_peak_force_up_6_percent`: `round((avgB/avgA - 1)*100) == 6`.
  - `test_iqc_cpk`: IQC-5531 attributes `cpk == 0.92`, `lot == "LOT-B"`, `verdict == "Chấp nhận có điều kiện"`; IQC-5507 `cpk == 1.45`; cả hai `spec_min == 1.33`.
  - `test_receipt_date`: event `goods_receipt` RCV-2810 time `2026-10-28T09:10:00+07:00`, PO-4410.
  - `test_lot_b_loaded_1352`: event `lot_loaded` time `2026-11-03T13:52:00+07:00`; `time_mappings` PLC2 offset 38.
  - `test_impact_numbers`: số serial có link `uses_lot→LOT-B` = 1000; số box distinct = 42; shipments = 3; delivered parts = 640; in_warehouse parts = 360.
  - `test_claim_links_serial`: link `CLM-0012 about MH20-0001` tier 1 confirmed; CLM-0012 attributes `received == "2027-02-10"`, `customer == "CUS-C3"`.
  - `test_review_states`: `D-07→LOT-B` pending 0.78 tier 4; `D-03→CLM-0009` suggested tier 5.
  - `test_exclusions_normal`: PM-0241 `2026-10-20` result normal; shift operator NV-118 changed false; mọi `env_temp` ∈ [26, 27].
  - `test_delivery_three_months_before_claim`: SHP-1112 date `2026-11-12` và CLM-0012 received `2027-02-10` (≥ 88 ngày).
- [ ] **Step 2: Run** `uv run pytest tests/test_story_consistency.py -v` → PASS (dữ liệu đã có). Nếu FAIL: sửa `story.yaml`/generator, không sửa test.
- [ ] **Step 3: Mutation check** — tạm đổi `cpk: 0.92` thành `0.95` trong YAML, chạy lại → `test_iqc_cpk` FAIL; hoàn tác.
- [ ] **Step 4: Commit** `git commit -m "test(data): story consistency guard"`

---

### Task 5 (DEMO-05): Read API = tool functions

**Files:**
- Create: `backend/onethread/queries/{common,claims,trace,events,links,docs,metrics,impact}.py`
- Modify: `backend/onethread/api.py`, `backend/tests/test_api.py`

**Interfaces:**
- Consumes: `connect`, seeded DB.
- Produces (mọi hàm nhận `conn` đầu tiên; raise `NotFound(kind, id)` nếu ID không tồn tại; API map `NotFound` → 404 `{"detail": "<kind> <id> not found"}`):
  - `list_claims(conn) -> list[Claim]`; `get_claim(conn, claim_id) -> Claim` — `Claim{id, name, status, symptom, customer_id, customer_name, serial, received}`.
  - `trace_serial(conn, serial, max_depth=5) -> TraceGraph` — `TraceGraph{root, nodes: list[Node], edges: list[Edge]}`, `Node{id, type, name, attributes}`, `Edge{from_id, to_id, relation, tier, status, score}`. Thuật toán: BFS vô hướng trên `links` từ `serial`, depth ≤ `max_depth`, **không** đưa vào node type `serial` (trừ root) và `box`; cũng duyệt `documents` (link `from_id` là doc_id → node type `document`, name = doc type + page). Edge chỉ giữa các node đã chọn.
  - `get_events(conn, object_id, start: datetime | None, end: datetime | None, type: str | None = None, limit: int = 2000) -> list[Event]`.
  - `get_links(conn, object_id, statuses: list[str] | None) -> list[LinkView]` — `LinkView = Edge + other_id, other_name, direction`.
  - `get_docs(conn, object_id, at: datetime | None, hops: int = 2) -> list[DocView]` — doc liên kết trong ≤ `hops` bước (cùng luật bỏ serial/box), `effective_from <= at`; `DocView{doc_id, page, type, text, extracted_codes, tier, status, score}` (tier/status của link trực tiếp tới doc).
  - `metric(conn, kpi: Literal["cpk","cycle_time"], object_ids: list[str], start=None, end=None) -> list[MetricValue{object_id, value, source_record_id}]` — `cpk`: từ IQC `inspected` lot; `cycle_time`: mean `cycle_s` theo `payload.lot`.
  - `compare_by_lot(conn, machine_id, day: date) -> list[LotStat{lot, n, cycle_mean_s, force_mean_kn, first, last}]`.
  - `trace_forward(conn, lot_id) -> Impact{lot, parts, boxes, shipments: list[ShipmentImpact{id, customer_id, customer_name, parts, boxes, status, date}], delivered_shipments, delivered_parts, held_parts}`.
  - Routes: `GET /api/claims`, `/api/claims/{id}`, `/api/trace/{serial}`, `/api/objects/{id}/events?start&end&type&limit`, `/api/objects/{id}/links?status=confirmed,inferred`, `/api/objects/{id}/docs?at`, `/api/metrics/{kpi}?objects=LOT-A,LOT-B&start&end`, `/api/compare/{machine}?day=2026-11-03`, `/api/impact/{lot}`. Pydantic response models đặt cạnh query.

- [ ] **Step 1: Write failing tests** (`test_api.py`, dùng `TestClient` + DB test đã seed qua dependency override `get_conn`):

```python
def test_trace_contains_story_nodes(client):
    ids = {n["id"] for n in client.get("/api/trace/MH20-0001").json()["nodes"]}
    assert {"CLM-0012","SHP-1112","SO-7781","M02","HOP-1","LOT-B","RCV-2810","PO-4410",
            "S1-6203-B","SUP-S1","IQC-5531","CLM-0009","D-12","D-09","D-07","D-03"} <= ids
    assert not any(i.startswith("MH20-") and i != "MH20-0001" for i in ids)
    assert not any(i.startswith("BOX-") for i in ids)

def test_compare_by_lot(client):
    rows = {r["lot"]: r for r in client.get("/api/compare/M02?day=2026-11-03").json()}
    assert round(rows["LOT-A"]["cycle_mean_s"]) == 31 and round(rows["LOT-B"]["cycle_mean_s"]) == 42

def test_impact(client):
    b = client.get("/api/impact/LOT-B").json()
    assert (b["parts"], b["boxes"], len(b["shipments"]), b["delivered_shipments"],
            b["delivered_parts"], b["held_parts"]) == (1000, 42, 3, 2, 640, 360)

def test_docs_for_lot(client):
    docs = {d["doc_id"]: d for d in client.get("/api/objects/LOT-B/docs").json()}
    assert docs["D-07"]["status"] == "pending" and docs["D-12"]["page"] == 7

def test_metrics_cpk(client):
    vals = {v["object_id"]: v["value"] for v in client.get("/api/metrics/cpk?objects=LOT-A,LOT-B").json()}
    assert vals == {"LOT-A": 1.45, "LOT-B": 0.92}

@pytest.mark.parametrize("url", ["/api/trace/MH20-9999", "/api/impact/LOT-Z",
                                 "/api/claims/CLM-9999", "/api/objects/NOPE/events"])
def test_unknown_ids_404(client, url):   # Review Focus #2
    r = client.get(url)
    assert r.status_code == 404 and "not found" in r.json()["detail"]
```
Thêm `test_events_window` (events M02 12:00–16:00 > 400, mỗi event có `source` và `source_record_id`), `test_claims_list` (2 claim mở + CLM-0009 closed).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** queries (SQL thuần; BFS làm trong Python với truy vấn neighbors theo batch mỗi tầng) + routes + `get_conn` dependency.
- [ ] **Step 4: Run** `uv run pytest -v` → toàn bộ PASS; thử `curl localhost:8000/api/trace/MH20-0001 | jq '.nodes|length'`.
- [ ] **Step 5: Commit** `git commit -m "feat(api): read-only thread queries and routes"`

---

### Task 6 (DEMO-06): App shell theo style command room

**Files:**
- Create: `frontend/src/theme/tokens.css`, `frontend/src/lib/time.ts`, `frontend/src/store/demo.ts`, `frontend/src/shell/{Header,ActivityBar,TabBar,StatusBar,AppShell}.tsx`, `frontend/src/api/{types,client}.ts`, tests `frontend/src/lib/time.test.ts`, `frontend/src/shell/AppShell.test.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/main.tsx`

**Interfaces:**
- Consumes: mockup `docs/superpowers/mockups/thread-clm0012.dc.html` (chép nguyên `<style>` vào `tokens.css`; màu dạng CSS var: `--ink #1B1F24, --app #E6E8EB, --header #1C2026, --activity #23272E, --panel #F3F4F6, --line #C9CDD3, --line-soft #D5D8DD, --line-faint #E3E5E8, --muted #5F6670, --label #4A515B, --teal #0E7C86, --teal-ink #0B6770, --teal-bg #E8F4F5, --red #C62828, --red-ink #A61B1B, --red-bg #FDECEC, --amber #B45309, --amber-ink #7A4300, --amber-bg #FFF4E5`).
- Produces:
  - `formatPlantTime(iso: string, fmt: "MM-DD HH:mm" | "YYYY-MM-DD HH:mm" | "HH:mm" = "MM-DD HH:mm"): string` — luôn quy về UTC+7 bằng `Intl.DateTimeFormat` với `timeZone: "Asia/Ho_Chi_Minh"`.
  - `DEMO_NOW = "2027-02-12T09:00:00+07:00"`.
  - `useDemo` (zustand): `{ claimId: string|null, activeTab: "claim"|"thread"|"report", openTabs: ("claim"|"thread"|"report")[], evidenceTab: "m02"|"lot"|"impact", focusNodeId: string|null, openClaim(id), setTab(t), setEvidence(t), focusNode(id), reset() }`. Initial: `claimId null, activeTab "claim", openTabs [], evidenceTab "m02", focusNodeId null`.
  - `api` client: typed `getJSON<T>(path)` + hàm theo route Task 5 (`getClaims, getClaim, getTrace, getEvents, getLinks, getDocs, getMetric, getCompare, getImpact`); `types.ts` mirror pydantic models.
  - `AppShell` layout cố định: header 32px, body 790px (ActivityBar 48 | left slot 264 | main flex | right slot 340), StatusBar 78px; nhận `left`, `main`, `right` làm props.

- [ ] **Step 1: Write failing tests**

```ts
// time.test.ts — Review Focus #1
test("plant time ignores machine TZ", () => {
  process.env.TZ = "America/New_York";
  expect(formatPlantTime("2026-11-03T07:05:18Z")).toBe("11-03 14:05");
  expect(formatPlantTime("2027-02-12T09:00:00+07:00", "YYYY-MM-DD HH:mm")).toBe("2027-02-12 09:00");
});
// AppShell.test.tsx
test("header shows fixed demo clock and badge", () => {
  render(<AppShell left={null} main={null} right={null} />);
  expect(screen.getByText("2027-02-12 09:00")).toBeInTheDocument();
  expect(screen.getByText("DEMO · DỮ LIỆU MẪU")).toBeInTheDocument();
});
```
- [ ] **Step 2: Run** `cd frontend && npx vitest run` → FAIL.
- [ ] **Step 3: Implement** theo mockup (header, activity bar 5 icon SVG chép từ mockup, tab bar, status bar với timeline 10-28 → 02-12 và các marker: LOT-B nhập 10-28, giao C3 11-12, CLM-0012 02-10; cursor ở `11-03`). Icon Plant/Data sources là `<button disabled>`.
- [ ] **Step 4: Verify** — vitest PASS; `make web`, mở ở 1440×900 và 1280×800, đặt cạnh mockup: khớp vị trí/màu/font, không thanh cuộn ngang.
- [ ] **Step 5: Commit** `git commit -m "feat(web): command-room app shell and tokens"`

---

### Task 7 (DEMO-07): Màn 1 · Claims inbox

**Files:**
- Create: `frontend/src/claims/ClaimsSidebar.tsx`, `frontend/src/claims/ClaimsSidebar.test.tsx`
- Modify: `frontend/src/App.tsx` (left slot), `frontend/src/shell/TabBar.tsx`

**Interfaces:**
- Consumes: `api.getClaims`, `useDemo.openClaim`.
- Produces: `<ClaimsSidebar />`. `openClaim("CLM-0012")` đặt `claimId`, `openTabs = ["claim","thread"]`, `activeTab = "thread"`.
- Sections theo mockup: "Đang mở" (CLM-0012 là `<button>`, CLM-0011 là `<div>` tĩnh), "Đã đóng · cùng họ linh kiện" (CLM-0009 tĩnh), "Liên kết theo độ tin cậy" (đếm từ `trace.edges` theo status khi đã mở claim, trước đó ẩn), "Hàng đợi duyệt" (edge status `pending`), "Alias đã hợp nhất" (hardcode 3 dòng như mockup).

- [ ] **Step 1: Write failing test** — mock `api.getClaims` trả 3 claim; click `CLM-0012` → `useDemo.getState().activeTab === "thread"` và `claimId === "CLM-0012"`; `screen.queryByRole("button", {name: /CLM-0011/})` là null.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Trước khi mở claim, main hiển thị placeholder "Chọn một claim để bắt đầu truy vết".
- [ ] **Step 4: Run** → PASS; thủ công: 1 click từ màn đầu tới tab Thread.
- [ ] **Step 5: Commit** `git commit -m "feat(web): claims inbox"`

---

### Task 8 (DEMO-08): Màn 2 · Thread lanes graph

**Files:**
- Create: `frontend/src/thread/{layout.ts,ThreadGraph.tsx,EntityHeader.tsx,ThreadView.tsx}`, `frontend/src/thread/ThreadGraph.test.tsx`, `frontend/src/test/fixtures/trace.json` (chụp từ `/api/trace/MH20-0001`)

**Interfaces:**
- Consumes: `api.getTrace`, `useDemo.setEvidence`, `useDemo.focusNodeId`.
- Produces:
  - `LAYOUT: Record<string, {x: number, y: number, tone?: "focus"|"bad"|"suspect"|"pending"|"suggested", sub: string}>` — toạ độ và subtitle **đúng** mockup (lane x = 18/146/274/402/530/658; hàng y = 30/92/154). Node không có trong `LAYOUT` không render.
  - `edgeStyle(status: EdgeStatus): {stroke: string, strokeDasharray?: string}` — confirmed `#0E7C86` liền; inferred `"5 4"`; pending `"2 3"`; suggested `#8E959F` `"1 4"`.
  - `NODE_EVIDENCE: Record<string, "m02"|"lot">` = `{M02: "m02", "LOT-B": "lot", "IQC-5531": "lot"}`.
  - `<ThreadGraph trace={TraceGraph} />` — React Flow, `nodesDraggable=false`, `panOnDrag=false`, `zoomOnScroll=false`, fitView tắt, kích thước 788×260, lane labels + separators như mockup, edge type `smoothstep`; node `focusNodeId` có outline teal 2px.
  - `<EntityHeader serial claim />`, `<ThreadView />` (toolbar As-of `2026-11-03 14:05` + Lanes/Table/Timeline/Depth trang trí, graph 260px, EvidencePanel bên dưới — slot cho Task 9).

- [ ] **Step 1: Write failing tests** (mock `ResizeObserver` trong `src/test/setup.ts`):

```ts
test("renders only laid-out nodes", () => {
  render(<ThreadGraph trace={trace} />);
  for (const label of ["CLM-0012","MH20-0001","Machine 02","LOT-B","IQC-5531","D-07"])
    expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.queryByText("CUS-C3")).toBeNull();
});
test("edge styles by status", () => {
  expect(edgeStyle("pending").strokeDasharray).toBe("2 3");
  expect(edgeStyle("suggested").stroke).toBe("#8E959F");
});
test("clicking nodes switches evidence tab", async () => {
  render(<ThreadGraph trace={trace} />);
  await userEvent.click(screen.getByText("LOT-B"));
  expect(useDemo.getState().evidenceTab).toBe("lot");
  await userEvent.click(screen.getByText("Machine 02"));
  expect(useDemo.getState().evidenceTab).toBe("m02");
});
```
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Custom node component render `<button class="gn">` với tone theo `LAYOUT[id].tone`; text dòng 1 = `Node.name` (Machine 02, …) hoặc id, dòng 2 = `LAYOUT[id].sub`. Chip "nạp LOT-B 13:52" đặt tĩnh dưới HOP-1. Legend đáy như mockup.
- [ ] **Step 4: Run** → PASS; thủ công: so mockup, render < 1 s (React Profiler hoặc DevTools).
- [ ] **Step 5: Commit** `git commit -m "feat(web): thread lanes graph"`

---

### Task 9 (DEMO-09): Màn 3 · Evidence panel

**Files:**
- Create: `frontend/src/evidence/{EvidencePanel,MachineTab,CycleChart,LotTab,ImpactTab}.tsx`, `frontend/src/evidence/EvidencePanel.test.tsx`
- Modify: `frontend/src/thread/ThreadView.tsx`

**Interfaces:**
- Consumes: `api.getEvents("M02", 12:00, 16:00, "press_cycle")`, `api.getCompare("M02","2026-11-03")`, `api.getEvents("M02", 2026-10-01, 2026-11-04)` (maintenance/shift), `api.getEvents("LINE-1", …)` (env_temp), `api.getMetric("cpk", ["LOT-A","LOT-B"])`, `api.getDocs("LOT-B")`, `api.getImpact("LOT-B")`, `useDemo.evidenceTab`.
- Produces: `<EvidencePanel />` 406px, 3 tab (`m02`, `lot`, `impact`) đúng bố cục mockup.
  - `CycleChart({events, markers})` — SVG 448×210, trục 12:00–16:00, y 25–45 s, đường mục tiêu 30 s, vùng amber từ 13:52, vạch 14:05 "MH20-0001"; downsample: trung bình theo cửa sổ 8 phút.
  - MachineTab bảng: cycle 31 s → 42 s và lực ép (từ compare), lô LOT-A → LOT-B, bảo trì/vận hành/nhiệt độ (từ events); mỗi dòng có chip `cite` = `source`. Dòng "Đọc nhanh" text tĩnh như mockup.
  - LotTab: bảng IQC (ngày nhập từ event `goods_receipt` RCV-1410/RCV-2810), CLM-0009 khối "Ca tương tự", danh sách docs có badge theo `status` (confirmed "bậc 4 · duyệt", pending "chờ duyệt · 0.78", suggested "chỉ gợi ý · bậc 5").
  - ImpactTab: 4 ô KPI (1,000 · 42 · "2 lô · 640" · "1 lô · 360") + bảng shipments; số định dạng `toLocaleString("en-US")`.

- [ ] **Step 1: Write failing tests** — mock api bằng fixture JSON chụp từ API thật; render `<EvidencePanel />` với từng `evidenceTab`:
  - m02: thấy `31 s`, `42 s`, `+6%`, `PM-0241`, `NV-118`.
  - lot: thấy `0.92`, `1.45`, `CLM-0009`, `chờ duyệt · 0.78`.
  - impact: thấy `1,000`, `42`, `2 lô · 640`, `1 lô · 360`, `SHP-1115`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** `+6%` tính `Math.round((fB/fA-1)*100)`; không hardcode số nào ngoài text "Đọc nhanh".
- [ ] **Step 4: Run** → PASS; thủ công: bấm Machine 02 / LOT-B / IQC-5531 / tab "Khoanh vùng" đổi đúng nội dung.
- [ ] **Step 5: Commit** `git commit -m "feat(web): evidence panel tabs"`

---

### Task 10 (DEMO-10): Màn 4 · Agent panel (scripted)

**Files:**
- Create: `frontend/src/agent/{reducer.ts,sources.ts,useAgent.ts,AgentPanel.tsx}`, `frontend/src/agent/reducer.test.ts`, `frontend/src/agent/useAgent.test.ts`, `frontend/public/fixtures/agent_clm0012.json`
- Modify: `frontend/src/App.tsx` (right slot)

**Interfaces:**
- Produces (định dạng chung với backend Task 12/13):

```ts
export type AgentEvent =
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "text"; text: string }
  | { type: "cite"; label: string; target_id: string | null }
  | { type: "action"; action: "open_impact" | "open_report" }
  | { type: "reset" }
  | { type: "done"; elapsed_s: number }
  | { type: "error"; message: string };
```
  - Fixture: `{ "question": "Vì sao MH20-0001 của CLM-0012 kêu to? Tìm nguyên nhân gốc và phạm vi ảnh hưởng.", "events": [{ "delay_ms": number, "event": AgentEvent }] }` — 7 `tool_call` như mockup, rồi text + cite đúng nội dung panel Agent của mockup, 2 `action`, `done`. Tổng delay 15–25 s.
  - `agentReducer(state: AgentState, ev: AgentEvent): AgentState` — `AgentState{question, toolCalls: {name,args}[], segments: Segment[], actions, status: "idle"|"running"|"done"|"error", elapsed_s}`; `Segment = {kind:"text", text} | {kind:"cite", label, target_id}`; `text` nối vào segment text cuối; `reset` xoá toolCalls/segments/actions, giữ question, status running.
  - `AgentSource = (question: string, signal: AbortSignal) => AsyncIterable<AgentEvent>`; `scriptedSource` đọc fixture và chờ `delay_ms` (huỷ được bằng signal). `VITE_AGENT_SOURCE=scripted|server` (mặc định `scripted` cho tới Task 13).
  - `initialAgentState(question: string): AgentState` (status `running`, mảng rỗng).
  - `useAgent(source?: AgentSource)` → `{state, ask(q), cancel()}`; `ask` abort lần hỏi trước trước khi bắt đầu.
  - `CiteChip({label, target_id})` export từ `AgentPanel.tsx`; dùng lại trong `ReportView`.
  - `<AgentPanel />` theo mockup: bubble câu hỏi, khối tool calls `▾ N tool calls · read-only · {elapsed}s`, đoạn văn tách theo `"\n\n"`, chip `cite` là `<button>` khi `target_id` khác null (click → `focusNode(target_id)` + `setEvidence(NODE_EVIDENCE[id] ?? current)`), ngược lại `<span>`; nút action: `open_impact` → `setEvidence("impact")`, `open_report` → `setTab("report")`; chip gợi ý `/trace /as-of /impact /report` — chip "/report" và nút Send với textarea rỗng gửi câu hỏi fixture.

- [ ] **Step 1: Write failing tests**

```ts
test("text accumulates and cites interleave", () => {
  let s = initialAgentState("q");
  for (const e of [{type:"text",text:"Nguyên "},{type:"text",text:"nhân"},
                   {type:"cite",label:"IQC-5531",target_id:"IQC-5531"}] as AgentEvent[])
    s = agentReducer(s, e);
  expect(s.segments).toEqual([{kind:"text",text:"Nguyên nhân"},{kind:"cite",label:"IQC-5531",target_id:"IQC-5531"}]);
});
test("reset clears partial answer", () => {   // Review Focus #4
  let s = agentReducer(initialAgentState("q"), {type:"text",text:"dở dang"});
  s = agentReducer(s, {type:"reset"});
  expect(s.segments).toEqual([]); expect(s.status).toBe("running");
});
test("unknown cite is not clickable", () => {  // Review Focus #3
  render(<CiteChip label="IQC-9999" target_id={null} />);
  expect(screen.queryByRole("button")).toBeNull();
});
test("asking again aborts the previous stream", async () => {  // Review Focus #5
  const { result } = renderHook(() => useAgent(fakeSource));  // fakeSource yields "A…" slowly, then "B…"
  act(() => { result.current.ask("first"); result.current.ask("second"); });
  await waitFor(() => expect(result.current.state.status).toBe("done"));
  expect(textOf(result.current.state)).not.toContain("A");
});
```
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** reducer, sources, hook, panel, fixture.
- [ ] **Step 4: Run** → PASS; thủ công: bấm "/report" → tool calls hiện dần, câu trả lời đủ trong 15–25 s, click cite `IQC-5531` → node được highlight + tab LOT-B.
- [ ] **Step 5: Commit** `git commit -m "feat(web): scripted agent panel"`

---

### Task 11 (DEMO-11): Trang nháp báo cáo RCA

**Files:**
- Create: `backend/onethread/report.py`, `backend/tests/test_report.py`, `frontend/src/report/ReportView.tsx`, `frontend/src/report/ReportView.test.tsx`
- Modify: `backend/onethread/api.py` (route), `frontend/src/App.tsx` (tab "report")

**Interfaces:**
- Consumes: `get_claim`, `metric`, `compare_by_lot`, `trace_forward`, `get_events`.
- Produces: `build_report_draft(conn, claim_id) -> ReportDraft`; route `GET /api/reports/{claim_id}/draft` (404 nếu claim không tồn tại). `ReportDraft{id: "RPT-CLM-0012", title, subtitle, summary: list[Segment], chain: list[{id, label, tone}], impact: Impact, cause: list[Segment], actions: list[str]}`; `Segment = {kind: "text", text} | {kind: "cite", label, target_id}` (cùng shape với frontend).
- Nội dung template (số lấy từ query, không gõ tay): tiêu đề "Truy vết claim CLM-0012 — tiếng ồn bất thường trên bơm MH-20"; chain `CLM-0012 → SHP-1112 → MH20-0001 → Machine 02 · 11-03 14:05 → LOT-B ≡ S1-6203-B → PO-4410 · S1`; cause: Cpk 0.92 < 1.33 [IQC-5531], cycle 31 → 42 s [PLC2], loại trừ [PM-0241][HR][ENV-L1]; actions: "Cách ly 360 part SHP-1120 trong kho", "Liên hệ Customer C5 về SHP-1115 (240 part, chưa có claim)", "Yêu cầu Supplier S1 lập 8D cho LOT-B", "Áp lại mức lấy mẫu IQC n=20 như CLM-0009".
- `<ReportView />` bố cục Report của bộ wireframe (trang 680px trên nền xám, 4 ô impact, nút Export PDF / Send to Quality → toast "Demo: chưa gửi").

- [ ] **Step 1: Write failing tests** — backend: `build_report_draft(conn, "CLM-0012")` có `impact.delivered_parts == 640`, mọi phần tử `cause` kiểu cite có `target_id` tồn tại trong `objects` hoặc `documents`; `GET /api/reports/CLM-9999/draft` → 404. Frontend: render với fixture → thấy "RPT-CLM-0012", "640", ít nhất 3 chip cite.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Nút "Tạo nháp báo cáo" (action `open_report`) mở tab này.
- [ ] **Step 4: Run** pytest + vitest → PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: RCA report draft"`

> **M1 · Dry-run #1:** `make demo`, đi trọn 4 bước với agent scripted. Ghi lỗi luồng vào `docs/demo/checklist.md` (tạo ở Task 15 nếu chưa có).

---

### Task 12 (DEMO-12): Agent Claude live qua tool

**Files:**
- Create: `backend/onethread/agent/{events.py,cites.py,tools.py,prompt.py,loop.py}`, `backend/tests/test_cites.py`, `backend/tests/test_agent_loop.py`
- Modify: `backend/onethread/api.py` (route `GET /api/agent/ask`)

**Interfaces:**
- Consumes: query functions Task 5.
- Produces:
  - `events.py`: pydantic models `ToolCallEv, TextEv, CiteEv, ActionEv, ResetEv, DoneEv, ErrorEv` mirror `AgentEvent` của Task 10 (discriminator `type`), union `AgentEvent`; constructor tắt dạng `TextEv("...")` cho phép positional `text`.
  - `CiteParser(known_ids: set[str])` với `feed(chunk: str) -> list[AgentEvent]` và `flush() -> list[AgentEvent]` — tách marker `[[cite:<ID>]]` (regex `\[\[cite:([A-Za-z0-9._-]+)\]\]`) kể cả khi marker bị cắt giữa hai chunk; ID không thuộc `known_ids` → `cite` với `target_id=None`.
  - `tools.py`: `TOOLS: list[dict]` — 7 tool `trace_serial{serial}`, `get_events{object_id, start?, end?, type?}`, `get_links{object_id, statuses?}`, `get_docs{object_id, at?}`, `metrics{kpi: enum[cpk,cycle_time], object_ids, start?, end?}`, `run_python{analysis: enum[compare_by_lot], machine_id, day}`, `trace_forward{lot_id}`; mỗi tool có `description` tiếng Anh ngắn, `input_schema` với `additionalProperties: false` + `required`, `"eager_input_streaming": True`. `dispatch_tool(conn, name: str, raw_input: dict) -> dict` — validate bằng pydantic model của tool; lỗi validate hoặc `NotFound` → trả `{"error": "..."}` (loop gửi `is_error: true`); kết quả JSON-serializable, list cắt ≤ 200 phần tử (events: thêm khoá `"summary"` gồm count/mean theo lot).
  - `prompt.py`: `SYSTEM_PROMPT` (chép nguyên văn):

```text
You are One Thread's root-cause assistant for a pump factory. You answer in Vietnamese.
You can only read data through the provided tools; never invent records, numbers or IDs.
After every factual statement, cite the record it came from as [[cite:<ID>]] using an ID returned by a tool (object_id, doc_id or source_record_id/source such as PLC2, PM-0241, ENV-L1).
Use only links with status confirmed or inferred as evidence, and say which kind you used when it matters. Links with status pending or suggested may only be mentioned as leads to check, never as evidence.
For a customer claim: trace the serial, check the machine events around the time the part was made, compare lots, check incoming inspection and documents, look for similar past claims, rule out maintenance, operator and temperature when the data allows, then size the impact with trace_forward.
Structure the final answer as short paragraphs separated by a blank line, starting with "Nguyên nhân khả dĩ:", then the machine evidence, "Đã loại trừ:", "Khoanh vùng:", and one line on similar cases and unconfirmed leads. Keep it under 160 words.
```
  - `loop.py`:
    - `class ClaudeTurn` — `__init__(client: anthropic.AsyncAnthropic, model: str, effort: str)`; `async def __call__(messages: list) -> AsyncIterator[tuple[Literal["text","message"], Any]]` dùng `client.beta.messages.stream(model, max_tokens=16000, system=SYSTEM_PROMPT, tools=TOOLS, messages=messages, output_config={"effort": effort}, betas=["server-side-fallback-2026-07-01"], fallbacks="default")`; yield `("text", event.delta.text)` cho `content_block_delta`/`text_delta`, cuối cùng `("message", await stream.get_final_message())`.
    - `async def run_agent(question: str, claim_id: str, *, conn, turn: Callable, max_tool_calls: int = 10) -> AsyncIterator[AgentEvent]` — vòng thủ công: messages bắt đầu bằng user message chứa question + `"Context: claim {claim_id}"`; mỗi lượt: stream text qua `CiteParser`; lấy final message; nếu `stop_reason == "refusal"` → `error`; `max_tokens` → flush rồi `done`; `tool_use` → append `message.content` (nguyên block) làm assistant turn, với mỗi `tool_use` block yield `tool_call` rồi chạy `dispatch_tool`, gom **tất cả** `tool_result` vào **một** user message; vượt `max_tool_calls` → thêm text "Đã dừng vì quá số bước." và `done`; `end_turn` → flush, yield `action open_impact` nếu text có "Khoanh vùng", luôn yield `action open_report`, rồi `done{elapsed_s}`.
    - `known_ids` = toàn bộ `objects.object_id` ∪ `documents.doc_id` ∪ `distinct events.source` ∪ `events.source_record_id` của các event loại maintenance/shift/env_temp/goods_receipt/lot_loaded (nạp một lần khi khởi động).
  - Route `GET /api/agent/ask?q=...&claim=CLM-0012&mode=` → `EventSourceResponse`, mỗi event `data: <json>`. Ở task này route chạy live; Task 13 bọc mode.

- [ ] **Step 1: Write failing tests**

```python
# test_cites.py
def test_marker_split_across_chunks():
    p = CiteParser({"IQC-5531"})
    out = p.feed("Cpk 0.92 [[ci") + p.feed("te:IQC-5531]] xong") + p.flush()
    assert [e.type for e in out] == ["text", "cite", "text"]
    assert out[1].target_id == "IQC-5531"

def test_unknown_id_has_null_target():   # Review Focus #3
    out = CiteParser(set()).feed("x [[cite:IQC-9999]]")
    assert out[-1].type == "cite" and out[-1].target_id is None

# test_agent_loop.py — FakeTurn replays scripted turns, no network
async def test_tool_then_answer(seeded_conn):
    turn = FakeTurn([tool_use_msg("trace_serial", {"serial": "MH20-0001"}),
                     text_msg("Nguyên nhân khả dĩ: LOT-B [[cite:IQC-5531]]\n\nKhoanh vùng: 1,000 part")])
    evs = [e async for e in run_agent("q", "CLM-0012", conn=seeded_conn, turn=turn)]
    assert evs[0].type == "tool_call" and evs[0].name == "trace_serial"
    assert any(e.type == "cite" and e.target_id == "IQC-5531" for e in evs)
    assert [e.action for e in evs if e.type == "action"] == ["open_impact", "open_report"]
    assert evs[-1].type == "done"
    assert turn.requests[1][-1]["content"][0]["type"] == "tool_result"   # one user msg with results

async def test_bad_tool_input_returns_error_result(seeded_conn):
    turn = FakeTurn([tool_use_msg("trace_serial", {"serial": "MH20-9999"}), text_msg("ok")])
    _ = [e async for e in run_agent("q", "CLM-0012", conn=seeded_conn, turn=turn)]
    assert turn.requests[1][-1]["content"][0]["is_error"] is True

async def test_refusal_yields_error(seeded_conn):
    turn = FakeTurn([refusal_msg()])
    evs = [e async for e in run_agent("q", "CLM-0012", conn=seeded_conn, turn=turn)]
    assert evs[-1].type == "error"
```
(`FakeTurn`, `tool_use_msg`, `text_msg`, `refusal_msg` là helper trong `conftest.py` dựng object có `.content`, `.stop_reason`; `FakeTurn.requests` ghi lại `messages` mỗi lượt.)
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** events, cites, tools, prompt, loop, route. Credential: `anthropic.AsyncAnthropic()` không tham số (đọc `ANTHROPIC_API_KEY` hoặc profile `ant auth login`).
- [ ] **Step 4: Run** `uv run pytest -v` → PASS. Kiểm tra live (tốn API, chạy 5 lần):
  `curl -N "localhost:8000/api/agent/ask?q=V%C3%AC%20sao%20MH20-0001%20c%E1%BB%A7a%20CLM-0012%20k%C3%AAu%20to%3F&claim=CLM-0012"` → có `LOT-B`, `0.92`, loại trừ 3 yếu tố, `1,000`/`42`/`2` lô; 5/5 lần. Thêm 1 câu ngoài kịch bản "Machine 02 bảo trì lần cuối khi nào?" → trả "20/10" có cite `PM-0241`. Nếu < 5/5: nâng `AGENT_EFFORT=medium` rồi chạy lại, ghi lại effort chọn vào `.env.example`.
- [ ] **Step 5: Commit** `git commit -m "feat(agent): live Claude agent over read-only tools"`

---

### Task 13 (DEMO-13): DEMO_MODE fallback + record/replay

**Files:**
- Create: `backend/onethread/agent/replay.py`, `backend/onethread/agent/stream.py`, `backend/tests/test_agent_stream.py`
- Modify: `backend/onethread/api.py`, `Makefile` (`record-agent`), `frontend/src/agent/sources.ts`, `frontend/.env` (`VITE_AGENT_SOURCE=server`)

**Interfaces:**
- Consumes: `run_agent`, `ClaudeTurn`, fixture format Task 10.
- Produces:
  - `load_fixture(path) -> Fixture`; `async def replay_events(fx: Fixture, max_delay_ms: int = 400) -> AsyncIterator[AgentEvent]`.
  - `async def record_run(question, claim_id, out_path) -> None` — chạy live, ghi `{question, events:[{delay_ms, event}]}` (delay = thời gian thật giữa các event); `make record-agent` gọi nó và ghi đè `frontend/public/fixtures/agent_clm0012.json` (commit file mới sau khi review nội dung).
  - `async def agent_event_stream(question, claim_id, mode: Literal["live","replay","auto"], *, live_factory, fixture, timeout_s) -> AsyncIterator[AgentEvent]` — `replay`: chỉ fixture; `live`: chỉ live, lỗi → `error`; `auto`: chạy live trong `asyncio.timeout(timeout_s)`; nếu `anthropic.APIError`/`APIConnectionError`/`TimeoutError`/event `error` xảy ra → yield `reset` rồi toàn bộ replay. Route đọc `mode` từ query, mặc định `settings.demo_mode`.
  - Frontend `serverSource` dùng `EventSource("/api/agent/ask?...&mode=...")`, đóng khi `done`/`error` hoặc abort; phím tắt `Alt+Shift+D` bật/tắt `mode=replay` (hiện chấm amber nhỏ cạnh chữ "Agent" khi bật).

- [ ] **Step 1: Write failing tests**

```python
async def test_auto_falls_back_after_partial_output():   # Review Focus #4
    async def live():
        yield TextEv("dở dang"); raise anthropic.APIConnectionError(request=fake_request())
    evs = [e async for e in agent_event_stream("q", "CLM-0012", "auto",
           live_factory=lambda: live(), fixture=FX, timeout_s=5)]
    i = [e.type for e in evs].index("reset")
    assert evs[0].type == "text" and evs[i+1:] == FX_EVENTS

async def test_auto_times_out_to_replay():
    async def slow():
        await asyncio.sleep(10); yield TextEv("never")
    evs = [e async for e in agent_event_stream("q","CLM-0012","auto",
           live_factory=lambda: slow(), fixture=FX, timeout_s=0.1)]
    assert evs[0].type == "reset" and evs[-1].type == "done"

async def test_replay_mode_never_calls_live(): ...   # live_factory raises if called
```
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** backend + frontend source switch; `make record-agent`, xem lại fixture mới, commit.
- [ ] **Step 4: Verify** — pytest PASS; thủ công: `make demo`, hỏi → live; tắt mạng (hoặc đặt `ANTHROPIC_BASE_URL=http://127.0.0.1:9`) rồi hỏi lại → câu trả lời replay xuất hiện, UI không khác biệt; `Alt+Shift+D` ép replay.
- [ ] **Step 5: Commit** `git commit -m "feat(agent): demo mode fallback and replay recording"`

---

### Task 14 (DEMO-14): Polish & điều khiển demo

**Files:**
- Modify: `frontend/src/store/demo.ts`, `frontend/src/App.tsx`, `frontend/src/shell/Header.tsx`, `frontend/src/thread/ThreadGraph.tsx`, components có fetch
- Create: `frontend/src/App.test.tsx`

**Interfaces:**
- Produces:
  - Deep link `?step=1|2|3|4`: 1 = inbox; 2 = CLM-0012 + tab thread; 3 = như 2 + `evidenceTab="lot"`; 4 = như 3 + agent tự `ask(fixture.question)`. Hàm `applyStep(step: 1|2|3|4): void` trong store.
  - Nút "Reset demo" trong header (bên trái badge) → `reset()` store + `cancel()` agent + xoá query string.
  - Skeleton loading (khối xám `--line-faint`) cho graph/panel khi fetch; lỗi fetch hiện dòng đỏ "Không tải được dữ liệu · thử lại" có nút retry.
  - Khi `focusNodeId` đổi: các edge trên đường từ root tới node đó tô `stroke-width 3` trong 1.2 s (CSS transition).

- [ ] **Step 1: Write failing tests** — `applyStep(3)` → `{claimId: "CLM-0012", activeTab: "thread", evidenceTab: "lot"}`; sau `reset()` state bằng initial; render `<App />` với `?step=2` (mock api) → thấy "MH20-0001".
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify** — vitest PASS; thủ công 3 vòng liên tiếp: reset → kịch bản đủ 4 bước, DevTools console không lỗi; kiểm tra 1440×900 và 1280×800.
- [ ] **Step 5: Commit** `git commit -m "feat(web): demo controls, deep links and loading states"`

---

### Task 15 (DEMO-15): Kịch bản thuyết trình + dự phòng

**Files:**
- Create: `docs/demo/script.md`, `docs/demo/checklist.md`

**Interfaces:**
- Consumes: deep links Task 14, `DEMO_MODE`.
- Produces:
  - `script.md`: 4 phần theo Demo Flow của spec, mỗi phần: thao tác bấm, câu nói (≤ 3 câu), con số phải nhấn mạnh, deep link khôi phục nếu lạc. Tổng ≤ 7 phút. Kết bằng câu "Không có One Thread, bước 2–4 là email qua lại giữa sản xuất, chất lượng, mua hàng và logistics".
  - `checklist.md`: trước giờ T-30 phút: `make demo`, `make test` xanh, `DEMO_MODE=auto`, chạy 1 lượt live, độ phân giải 1440×900 hoặc 1280×800, zoom trình duyệt 100%, tắt thông báo, mở sẵn video backup; khi sự cố: `Alt+Shift+D`, `?step=N`, chuyển video.

- [ ] **Step 1: Viết** hai file.
- [ ] **Step 2: Dry-run** 2 lần có người ngoài đội xem; ghi thời gian từng phần vào `script.md`, sửa chỗ vượt giờ.
- [ ] **Step 3: Quay** video backup toàn kịch bản (OBS), lưu offline; ghi đường dẫn trong `checklist.md`.
- [ ] **Step 4: Commit** `git commit -m "docs(demo): presenter script and checklist"`

---

## Thứ tự & song song

```
Ngày 1  T1 → T2 → T3 → T4           ║ T6 (chỉ cần mockup)
Ngày 2  T5                          ║ T7, T8 (dùng fixture JSON tới khi T5 xong)
Ngày 3  T9, T10, T11                → M1 Dry-run #1 (agent scripted)
Ngày 4  T12 → T13                   → Dry-run #2 (live + fallback)
Ngày 5  T14, T15                    → Tổng duyệt
```
