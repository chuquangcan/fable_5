# Workspace, Plant Twin & Notification Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biến demo One Thread thành workspace kiểu VS Code gồm hai nhóm tab (main + dock). Trong đó có plant twin (tab ghim), các product tab theo serial, mỗi tab giữ state riêng, và feed thông báo/thay đổi ở rail trái. Backend bổ sung feed, plant state và overview.

**Architecture:** Đợt A thêm dữ liệu (line 2, bảng `notices`) và 3 endpoint đọc. Đợt B viết lại zustand store thành mô hình tab (`groups`, `product[tabId]`, `dockActive`), dựng shell (TabBar dùng chung, Workspace/Dock/Resizer) và chuyển các component cũ sang đọc state theo tab. Đợt C dựng TwinView (@xyflow/react), Feed, nội dung dock và context cho agent.

**Tech Stack:** React 19, zustand 5 (`zustand/middleware` persist), @xyflow/react 12, vitest + Testing Library, FastAPI, psycopg 3, Postgres 16, pytest.

**Spec:** `docs/superpowers/specs/2026-11-12-workspace-twin-design.md` (nguồn yêu cầu gốc: `One_Thread_demo_UI_spec.txt`)

## Global Constraints

- Nhãn UI bằng **tiếng Anh**. Mã nội bộ (stage `san_xuat`, `kho`…) giữ nguyên.
- Không thêm dependency mới. Kéo thả dùng HTML5 drag events; persist dùng `zustand/middleware`.
- Giữ `theme/tokens.css`. Màu mới khai báo thành token trong `tokens.css`.
- Mốc as-of mặc định `2026-11-03T14:05:00+07:00`. Mọi giờ hiển thị theo UTC+7 qua `lib/time.ts`.
- Status line luôn có nhãn demo và `read-only`.
- Ở 1440×900 không có scroll toàn trang. Mỗi pane tự scroll (`min-height: 0`).
- `backend/tests/test_story_consistency.py` **không được sửa** và phải xanh.
- Ánh xạ phòng ban chỉ định nghĩa ở `backend/onethread/departments.py`, mirror sang `frontend/src/lib/labels.ts`; component không hard-code.
- Cuối mỗi đợt: `cd backend && uv run pytest`, `cd frontend && npx vitest run && npm run lint && npm run build` đều xanh. Lint không thêm cảnh báo mới ngoài 3 cảnh báo `set-state-in-effect` đang có.
- Baseline trước khi bắt đầu: pytest 161 pass, vitest 112 pass. DB test bật bằng `make db`.
- Commit message kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Workspace đã lưu bị hỏng hoặc từ phiên bản cũ** (localStorage chứa JSON rác hoặc shape cũ): app phải mở về trạng thái mặc định (twin + overview), không trắng trang. Test ở Task B2.
2. **Một product tab tải thất bại** (serial 404, mạng lỗi): tab đó hiện lỗi kèm Retry, các product tab khác vẫn chạy bình thường. Test ở Task B4.
3. **Đóng product tab trong khi dock đang hiện tab Details của nó**: dock quay về Plant overview, không để lại tab Details mồ côi hay `product[tabId]` thừa. Test ở Task B2.
4. **Card feed không có object, có object không nằm trên twin, hoặc lời gọi fault-trace/impact lỗi** (D-03, file upload chưa link, CLM-0009); bấm nhanh nhiều card liên tiếp: reach rỗng, không crash, kết quả của card cũ không ghi đè card mới. Test ở Task C2.
5. **As-of nằm ngoài khoảng có dữ liệu** (trước cycle đầu tiên, hoặc 2027-02-10 sau khi chọn card claim): state/overview trả `stopped`, output 0, trend rỗng, giá trị "—"; UI không lỗi. Test ở Task A4 và Task C4.

---

## Đợt A · Dữ liệu và backend

### Task 1 (A1): Line 2, cycle M01/M03 và bảng `notices`

**Files:**
- Modify: `data/story.yaml`, `backend/onethread/schema.sql`, `backend/onethread/seed/story.py`, `backend/onethread/seed/generate.py`, `backend/onethread/seed/__init__.py`
- Test: `backend/tests/test_generate.py`, `backend/tests/test_notices_seed.py` (mới)

**Interfaces:**
- Produces: bảng `notices(notice_id text PK, kind text CHECK IN ('alert','4m_change'), severity text NULL, category text NULL, title text, reason text, source text, acting text[], object_ids text[], status text CHECK IN ('proposed','watching','approved','closed'), at timestamptz)`; model `StoryNotice` và `Story.notices: list[StoryNotice] = []`; object `LINE-2`, `HOP-2`, `LOT-C`, `BRG-6204`; source của event `PLC1` (M01) và `PLC3` (M03).

- [ ] **Step 1: Viết test fail**

```python
# test_generate.py
def test_extra_machines_have_cycles_but_no_serials(story):
    v = generate_volume(story)
    extra = [e for e in v.events if e["type"] == "press_cycle" and e["object_ids"][0] in ("M01", "M03")]
    assert {e["object_ids"][0] for e in extra} == {"M01", "M03"}
    assert all(len(e["object_ids"]) == 1 for e in extra)
    assert {e["source"] for e in extra} == {"PLC1", "PLC3"}
    assert len([o for o in v.objects if o["type"] == "serial"]) == 1000

# test_notices_seed.py
def test_notices_seeded(seeded_conn):
    rows = {r["notice_id"]: r for r in seeded_conn.execute("select * from notices")}
    assert set(rows) == {"4M-0001", "4M-0002", "AL-0001"}
    al = rows["AL-0001"]
    assert (al["kind"], al["severity"], al["source"], al["status"]) == ("alert", "P1", "PLC2", "watching")
    assert al["at"] == t(2026, 11, 3, 14, 0) and set(al["acting"]) == {"quality", "maintenance"}
    assert rows["4M-0001"]["at"] == t(2026, 10, 28, 15, 0) and "IQC-5531" in rows["4M-0001"]["object_ids"]
    assert rows["4M-0002"]["at"] == t(2026, 11, 3, 13, 52) and rows["4M-0002"]["source"] == "WMS"

def test_line2_topology(seeded_conn):
    has = lambda f, to, rel: seeded_conn.execute(
        "select 1 from links where from_id=%s and to_id=%s and relation=%s", (f, to, rel)).fetchone()
    for f, to, rel in [("M01", "LINE-2", "part_of"), ("M03", "LINE-2", "part_of"), ("HOP-1", "LINE-1", "part_of"),
                       ("HOP-2", "LINE-2", "part_of"), ("HOP-2", "M01", "fed_into"), ("HOP-2", "M03", "fed_into"),
                       ("LOT-C", "HOP-2", "fed_into")]:
        assert has(f, to, rel), (f, to, rel)

def test_m01_mean_cycle(seeded_conn):
    r = seeded_conn.execute("select avg((payload->>'cycle_s')::float) c from events where type='press_cycle' and 'M01'=any(object_ids)").fetchone()
    assert 32.5 <= r["c"] <= 33.5

def test_clm0012_fault_reach_excludes_line2(seeded_conn):
    from onethread.queries.fault import claim_fault_trace
    ft = claim_fault_trace(seeded_conn, "CLM-0012")
    ids = {m.id for m in ft.red + ft.orange}
    assert not ids & {"M01", "M03", "HOP-2", "LINE-2", "LOT-C"}
```

(`t(...)` lấy theo mẫu trong `test_story_consistency.py`.)

- [ ] **Step 2:** `cd backend && uv run pytest tests/test_generate.py tests/test_notices_seed.py -q`. Kết quả mong đợi: FAIL (`notices` không tồn tại, thiếu M01/M03).

- [ ] **Step 3: Cài đặt**
  - `story.yaml` thêm:
    - Object: `LINE-1` thêm `product: MH-20`; `LINE-2 {stage: san_xuat, product: MH-25}`; `HOP-2 {stage: san_xuat}`; `LOT-C {stage: kho, part: BRG-6204, qty: 4000}`; `BRG-6204 {stage: dinh_kem}`; M01 thêm `{cycle_target_s: 32, line: LINE-2}`; M03 thêm `{cycle_target_s: 29, line: LINE-2}`.
    - 7 link liệt kê trong test (tier 1, confirmed, `T1-exact`). `LOT-C→HOP-2` có `evidence: {valid_from: "2026-11-03T08:00:00+07:00"}`.
    - `volume.extra_machines: [{machine: M01, source: PLC1, lot: LOT-C, cycle_s: 33}, {machine: M03, source: PLC3, lot: LOT-C, cycle_s: 29.5}]` và `volume.extra_window: {start: "2026-11-03T08:00:00+07:00", end: "2026-11-03T20:00:00+07:00"}`.
    - Mục `notices:` theo bảng §2.3 của spec. Title/reason bằng tiếng Anh, ví dụ AL-0001: title `"M02 cycle time 31 s → 42 s"`, reason `"Jump right after LOT-B was loaded into HOP-1 at 13:52; target 30 s"`. 4M-0001: `"LOT-B accepted conditionally"` / `"IQC-5531 Cpk 0.92 < 1.33 (drawing D-12 p.7)"`. 4M-0002: `"HOP-1 material change LOT-A → LOT-B"` / `"Issue ISS-1103 at 13:52"`.
  - `generate.py`: `_extra_cycles(vol, rng) -> list[dict]` dùng `_press_event`, nhưng tham số hoá prefix và source (`EV-PLC1-000001`…). Nhiễu ±`cycle_noise_s`, lực lấy `force_kn["LOT-A"]`, offset 0. Gọi hàm này **sau** khi đã sinh LOT-A/LOT-B để không đổi chuỗi random của M02.
  - `schema.sql`: tạo bảng `notices`, thêm `notices` vào đầu câu `DROP TABLE`. `seed/__init__.py`: `executemany` insert notices.

- [ ] **Step 4:** `uv run pytest -q`. Kết quả mong đợi: toàn bộ pass, gồm `test_story_consistency.py` không sửa gì. Nếu `repository.list_tables` có test đếm 7 bảng thì cập nhật test đó, vì `notices` là bảng thứ 8 được hiển thị.

- [ ] **Step 5: Commit** `feat(seed): line 2 with M01/M03 cycles and notices table`

### Task 2 (A2): Ánh xạ phòng ban

**Files:**
- Create: `backend/onethread/departments.py`, `backend/tests/test_departments.py`
- Modify: `frontend/src/lib/labels.ts`, `frontend/src/lib/labels.test.ts`

**Interfaces:**
- Produces (Python): `DEPARTMENTS: tuple[str, ...]` = `("purchasing","quality","production","warehouse","logistics","design","maintenance")`; `STAGE_DEPT: dict[str,str]`; `SOURCE_DEPT: dict[str,str]`; `dept_of_stage(stage: str|None) -> str|None`; `dept_of_source(source: str|None) -> str|None`; `class Channel(BaseModel): id: str; dept: str; system: str|None`; `CHANNELS: list[Channel]`.
- Produces (TS): `DEPT_OF_STAGE`, `DEPT_OF_SOURCE: Record<string,string>`, `CHANNELS: {id: string; dept: string; system: string|null}[]`, `deptLabel(code) -> string` (purchasing→"Purchasing"…, meeting→"Meeting"), `channelLabel(c) -> string` (ví dụ "Purchasing · ERP", "Logistics", "Meeting").

- [ ] **Step 1: Test**

```python
def test_mapping_values():
    assert dept_of_source("PLC2") == "production" and dept_of_source("Meeting") == "meeting"
    assert dept_of_source("PLM") == "design" and dept_of_source("HR") == "production"
    assert dept_of_stage("dinh_kem") == "quality" and dept_of_stage("khach_hang") == "logistics"
    assert dept_of_source("XYZ") is None
    assert [c.id for c in CHANNELS] == ["purchasing", "quality", "design", "warehouse", "maintenance", "logistics", "meeting"]

def test_labels_ts_mirrors_backend():
    ts = (REPO / "frontend/src/lib/labels.ts").read_text()
    def obj(name):  # parse `export const NAME: Record<string, string> = { a: 'b', 'X-1': 'c' }`
        body = re.search(rf"export const {name}[^=]*=\s*\{{(.*?)\}}", ts, re.S).group(1)
        return dict(re.findall(r"'?([\w-]+)'?:\s*'([^']+)'", body))
    assert obj("DEPT_OF_SOURCE") == SOURCE_DEPT and obj("DEPT_OF_STAGE") == STAGE_DEPT
```

`labels.test.ts`: `deptLabel('maintenance') === 'Maintenance'`, `channelLabel(CHANNELS[0]) === 'Purchasing · ERP'`.

- [ ] **Step 2:** Chạy cả hai bộ test. Kết quả mong đợi: FAIL.
- [ ] **Step 3:** Cài đặt đúng các giá trị trong §2.2 của spec. `SOURCE_DEPT` gồm `ERP, WMS, QMS, PLM, CMMS, PLC1, PLC2, PLC3, MES, ENV-L1, HR, Meeting`.
- [ ] **Step 4:** pytest + vitest pass.
- [ ] **Step 5: Commit** `feat: single department mapping (backend + labels mirror)`

### Task 3 (A3): `GET /api/feed`

**Files:**
- Create: `backend/onethread/queries/feed.py`, `backend/tests/test_feed.py`
- Modify: `backend/onethread/api.py`

**Interfaces:**
- Consumes: `dept_of_source`, `dept_of_stage` (A2); `repository.list_documents` (`DocRow`); `review.review_queue`; `claims.list_claims`.
- Produces: `class FeedRef(BaseModel): doc_id: str|None = None; link_id: int|None = None; claim_id: str|None = None`; `class FeedItem(BaseModel): id: str; kind: Literal['alert','4m','doc','link','claim']; badge: str; at: datetime; title: str; reason: str; sender: str|None; acting: list[str]; objects: list[str]; status: Literal['proposed','watching','approved','closed']; ref: FeedRef`; `list_feed(conn) -> list[FeedItem]`; route `GET /api/feed -> list[FeedItem]`.

Quy tắc dựng từng loại item theo bảng §2.4 của spec. Bổ sung:
- id của item: notice → `notice_id`; doc → `doc_id`; link → `f"LINK-{link_id}"`; claim → claim id.
- `at` của claim = 00:00 ngày `received` theo UTC+7. Claim không có `received` (CLM-0009) dùng ngày cuối tháng của `period`.
- `at` của link = `effective_from` của tài liệu ở đầu link. Nếu không có thì dùng `DEFAULT_AS_OF = datetime(2026,11,3,14,5,tzinfo=PLANT_TZ)`, hằng số đặt trong `feed.py`.
- Chuỗi hiển thị: doc → title = `f"{doc_id} · {type}"`, reason = 120 ký tự đầu của excerpt. Link → title = `f"{from_id} → {to_id}"`, reason = `f"{relation} · score {score:.2f}"`. Claim → title = `f"{id} · {symptom}"`, reason = `f"{customer_name} · {serial}"`.
- Badge của notice = `severity` nếu `kind == 'alert'`, ngược lại là `"4M"`. Kind `4m_change` đổi thành `'4m'`.

- [ ] **Step 1: Test**

```python
def test_feed_newest_first(client):
    items = client.get("/api/feed").json()
    ats = [i["at"] for i in items]
    assert ats == sorted(ats, reverse=True) and len({i["id"] for i in items}) == len(items)

def test_feed_notice_items(client):
    by = {i["id"]: i for i in client.get("/api/feed").json()}
    al = by["AL-0001"]
    assert (al["kind"], al["badge"], al["sender"], al["status"]) == ("alert", "P1", "production", "watching")
    assert set(al["acting"]) == {"quality", "maintenance"} and "M02" in al["objects"]
    assert (by["4M-0001"]["badge"], by["4M-0001"]["sender"]) == ("4M", "quality")

def test_feed_docs_links_claims(client):
    by = {i["id"]: i for i in client.get("/api/feed").json()}
    assert (by["D-12"]["badge"], by["D-12"]["sender"]) == ("DOC", "design")
    assert by["D-07"]["status"] == "proposed" and by["D-07"]["sender"] == "meeting"
    link = next(i for i in by.values() if i["kind"] == "link" and i["objects"] == ["D-07", "LOT-B"])
    assert link["badge"] == "LINK" and isinstance(link["ref"]["link_id"], int)
    assert by["CLM-0012"]["status"] == "watching" and "MH20-0001" in by["CLM-0012"]["objects"]
    assert by["CLM-0009"]["status"] == "closed"

def test_feed_includes_uploads(client, seeded_conn):
    from onethread import attach
    res = client.post("/api/documents/samples/CoA_S1-6203-B.pdf").json()
    try:
        assert any(i["id"] == res["doc_id"] and i["kind"] == "doc" for i in client.get("/api/feed").json())
    finally:
        attach.reset_uploads(seeded_conn)
```

(Trước khi viết, kiểm tra tên sample và trường `doc_id` của `AttachResult` trong `test_attach.py`.)

- [ ] **Step 2:** Chạy test. Kết quả mong đợi: FAIL 404.
- [ ] **Step 3:** Cài đặt `list_feed` và route.
- [ ] **Step 4:** `uv run pytest -q` pass.
- [ ] **Step 5: Commit** `feat(api): merged notification feed`

### Task 4 (A4): `GET /api/plant/state` và `GET /api/plant/overview`

**Files:**
- Create: `backend/onethread/queries/plant_state.py`, `backend/tests/test_plant_state.py`
- Modify: `backend/onethread/api.py`

**Interfaces:**
- Consumes: bảng `notices`, `review.REVIEWABLE`, `flow.FLOW_STATUSES`, `departments.dept_of_source`.
- Produces:
  - `NodeState { state: Literal['running','stopped','warning','watch4m','idle']; value: str; sub: str|None }`
  - `TwinEdge { from_id, to_id, relation, status }`
  - `PlantState { at: datetime; nodes: dict[str, NodeState]; edges: list[TwinEdge] }`
  - `Kpis { output: int; cycle_s: float|None; target_s: float|None; open_alerts: int; watch_4m: int; pending_links: int }`
  - `OverviewRow { id; kind: Literal['line','machine']; name; line: str|None; state; cycle_s: float|None; target_s: float|None; output: int; lot: str|None; trend: list[float] }`
  - `ShipmentRisk { id; status; date: str|None; customer: str|None; parts: int; risk: Literal['high','none']; reason: str }`
  - `SourceRow { source; dept: str|None; events: int; last_at: datetime|None; delay_s: float|None }`
  - `PlantOverview { at; kpis: Kpis; rows: list[OverviewRow]; shipments: list[ShipmentRisk]; sources: list[SourceRow] }`
  - `plant_state(conn, at: datetime) -> PlantState`, `plant_overview(conn, at: datetime) -> PlantOverview`
  - Route `GET /api/plant/state?at=` và `GET /api/plant/overview?at=` (`at` mặc định là `DEFAULT_AS_OF` từ A3).
- Chỗ lệch nhỏ so với spec §4.2: cạnh của twin nằm trong `PlantState.edges` (lọc theo hiệu lực tại `at`, giữa các asset của plant) thay vì sửa shape của `/api/plant`, để `PlantSidebar` giữ nguyên.

Quy tắc tính lấy từ §2.5–2.6 của spec. Bổ sung:
- notice được coi là "mở" khi `status IN ('proposed','watching') AND at <= :at`.
- Thứ tự ưu tiên state của máy: warning > watch4m > running/stopped.
- Value của máy = `f"{avg:.0f} s / {target:.0f} s"`, hoặc `"— / {target} s"` nếu chưa có cycle nào.
- Lot đang dùng / hopper: link `fed_into` vào hopper, `valid_from <= at < valid_to` (evidence). Không có `valid_from` nghĩa là luôn hiệu lực.
- Output = số press cycle từ 00:00 của ngày `at` đến `at`.
- Trend = tối đa 30 giá trị trung bình 8 phút gần nhất trước `at`.

- [ ] **Step 1: Test**

```python
AT = "2026-11-03T14:05:00+07:00"

def test_state_at_1405(client):
    s = client.get("/api/plant/state", params={"at": AT}).json()["nodes"]
    assert s["M02"]["state"] == "warning" and s["M02"]["value"] == "42 s / 30 s"
    assert s["M01"]["state"] == "running" and s["LOT-B"]["state"] == "watch4m"
    assert s["LOT-B"]["value"] == "4,981 pcs"           # 5000 − 19 cycles 13:52 … 14:04:36
    assert s["HOP-1"]["value"] == "LOT-B" and s["SHP-1112"]["value"] == "delivered · 2026-11-12"

def test_state_before_lot_b(client):
    s = client.get("/api/plant/state", params={"at": "2026-11-03T13:00:00+07:00"}).json()
    assert s["nodes"]["M02"]["state"] == "running" and s["nodes"]["HOP-1"]["value"] == "LOT-A"
    pairs = {(e["from_id"], e["to_id"]) for e in s["edges"]}
    assert ("LOT-A", "HOP-1") in pairs and ("LOT-B", "HOP-1") not in pairs

def test_overview_rows_and_kpis(client):
    o = client.get("/api/plant/overview", params={"at": AT}).json()
    assert [r["id"] for r in o["rows"]] == ["LINE-1", "M02", "LINE-2", "M01", "M03"]
    m02 = next(r for r in o["rows"] if r["id"] == "M02")
    assert m02["lot"] == "LOT-B" and len(m02["trend"]) == 30
    assert (o["kpis"]["open_alerts"], o["kpis"]["watch_4m"]) == (1, 2) and o["kpis"]["output"] > 0
    assert all(s["risk"] == "high" for s in o["shipments"]) and "IQC-5531" in o["shipments"][0]["reason"]
    plc2 = next(r for r in o["sources"] if r["source"] == "PLC2")
    assert plc2["delay_s"] == 38 and plc2["dept"] == "production"

@pytest.mark.parametrize("at", ["2026-10-01T08:00:00+07:00", "2027-02-10T00:00:00+07:00"])
def test_out_of_range_as_of(client, at):            # Review Focus #5
    s = client.get("/api/plant/state", params={"at": at}).json()["nodes"]
    assert s["M01"]["state"] == "stopped"
    o = client.get("/api/plant/overview", params={"at": at}).json()
    assert o["kpis"]["output"] == 0 and all(r["output"] == 0 for r in o["rows"])
    if at.startswith("2026-10"):
        assert s["M01"]["value"] == "— / 32 s" and all(r["trend"] == [] for r in o["rows"])
```

- [ ] **Step 2:** Chạy test. Kết quả mong đợi: FAIL.
- [ ] **Step 3:** Cài đặt. Tính cycle bằng SQL theo máy: `ORDER BY event_time DESC LIMIT 20` với điều kiện `event_time <= at`.
- [ ] **Step 4:** `uv run pytest -q` pass.
- [ ] **Step 5: Commit** `feat(api): plant state and overview as of a time`

### Task 5 (A5): Xếp hạng search và cờ `traceable` của claim

**Files:**
- Modify: `backend/onethread/queries/repository.py` (`search`), `backend/onethread/queries/claims.py`, `frontend/src/api/types.ts` (`Claim.traceable`)
- Test: `backend/tests/test_api.py`

**Interfaces:**
- Produces: `Claim.traceable: bool`, bằng true khi object serial của claim có trong bảng `objects`.

- [ ] **Step 1: Test**

```python
def test_search_finds_serial_by_fragment(client):
    assert client.get("/api/search", params={"q": "0457"}).json()[0]["id"] == "MH20-0457"
    hits = client.get("/api/search", params={"q": "MH20-00"}).json()
    assert hits[0]["type"] == "serial"

def test_claims_traceable_flag(client):
    by = {c["id"]: c for c in client.get("/api/claims").json()}
    assert by["CLM-0012"]["traceable"] is True and by["CLM-0011"]["traceable"] is False
```

- [ ] **Step 2:** Chạy test, xác nhận FAIL.
- [ ] **Step 3:** Thứ tự kết quả: object khớp tiền tố → object khác → tài liệu, cắt ở `limit`. `traceable` tính bằng `EXISTS (SELECT 1 FROM objects s WHERE s.object_id = c.attributes->>'serial')`.
- [ ] **Step 4:** pytest pass; vitest pass (cập nhật fixture claim nào thiếu `traceable`).
- [ ] **Step 5: Commit** `feat(api): rank serials in search, flag traceable claims`

**Kết thúc đợt A:** chạy toàn bộ pytest + vitest + lint, rồi báo lại cho người dùng.

---

## Đợt B · Workspace store và shell

### Task 6 (B1): Thao tác tab thuần (`store/tabs.ts`)

**Files:**
- Create: `frontend/src/store/tabs.ts`, `frontend/src/store/tabs.test.ts`

**Interfaces:**
- Produces:

```ts
export type TabKind = 'twin'|'thread'|'claim'|'report'|'doc'|'object'|'overview'|'review'|'table'|'feed'
export interface Tab { id: string; kind: TabKind; target: string; title: string; pinned: boolean; preview: boolean }
export type GroupId = 'main' | 'bottom' | 'bottom2'
export interface Group { tabs: Tab[]; active: string | null }
export function openIn(g: Group, tab: Omit<Tab,'preview'|'pinned'> & Partial<Pick<Tab,'pinned'>>, opts?: { preview?: boolean; activate?: boolean }): Group
export function keepIn(g: Group, id: string): Group
export function closeIn(g: Group, id: string): Group
export function moveIn(g: Group, fromId: string, toId: string): Group
```

- [ ] **Step 1: Test** (mỗi ý là một `test(...)`):
  - mở tab mới thì thêm vào cuối và kích hoạt; mở id đã có thì chỉ kích hoạt, không thêm bản sao;
  - `preview: true` thay tab preview cũ (giữ đúng vị trí cũ) và tab mới có `preview: true`;
  - mở cố định một id đang là preview thì `preview` thành false;
  - `keepIn` đổi `preview` thành false;
  - `closeIn` với tab ghim không đổi gì (trả về cùng object); đóng tab đang mở thì kích hoạt tab bên phải, nếu không có thì bên trái, nếu không còn tab nào thì `active = null`;
  - `moveIn(g, 'c', 'a')` với `[a,b,c]` thành `[c,a,b]`.
- [ ] **Step 2:** `npx vitest run src/store/tabs.test.ts` → FAIL.
- [ ] **Step 3:** Cài đặt dưới dạng hàm thuần, bất biến (immutable).
- [ ] **Step 4:** Test pass.
- [ ] **Step 5: Commit** `feat(web): pure tab-group operations`

### Task 7 (B2): Viết lại store workspace (`store/demo.ts`)

**Files:**
- Modify: `frontend/src/store/demo.ts`, `frontend/src/store/demo.test.ts`, `frontend/src/lib/story.ts`, `frontend/src/lib/deepLink.ts`
- Test: `frontend/src/store/demo.test.ts`, `frontend/src/lib/deepLink.test.ts`

**Interfaces:**
- Consumes: B1; `getClaim`, `getLinks` từ `api/client`.
- Produces (state và action mà các task sau dùng):

```ts
export type EvidenceTab = 'overview'|'events'|'machine'|'lot'|'impact'
export type Mode = 'normal'|'fault'
export type Rail = 'feed'|'assets'|'data'
export interface ProductTab { root: string; claimId: string|null; threadIds: string[]; focusNodeId: string|null; mode: Mode; faultOrigin: string|null }
export interface Layout { rail: Rail; leftW: number; agentW: number; dockH: number; dockCollapsed: boolean; split: boolean }
export const DEFAULT_AS_OF = '2026-11-03T14:05:00+07:00'
export const threadTabId = (serial: string) => `thread:${serial}`
export const detailTabId = (threadId: string) => `detail:${threadId}`
// state
groups: Record<GroupId, Group>; product: Record<string, ProductTab>; evidence: Record<string, EvidenceTab>  // key = owner (tab id hoặc 'twin')
twin: { selected: string|null }; dockActive: Record<string, string>; layout: Layout; asOf: string
hoverIds: string[]; reach: { red: string[]; orange: string[] }; picker: { id: string; tabIds: string[] } | null
dataVersion; flashNodeId; attachOpen; agentOpen; agentCmd
// actions
openTab(g: GroupId, tab, opts?); keepTab(g, id); closeTab(g, id); moveTab(g, fromId, toId); activate(g, id); splitDock(on: boolean)
setLayout(p: Partial<Layout>); setRail(r: Rail); setAsOf(at: string); setHover(ids: string[]); setReach(r)
openProduct(serial: string, opts?: { claimId?: string; preview?: boolean }): string
openClaim(claimId: string, serial: string): void       // claimId + mode 'fault' trên thread:<serial>
openReport(claimId: string); openDoc(id: string); selectTwin(id: string|null, title?: string)
focusNode(tabId, id|null); selectNode(tabId, id); setMode(tabId, m); setFaultOrigin(tabId, id|null); setThreadIds(tabId, ids); setRoot(tabId, serial)
setEvidence(owner: string, t: EvidenceTab)
goTo(id: string): void | Promise<void>
viewOnPlant(id: string); viewOnThread(id: string); closePicker()
applyStep(step: Step, mode?: Mode); reset(); bumpData(); flash(id); openAttach(); closeAttach(); toggleAgent()
// selectors (export riêng)
activeMain(s): Tab|null; activeProduct(s): { tabId: string; p: ProductTab } | null
```

Hành vi chính (đúng §3.2 của spec):
- **Trạng thái ban đầu:**
  - main = `[twin (pinned, title 'Plant')]`;
  - bottom = `[overview (pinned, 'Plant overview'), table:sources ('Data sources'), review ('Review queue')]`, active `overview`;
  - `bottom2` rỗng; `layout = { rail: 'feed', leftW: 280, agentW: 340, dockH: 300, dockCollapsed: false, split: false }`.
- **`openProduct`:** tạo tab `thread:<serial>` (title `Thread · <serial>`) và tab bottom `detail:<id>` (kind `thread`, title `Details · <serial>`, target = id của thread tab), đặt `dockActive[id] = detail`.
- **`activate('main', id)`:** đặt bottom active = `dockActive[id]` nếu tab đó còn tồn tại; nếu không thì twin dùng `overview`, product dùng `detail:<id>`. Ngược lại, `activate('bottom', id)` ghi `dockActive[mainActive] = id`.
- **`closeTab('main', thread:X)`:** xoá `product[thread:X]`, xoá `evidence[thread:X]`, đóng `detail:thread:X`. Không còn tab Details nào mồ côi.
- **`setMode`/`setFaultOrigin`** không làm gì khi `claimId == null`.
- **`goTo`:**
  - `^D-` → `openDoc`;
  - `^MH20-` → `openProduct`;
  - `^BOX-` → `getLinks(box)` lấy `from_id` của link `packed_in` đầu tiên rồi `openProduct`;
  - `^CLM-` → `getClaim(id)`, nếu `traceable` thì `openClaim(id, serial)`;
  - còn lại → `openTab('bottom', {id:'object:'+id, kind:'object', target:id, title:id}, {preview:true})`; sau đó nếu main là twin thì `twin.selected = id`, còn nếu là product tab có id trong `threadIds` thì `selectNode(tabId, id)`.
- **`selectNode(tabId, id)`:** focus node đó. Đặt `evidence[tabId] = NODE_EVIDENCE[id]` khi tab đang ở chế độ fault, ngược lại là `'overview'`. Kích hoạt tab Details.
- **`viewOnPlant(id)`:** activate `twin` rồi `selectTwin(id)`.
- **`viewOnThread(id)`:** gom các product tab có `threadIds` chứa id. Có 1 tab thì activate tab đó và `selectNode`; có nhiều tab thì gán `picker = {id, tabIds}`; không có tab nào thì không làm gì.
- **`applyStep`:** như §3.2 của spec. `STORY_SERIAL = 'MH20-0001'` thêm vào `lib/story.ts`.
- **Persist:** `persist(..., { name: 'onethread.workspace', version: 1, partialize: groups/product/evidence/twin/dockActive/layout/asOf, migrate: () => initial })`. Storage bọc try/catch; nếu dữ liệu rehydrate không có `groups.main.tabs` chứa `twin` thì dùng `initial`. Khi `parseDeepLink` trả về một step thì `applyStep` ghi đè (gọi trong `App`).

- [ ] **Step 1: Test** (thay toàn bộ `demo.test.ts`; mock `../api/client`):
  - trạng thái ban đầu như mô tả ở trên;
  - `openProduct('MH20-0457')` cho main active `thread:MH20-0457`, title `Thread · MH20-0457`, `product[...]` có `{claimId: null, mode: 'normal'}`, bottom active `detail:thread:MH20-0457`;
  - **hai product tab độc lập:** `openClaim('CLM-0012','MH20-0001')`, `focusNode(t1,'LOT-B')`, `openProduct('MH20-0457')`, `focusNode(t2,'M02')`, sau đó assert t1 = `{focus 'LOT-B', mode 'fault'}` và t2 = `{focus 'M02', mode 'normal'}`;
  - `setMode(t2,'fault')` trên tab không có claim thì mode vẫn `'normal'`;
  - **dock nhớ theo main tab:** `goTo('M02')` khi twin đang mở → bottom active `object:M02` (preview), `twin.selected === 'M02'`; `openProduct(...)` → bottom active `detail:…`; `activate('main','twin')` → bottom active lại là `object:M02`;
  - bảng `goTo`: `D-07` → main có `doc:D-07`; `MH20-0002` → `thread:MH20-0002`; `BOX-001` (mock `getLinks` trả `packed_in` từ `MH20-0003`) → `thread:MH20-0003`; `CLM-0012` (mock `getClaim` trả `traceable: true`) → `product['thread:MH20-0001'].mode === 'fault'`; `LOT-B` khi product đang mở và `threadIds` chứa LOT-B → `focusNodeId === 'LOT-B'`;
  - `closeTab` trên `twin` và `overview` thì state không đổi;
  - **Review Focus #3:** khi bottom đang active `detail:thread:X`, `closeTab('main','thread:X')` → `product['thread:X']` undefined, không còn tab bottom nào có id bắt đầu bằng `detail:thread:X`, main active = `twin`, bottom active = `overview`;
  - `viewOnThread('LOT-B')` khi có hai tab chứa LOT-B → `picker.tabIds.length === 2`;
  - `applyStep(1)` → chỉ có twin; `applyStep(2)` → main active `thread:MH20-0001` ở mode fault; `applyStep(3)` → focus `LOT-B`, `evidence[tab] === 'lot'`; `applyStep(4)` → `agentCmd.kind === 'ask'`; `applyStep(3,'normal')` → mode normal;
  - **Review Focus #1:** `localStorage.setItem('onethread.workspace', '{garbage')`, sau đó `await useDemo.persist.rehydrate()` → `groups.main.tabs[0].id === 'twin'`. Lặp lại với `JSON.stringify({state:{groups:{main:{tabs:[],active:null}}},version:0})` → vẫn ra trạng thái ban đầu.
- [ ] **Step 2:** `npx vitest run src/store` → FAIL.
- [ ] **Step 3:** Cài đặt. Nếu `demo.ts` dài quá ~300 dòng thì tách phần điều hướng (`goTo`, `viewOn*`, `applyStep`) sang `store/navigate.ts`.
- [ ] **Step 4:** Test của store pass. Các test component cũ **được phép đỏ** cho tới B4/B5. Ghi rõ danh sách test đỏ trong commit message.
- [ ] **Step 5: Commit** `feat(web): workspace store with per-tab product state`

### Task 8 (B3): Shell (TabBar, Workspace, Dock, Resizer, ActivityBar, Header, StatusBar, App)

**Files:**
- Create: `frontend/src/shell/Workspace.tsx`, `frontend/src/shell/Resizer.tsx`, `frontend/src/shell/TabBar.test.tsx`, `frontend/src/shell/tabContent.tsx`
- Modify: `frontend/src/shell/TabBar.tsx`, `AppShell.tsx`, `ActivityBar.tsx`, `Header.tsx`, `StatusBar.tsx`, `AppShell.test.tsx`, `frontend/src/App.tsx`, `frontend/src/index.css`

**Interfaces:**
- Consumes: B2.
- Produces:
  - `<TabBar group: GroupId />`;
  - `<Resizer axis: 'x'|'y'; value: number; min: number; max: number; invert?: boolean; onChange(v: number); onToggle?(): void />`;
  - `MainContent({ tab })`, `DockContent({ tab })` trong `tabContent.tsx`. Đây là switch theo kind; kind nào chưa có component thì hiện `<Placeholder>` cho tới đợt C (twin → "Plant twin", feed → "Feed item").

Chi tiết:
- **TabBar:** `role=tablist`; mỗi tab là `role=tab` với `aria-selected`; class `preview` (chữ nghiêng); nút ✕ `aria-label="Close <title>"` chỉ có ở tab không ghim; `onAuxClick` với `e.button === 1` thì đóng; `onDoubleClick` gọi `keepTab`; `draggable` và `onDragStart/onDragOver/onDrop` gọi `moveTab`. Tab bottom có thêm nút ⊟ thu gọn và ◫ tách.
- **Layout:**
  - `AppShell` gồm Header, rồi hàng `ActivityBar | rail trái (width leftW) | Resizer x | Workspace | Resizer x (invert) | rail Agent (agentW, ẩn khi tắt agent)`, rồi `StatusBar`;
  - `Workspace` gồm `TabBar main + MainContent`, `Resizer y` (giá trị `dockH`, double-click để thu gọn), dock `TabBar bottom + DockContent` (khi `split` thì cạnh bên có `TabBar bottom2`);
  - giới hạn kích thước: leftW 200–480, agentW 280–560, dockH 120–(chiều cao viewport − 200).
- **ActivityBar:** ba nút rail (`Notifications`, `Assets`, `Data repository`) gọi `setRail`; nút Report gọi `openReport(activeProduct.claimId)`, bị disabled khi tab đang mở không có claim; nút ✦ giữ nguyên.
- **Header:** hiện `formatPlantTime(asOf, 'YYYY-MM-DD HH:mm')` thay cho `DEMO_NOW`; search chọn kết quả thì gọi `goTo`.
- **StatusBar:** hiện Journey khi `activeProduct?.p.claimId`; bỏ `VIEW_LABEL` và thay bằng tiêu đề main tab đang mở; thêm `<span>DEMO · sample data · read-only</span>`; nút Review queue gọi `activate('bottom','review')` (mở lại nếu đã đóng).
- **Rail trái:** `feed` hiện placeholder cho tới C2; `assets` hiện `PlantSidebar`; `data` hiện `DataSidebar`.

- [ ] **Step 1: Test**
  - `TabBar.test.tsx`: render `<TabBar group="main" />` sau `openProduct('MH20-0457')`. Assert:
    - tab `Plant` không có nút Close;
    - `fireEvent.auxClick(tab, { button: 1 })` đóng tab thread;
    - mở bằng `openTab('bottom', …, {preview:true})` thì tab có class `preview`, `dblClick` thì mất class đó;
    - kéo tab C thả lên tab A thì thứ tự đổi;
    - tab đang mở có `aria-selected="true"`.
  - `AppShell.test.tsx`: header hiện `2026-11-03 14:05` và `DEMO · SAMPLE DATA`; status line chứa `read-only`; bấm nút `Assets` thì `layout.rail === 'assets'` và `groups.main.tabs` không đổi; kéo `Resizer` của dock thì `layout.dockH` đổi và bị giới hạn trong khoảng.
- [ ] **Step 2:** Chạy test → FAIL.
- [ ] **Step 3:** Cài đặt. CSS trong `index.css`: `.tab.preview .tab-btn { font-style: italic }`, `.tab.on { box-shadow: inset 0 -2px 0 var(--teal) }`, `.resizer`, `.dock`. `.app` có `height: 100vh; overflow: hidden`.
- [ ] **Step 4:** Test của shell pass.
- [ ] **Step 5: Commit** `feat(web): VS Code-style workspace shell`

### Task 9 (B4): Chuyển thread và evidence sang state theo tab

**Files:**
- Create: `frontend/src/thread/ProductTabContext.ts`, `frontend/src/thread/LinkLegend.tsx`
- Modify: `thread/ThreadView.tsx`, `thread/ThreadGraph.tsx`, `thread/EntityHeader.tsx`, `evidence/EvidencePanel.tsx`, `evidence/OverviewTab.tsx`, `evidence/MachineTab.tsx`, `evidence/tabs.ts`, `shell/tabContent.tsx`
- Test: `thread/ThreadView.test.tsx`, `thread/ThreadGraph.test.tsx`, `evidence/EvidencePanel.test.tsx`, `evidence/OverviewTab.test.tsx`

**Interfaces:**
- Consumes: B2 (`product`, `evidence`, các action theo `tabId`, `hoverIds`, `viewOnPlant`).
- Produces:
  - `ProductTabContext = createContext<string|null>(null)` và `useProductTab(): string|null`;
  - `<ThreadView tabId />`;
  - `<EvidencePanel nodeId owner />`;
  - `<EntityHeader serial claim: Claim|null trace asOf tabId />`;
  - `<LinkLegend counts?: Partial<Record<EdgeStatus, number>> />`;
  - `tabsFor(s)`: với máy có cycle thì `machine` đứng đầu.

Chi tiết:
- **ThreadView:**
  - lấy flow qua `getFlow(p.claimId ?? p.root)`; chỉ gọi `getClaim`/`getTrace` khi có claim; khi không có claim thì gọi `getTrace(p.root)` và truyền `claim=null` cho `EntityHeader` (ẩn nút Fault/Normal và dòng "shipped to");
  - gọi `setRoot`/`setThreadIds` với `tabId`;
  - dưới graph là `LinkLegend` thay cho `EvidencePanel` (EvidencePanel đã chuyển xuống dock);
  - bọc toàn bộ trong `ProductTabContext.Provider`.
- **ThreadGraph:** đọc focus, flash, mode của tab qua context; node nằm trong `hoverIds` có class `hover`.
- **EvidencePanel:**
  - sub-tab đọc từ `evidence[owner]`; nếu không có hoặc không hợp lệ thì dùng `tabs[0].id`;
  - `DockContent` cho kind `thread` render `EvidencePanel nodeId={p.focusNodeId ?? p.root} owner={tab.target}`, kind `object` render `EvidencePanel nodeId={tab.target} owner={tab.id}`.
- **OverviewBody:**
  - `canFault` = product tab đang mở có claim, đồng thời owner là tab Details của tab đó;
  - nút "View on plant" (gọi `viewOnPlant(d.id)`) hiện khi node có type thuộc tập asset của plant (`receipt, lot, line, hopper, machine, inspection, shipment`).
- **MachineTab:** `threadRoot` lấy từ `activeProduct`.

- [ ] **Step 1: Test** (sửa các test hiện có cho dùng `tabId`, thêm test mới):
  - `openProduct('MH20-0457')` + `<ThreadView tabId="thread:MH20-0457" />` → `getFlow` được gọi với `'MH20-0457'`, `getClaim` không được gọi, không có nút `Fault`;
  - hai ThreadView cho hai tab: `selectNode` ở tab 1 không đổi focus của tab 2;
  - **Review Focus #2:** `getFlow` reject với `'404 not found'` cho `MH20-9999` → tab đó hiện `Could not load thread` và nút `Retry`; ThreadView của `thread:MH20-0001` render cùng lúc vẫn hiện graph;
  - EvidencePanel của M02 (`summary_m02.json`) có tab đầu tiên là `Press cycle`;
  - "Set as fault origin" chỉ hiện khi tab có claim; bấm "View on plant" → main active `twin`, `twin.selected === id`;
  - `LinkLegend` hiện 4 mức với đúng `strokeDasharray` của `edgeStyle`.
- [ ] **Step 2:** Chạy test → FAIL.
- [ ] **Step 3:** Cài đặt.
- [ ] **Step 4:** Các test trên pass.
- [ ] **Step 5: Commit** `refactor(web): thread and evidence read per-tab state`

### Task 10 (B5): Doc, report, agent cite, attach, các sidebar

**Files:**
- Modify: `docs/DocDrawer.tsx` (đổi thành `DocBody`, export `DocTab({ id })`, bỏ drawer, scrim và focus trap), `report/ReportView.tsx` (`ReportView({ claimId })`), `agent/AgentPanel.tsx` (`CiteChip` gọi `goTo`), `agent/sources.ts` (claim = `activeProduct?.p.claimId ?? STORY_CLAIM`), `attach/AttachDialog.tsx` (target = node đang focus của product tab, hoặc `twin.selected`, hoặc null), `plant/PlantSidebar.tsx` (click gọi `goTo`; mục đang chọn = `twin.selected`), `data/DataView.tsx` (`DataSidebar` mở tab: "Documents" → main `table:docs`, "Review queue" → bottom `review`, bảng → main `table:<name>`; `DataView({ target })` render theo target), `review/ReviewQueueList.tsx` (link mở bằng `goTo`), `shell/tabContent.tsx`, `App.tsx`
- Delete: `claims/ClaimsSidebar.tsx`, `claims/ClaimsSidebar.test.tsx` (claim chuyển vào feed ở C2; chú giải độ tin cậy đã chuyển thành `LinkLegend` ở B4), `plant/PlantView.tsx`
- Test: `docs/DocDrawer.test.tsx` → đổi tên thành `docs/DocTab.test.tsx`, `report/ReportView.test.tsx`, `agent/AgentPanel.test.tsx`, `agent/serverSource.test.tsx`, `attach/AttachDialog.test.tsx`, `data/views.test.tsx`

- [ ] **Step 1: Sửa test**
  - DocTab hiện metadata và `ReviewActions` của D-07;
  - `ReportView claimId="CLM-0012"` gọi `getReportDraft('CLM-0012')`;
  - bấm cite chip `LOT-B` khi đang mở `thread:MH20-0001` → `focusNodeId === 'LOT-B'`; cite `D-12` → main có `doc:D-12`;
  - `serverSource` gửi `claim=CLM-0012` khi product tab đang mở có claim đó, và cũng gửi `CLM-0012` (mặc định) khi đang ở twin;
  - AttachDialog lấy target từ product tab đang mở;
  - DataSidebar mở tab `table:links` ở main.
- [ ] **Step 2:** Chạy test → FAIL.
- [ ] **Step 3:** Cài đặt.
- [ ] **Step 4:** Toàn bộ `npx vitest run`, `npm run lint`, `npm run build` xanh (không còn test đỏ từ B2).
- [ ] **Step 5: Commit** `refactor(web): docs, report, agent and sidebars open tabs`

**Kết thúc đợt B:** `make test` + lint + build xanh, rồi báo lại cho người dùng.

---

## Đợt C · Twin, feed, dock, agent

### Task 11 (C2): Feed ở rail trái

(Không có C1: phần type/client của mỗi endpoint nằm trong task dùng nó.)

**Files:**
- Create: `frontend/src/feed/useFeed.ts`, `feed/FeedSidebar.tsx`, `feed/FeedCard.tsx`, `feed/FeedSidebar.test.tsx`, `test/fixtures/feed.json` (ghi lại từ `/api/feed` sau đợt A)
- Modify: `api/types.ts` (`FeedItem`, `FeedRef`), `api/client.ts` (`getFeed()`), `store/demo.ts` (thêm slice feed), `shell/AppShell.tsx` (rail `feed`), `shell/ActivityBar.tsx` (badge số chưa đọc)

**Interfaces:**
- Consumes: A3, B2.
- Produces:
  - `useFeed(): Async<FeedItem[]>` (dùng chung một promise, tải lại khi `dataVersion` đổi);
  - `feedFilter(items, kind: FeedFilter, dept: string|null)`, với `FeedFilter = 'all'|'alert'|'4m'|'link'|'doc'|'claim'`;
  - state `feed: { selected: string|null; kind: FeedFilter; dept: string|null; read: string[] }` (`read` được persist);
  - action `selectCard(item: FeedItem): Promise<void>`, `setFeedFilter(kind)`, `setDept(dept|null)`;
  - `USER_DEPT = 'quality'` trong `lib/story.ts`.
- **`selectCard`:**
  - đặt `feed.selected` và đánh dấu đã đọc;
  - `asOf = item.at`;
  - `openTab('bottom', {id:'feed:'+id, kind:'feed', target:id, title:`${badge} · ${id}`}, {preview:true})`;
  - đặt context cho agent;
  - tính reach theo token: claim → `getClaimFault(id)`; còn lại → `getFault(objects[0], item.at)` nếu có object; lot = object đầu tiên khớp `^LOT-` → `getImpact(lot)` cho orange (`shipments[].id`). Lỗi nào cũng cho reach rỗng. Kết quả của token cũ bị bỏ.
- **FeedCard:**
  - `data-unread`; khi `sender !== USER_DEPT` thì có class `foreign` và `style={{'--dept': var(--dept-<sender>)}}`;
  - pill phòng ban gửi (`.pill.filled`), pill phòng ban cần xử lý (`.pill.outline`), pill object (`.pill.obj`, click gọi `goTo`), pill trạng thái;
  - card LINK render `ReviewActions linkId=ref.link_id`;
  - `onMouseEnter`/`onMouseLeave` gọi `setHover(objects)`/`setHover([])`;
  - card CLAIM có `traceable` thì click mở luôn (`openClaim`).
- Token `--dept-*` (7 màu) khai báo trong `tokens.css`.

- [ ] **Step 1: Test** (mock client, fixture `feed.json`):
  - chip `All` hiện tổng số item; chip `Alerts 1`, `4M changes 2` đúng số; bấm `Claims` thì chỉ còn card claim;
  - card mới nhất nằm trên cùng; card `AL-0001` có pill bên gửi `Production` (filled) và các pill `Quality`/`Maintenance` (outline);
  - bấm pill `Maintenance` → `feed.dept === 'maintenance'`, chỉ còn card có maintenance (sender hoặc acting);
  - bấm pill object `M02` → gọi `goTo('M02')`;
  - bấm card `AL-0001` → `asOf === '2026-11-03T14:00:00+07:00'`, bottom có `feed:AL-0001` ở dạng preview, card không còn `data-unread`; `reach.red` chứa các id do `getFault` mock trả về;
  - **Review Focus #4:**
    - bấm card `D-03` khi `getFault` reject → `reach` = `{red:[], orange:[]}`, không throw;
    - bấm `CLM-0009` (không có object nào là lot) → không gọi `getImpact`;
    - bấm A rồi B, trong đó promise của A resolve sau → `reach` là kết quả của B;
  - card LINK có nút `Approve`; card `AL-0001` có class `foreign` (sender production ≠ quality).
- [ ] **Step 2:** Chạy test → FAIL.
- [ ] **Step 3:** Cài đặt.
- [ ] **Step 4:** Test pass.
- [ ] **Step 5: Commit** `feat(web): notifications & changes feed`

### Task 12 (C3): Plant twin

**Files:**
- Create: `frontend/src/plant/twinLayout.ts`, `plant/twinLayout.test.ts`, `plant/TwinView.tsx`, `plant/TwinNode.tsx`, `plant/DeptStrip.tsx`, `plant/SerialPicker.tsx`, `plant/TwinView.test.tsx`, `test/fixtures/plant.json`, `test/fixtures/plant_state.json`
- Modify: `api/types.ts` (`PlantState`, `NodeState`, `TwinEdge`), `api/client.ts` (`getPlantState(at)`), `shell/tabContent.tsx`, `store/demo.ts` (`twin.layers: Record<'machines'|'lots'|'alerts'|'flow', boolean>`, `toggleLayer`)

**Interfaces:**
- Consumes: A4 (`/api/plant/state`), `getPlant`, C2 (`useFeed`, `feed.dept`, `feed.read`), B2 (`selectTwin`, `viewOnThread`, `picker`, `openProduct`, `reach`, `hoverIds`).
- Produces:
  - `twinLayout(areas: PlantArea[], state: PlantState): { nodes: TwinNodeData[]; edges: TwinEdge[]; width: number; height: number }`, với `TwinNodeData = { id; type; name; col: 0|1|2|3; row: number; x: number; y: number; line?: string }`;
  - các hằng `TWIN_COL_X`, `TWIN_ROW_H`.

Chi tiết:
- **Layout:**
  - cột 0 gồm receipt và lot (xếp theo id);
  - cột 1, mỗi line là một hàng: header line, hopper của line (`part_of`), rồi các máy của line (máy dàn ngang trong hàng);
  - cột 2 gồm inspection;
  - cột 3 gồm node volume `volume` (id `VOL`, nhãn lấy từ `area.volume`) và các shipment.
- **TwinNode:** dùng lại class node của ThreadGraph; hiện tên, `<span class="st st-<state>">` kèm chữ (`running`, `stopped`, `warning`, `4M watch`), và value. Class `sel`, `red`, `orange`, `hover`, `dept-hl`.
- **Toolbar:**
  - Machines: ẩn hoặc hiện node máy;
  - Lots in use: chỉ hiện lot đang dùng (là đầu `from_id` của `fed_into` trong `state.edges`) và lot có state khác `idle`;
  - Alerts: tô màu state và reach;
  - Department flow: lớp SVG đường chấm từ chip tới node;
  - zoom +/− và "Fit to frame" (`useReactFlow().zoomIn/zoomOut/fitView`);
  - nút "View on thread" (enabled khi có `twin.selected`).
- **DeptStrip:** mỗi channel một chip, badge = số item chưa đọc có `sender === channel.id`; click gọi `setDept(channel.id)`. Chip có `ref` để lớp flow lấy tọa độ.
- **Tương tác:**
  - click node gọi `selectTwin(id, `${lineName} › ${name}`)` (hoặc chỉ `name` khi không thuộc line nào), mở tab object preview ở dock;
  - `onPaneClick` gọi `selectTwin(null)`, dock về `overview`;
  - double-click `VOL` hoặc shipment → `SerialPicker` (lấy serial bằng `getLinks(shipment)` lọc `shipped_in` có `from_id` dạng `MH20-*`; riêng `VOL` thì lấy 50 serial đầu qua `search('MH20-')`) → click một serial gọi `openProduct`;
  - khi `picker` khác null thì render menu chọn tab.

- [ ] **Step 1: Test**
  - `twinLayout`: với fixture, `LINE-1`, `HOP-1`, `M02` cùng `row`; `LINE-2`, `HOP-2`, `M01`, `M03` cùng một row khác; `x` của LOT-B < `x` của HOP-1 < `x` của IQC-5531 < `x` của SHP-1112; `VOL` ở cột 3.
  - `TwinView`:
    - hiện `M02` với chữ `warning` và `42 s / 30 s`;
    - click `M02` → bottom có tab title `Line 1 › M02`, `twin.selected === 'M02'`; click pane → `selected === null`, bottom active `overview`;
    - double-click `SHP-1112` (mock `getLinks`) → picker liệt kê serial, click `MH20-0001` → main có `thread:MH20-0001`;
    - **ba nơi khớp nhau:** feed chưa đọc chứa `AL-0001` (sender production) và `4M-0001` (sender quality) → chip `Quality · QMS` có badge `1`; khi `feed.dept='quality'` thì node `LOT-B` và `IQC-5531` có class `dept-hl`; khi `reach.red=['M02']` thì node M02 có class `red`;
    - tắt lớp `Machines` thì không còn node `M01`;
    - "View on thread" với hai tab chứa `M02` → hiện menu có 2 lựa chọn.
- [ ] **Step 2:** Chạy test → FAIL.
- [ ] **Step 3:** Cài đặt. `getPlantState(asOf)` tải lại khi `asOf` hoặc `dataVersion` đổi.
- [ ] **Step 4:** Test pass.
- [ ] **Step 5: Commit** `feat(web): plant twin view`

### Task 13 (C4): Nội dung dock (overview, nguồn dữ liệu, chi tiết feed, chart máy)

**Files:**
- Create: `frontend/src/plant/PlantOverview.tsx`, `plant/DataSources.tsx`, `plant/Sparkline.tsx`, `feed/FeedDetail.tsx`, `plant/PlantOverview.test.tsx`, `feed/FeedDetail.test.tsx`, `test/fixtures/plant_overview.json`
- Modify: `api/types.ts`, `api/client.ts` (`getPlantOverview(at)`), `evidence/CycleChart.tsx`, `evidence/MachineTab.tsx`, `shell/tabContent.tsx`

**Interfaces:**
- Consumes: A4 (`PlantOverview`), C2 (`useFeed`), `getDocument`, `getLinks`.
- Produces:
  - `CycleChart` thêm prop `bands?: { from: string; to: string; label: string }[]` và `notices?: { time: string; label: string; kind: 'alert'|'4m' }[]`;
  - `lotBands(events: PlantEvent[]): {from,to,label}[]` (gom các khoảng `payload.lot` liên tiếp nhau);
  - `<Sparkline values: number[] target?: number />`.

Chi tiết:
- **PlantOverview:**
  - 5 ô KPI: Output · Cycle vs target · Open alerts · 4M watching · Links pending review;
  - bảng line/máy: line in đậm, máy thụt lề; các cột Status, Cycle, Target, Output, Lot, Trend; click một dòng gọi `goTo(id)`;
  - bảng Shipments có Risk (chip đỏ `high`) và reason;
  - khi giá trị null thì hiện `—`.
- **DataSources:** bảng gồm Source, Department, Events, Last record, Delay.
- **FeedDetail:**
  - trái: nếu `ref.doc_id` thì gọi `getDocument` và bọc mỗi `extracted_codes` trong `<mark>` ở text các chunk; nếu không có doc thì hiện title, reason và các pill;
  - phải: bảng "Reach" `{ id, relation, status, score }`: với doc lấy từ `DocDetail.links`; với loại khác lấy từ `getLinks(objects[0])`, rồi thêm `reach.red/orange` với relation `fault reach`;
  - id nào cũng gọi `goTo`.
- **MachineTab:** truyền `bands = lotBands(events)` và `notices` = các feed item kind alert/4m có `objects` chứa máy.

- [ ] **Step 1: Test**
  - PlantOverview (fixture) hiện `Open alerts` = `1`, các dòng `LINE-1`, `M02`, `LINE-2`, `M01`, `M03`, và shipment `SHP-1120` có chip `high`; click dòng `M02` gọi `goTo('M02')`;
  - **Review Focus #5:** overview có `rows[].trend = []`, `cycle_s = null`, `output = 0` → render `—`, không throw, `Sparkline` không vẽ path;
  - FeedDetail cho `D-12` (mock `getDocument` có `extracted_codes: ['BRG-6203']`) → có `<mark>BRG-6203</mark>`; bảng reach có `IQC-5531` cùng status; click gọi `goTo`;
  - `lotBands` của events LOT-A×3 rồi LOT-B×2 → 2 band với ranh giới đúng; CycleChart render `data-testid="lot-band"` ×2 và `data-testid="notice-marker"` cho mỗi notice.
- [ ] **Step 2:** Chạy test → FAIL.
- [ ] **Step 3:** Cài đặt.
- [ ] **Step 4:** Test pass.
- [ ] **Step 5: Commit** `feat(web): plant overview, data sources, feed detail, cycle bands`

### Task 14 (C5): Context và giao diện của agent

**Files:**
- Modify: `agent/AgentPanel.tsx`, `agent/AgentPanel.test.tsx`, `store/demo.ts` (selector `agentContext(s): string`), `index.css`

**Interfaces:**
- Produces: `agentContext(s)`, trả về chuỗi như `"Thread · MH20-0001 (CLM-0012) › LOT-B"`, `"Plant › M02"`, `"Feed · AL-0001"`, hoặc `"Plant"`. Nếu có `feed.selected` thì feed được ưu tiên.

- [ ] **Step 1: Test**
  - context hiện dưới tiêu đề và thay đổi khi `selectNode`/`selectCard`;
  - bong bóng của người dùng có class `bubble user` (căn phải), bong bóng của agent có class `bubble agent` (căn trái);
  - test cite đã có ở B5.
- [ ] **Step 2:** Chạy test → FAIL.
- [ ] **Step 3:** Cài đặt. CSS: `.bubble.user { margin-left: auto; background: #E3F0FB }`, `.bubble.agent { background: #F1F2F4 }`, chữ `var(--ink)`. Hai màu nền khai báo thành token.
- [ ] **Step 4:** Test pass.
- [ ] **Step 5: Commit** `feat(web): agent shows workspace context`

### Task 15 (C6): Kiểm tra cuối và cập nhật kịch bản demo

**Files:**
- Modify: `docs/demo/script.md` (Bước 1: feed ở rail trái thay cho ClaimsSidebar; Bước 2–3: product tab và dock; Khám phá tự do: twin, chip phòng ban, mở serial bằng `Ctrl K`), `README.md` (nếu có mô tả view cũ)

- [ ] **Step 1:** `cd backend && uv run pytest -q` → toàn bộ pass.
- [ ] **Step 2:** `cd frontend && npx vitest run && npm run lint && npm run build` → pass, lint không thêm cảnh báo mới.
- [ ] **Step 3:** `make seed`, chạy `make api` và `make web` (chạy nền), rồi mở `http://localhost:5173` ở 1440×900 (dùng skill `run` hoặc trình duyệt có sẵn). Kiểm từng mục "Done when":
  1. đóng rồi mở lại được mọi tab không ghim ở cả main và dock;
  2. `Ctrl K` "0457" mở `Thread · MH20-0457` không có claim; mở CLM-0012 từ feed; mỗi tab giữ focus/mode riêng khi chuyển qua lại;
  3. twin không chọn gì → Plant overview; click M02, LOT-B, Line 2, SHP-1112 → dock hiện thông tin của đúng object;
  4. chuyển từ twin sang product tab rồi về twin → dock khôi phục đúng tab cũ;
  5. card AL-0001: pill `Production`, chip của Maintenance/Production trên dải phòng ban có badge, M02 được tô sáng trên twin;
  6. CLM-0012 từ feed → thread, tô màu lỗi, nút Report mở `RCA report · CLM-0012`;
  - thêm: `?step=1..4` cho đúng bộ tab; không có scroll toàn trang (`document.documentElement.scrollHeight === innerHeight`).
- [ ] **Step 4:** Ghi kết quả từng mục vào commit message.
- [ ] **Step 5: Commit** `docs(demo): script for the workspace UI`
