# One Thread Demo · Đợt 2 (DEMO-16 → 24) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biến demo kịch bản cứng thành thread thẳng theo luồng vật tư. Có chế độ bình thường (bấm node nào cũng ra tổng quan), chế độ truy lỗi (đỏ = thượng nguồn, cam = hạ nguồn) và chức năng gắn tài liệu (phân loại fix cứng).

**Architecture:**
- Một module `onethread/flow.py` biến bảng `links` thành cạnh có hướng (thượng → hạ nguồn) và lọc theo hiệu lực thời gian. Ba tính năng BE (flow graph, dò lỗi, tổng quan node) đều dựng trên module này.
- Gắn tài liệu là endpoint ghi duy nhất: ghi `documents` + `links` với `rule_version="demo-attach-v0"`, xoá được bằng reset.
- FE thay toạ độ cứng `LAYOUT` bằng layout tính từ `/api/flow`, thêm tab "Tổng quan" và tô màu từ `/fault-trace`.

**Tech Stack:** như đợt 1 (Python 3.13 · uv · FastAPI · psycopg 3 · pydantic 2 · pytest | React 18 · TS · @xyflow/react · zustand · Vitest). Thêm `python-multipart` (Task 20).

**Spec:** `docs/superpowers/specs/2026-11-11-one-thread-demo-design.md`. Mục 3.3 "Luồng vật tư" là nguồn sự thật cho trục, hướng cạnh và bảng màu mong đợi; mục 4 có ticket DEMO-16 → 24. Plan đợt 1: `docs/superpowers/plans/2026-11-11-one-thread-demo.md`.

## Global Constraints

- Mọi ràng buộc của plan đợt 1 vẫn áp dụng, trừ "Chỉ đọc": ngoại lệ duy nhất là `POST /api/documents*` và `POST /api/demo/reset` (Task 20).
- Mọi test đợt 1 (backend `uv run pytest`, frontend `npx vitest run`) phải còn xanh sau mỗi task. Nếu test cũ phải sửa, chỉ sửa phần đọc toạ độ/`LAYOUT` (Task 21) hoặc trạng thái khởi tạo của store.
- Không tự đặt ID/số mới ngoài mục 3.1 + 3.3 của spec. ID mới hợp lệ: `PO-4380`, `AGG-<lot>` (nút gộp, không phải object), `D-U01…` (tài liệu upload).
- Chặng (`stage`) chỉ nhận: `cung_ung | kho | san_xuat | logistics | khach_hang | hau_mai | dinh_kem`. Nhãn hiển thị: Cung ứng · Kho · Sản xuất · Logistics · Khách hàng · Hậu mãi.
- Chỉ link `confirmed`/`inferred` là cạnh luồng; `pending`/`suggested` không bao giờ tham gia dò lỗi.
- Giờ hiển thị luôn qua `formatPlantTime` (UTC+7). Đồng hồ demo `2027-02-12T09:00:00+07:00` là `at` mặc định.
- Màu: đỏ `--red #C62828` / `--red-bg #FDECEC`; cam dùng `--amber #B45309` / `--amber-bg #FFF4E5`; trung tính dùng màu `.gn` mặc định; cạnh chế độ bình thường `#8E959F`.

## Review Focus

1. **Bấm nút gộp `AGG-LOT-B`.** Đây không phải object trong DB. Người dùng vẫn phải thấy tổng quan (1,000 part · 42 thùng · 3 lô xuất), không được 404. Test ở Task 18.
2. **Mở thread của serial khác MH20-0001** (`/api/flow/MH20-0500`, thuộc SHP-1115). Trục phải kết thúc ở `CUS-C5`, không có claim, và nút gộp không chứa chính root. Test ở Task 17.
3. **"Đặt làm điểm lỗi" trên node không thuộc luồng** (`IQC-5531`, `D-07`, `CLM-0009`). Kết quả là đỏ = chỉ origin, cam rỗng, không 500. Test ở Task 19.
4. **Upload file trùng tên hoặc tên nguy hiểm** (`../../etc/x.txt`, tên có dấu tiếng Việt).
   - File chỉ được lưu dưới `backend/var/uploads/` với tên đã làm sạch.
   - Upload lại cùng tên file trả lại doc cũ (`duplicate: true`), không nhân đôi badge.
   - Test ở Task 20.
5. **Node không có dữ liệu** (`M01`: không event, không tài liệu). Summary trả 200 với `params: []`; panel hiện "Chưa có thông số" và "Chưa có tài liệu · Gắn tài liệu". Test ở Task 18 + Task 22.

---

## File Structure

```
data/story.yaml                          # + PO-4380, links mới, stage, valid_from/valid_to (T16)
data/attachments.yaml                    # catalog 3 file mẫu (T20)
data/attachments/                        # 3 file mẫu (T20)
backend/onethread/flow.py                # FLOW_* tables, DirectedEdge, flow_edges(), collapse_map() (T16)
backend/onethread/queries/thread_flow.py # build_flow() -> FlowGraph (T17)
backend/onethread/queries/summary.py     # node_summary() -> NodeSummary (T18)
backend/onethread/queries/fault.py       # fault_trace(), claim_fault_trace() (T19)
backend/onethread/attach.py              # attach_document(), list_samples(), reset_uploads() (T20)
backend/onethread/seed/generate.py       # serial/box attributes.stage (T16)
backend/onethread/api.py                 # routes T17–T20
backend/tests/test_flow.py test_thread_flow.py test_summary.py test_fault.py test_attach.py
frontend/src/api/types.ts client.ts      # FlowGraph, NodeSummary, FaultTrace, AttachResult + fetchers
frontend/src/store/demo.ts               # mode, faultOrigin, dataVersion, flashNodeId, selectNode
frontend/src/thread/flowLayout.ts        # flowLayout() (T21)
frontend/src/thread/layout.ts            # bỏ LAYOUT/LANES; giữ edgeStyle, NODE_EVIDENCE, pickSides, NODE_W/H
frontend/src/thread/ThreadGraph.tsx ThreadView.tsx
frontend/src/evidence/OverviewTab.tsx EvidencePanel.tsx   (T22)
frontend/src/attach/AttachDialog.tsx                      (T24)
frontend/src/test/fixtures/flow_clm0012.json summary_m02.json summary_m01.json fault_clm0012.json attach_coa.json
```

---

### Task 16 (DEMO-16): Flow bible vào dữ liệu + `flow.py`

**Files:**
- Modify: `data/story.yaml`, `backend/onethread/seed/generate.py`, `backend/tests/test_story_consistency.py`
- Create: `backend/onethread/flow.py`, `backend/tests/test_flow.py`

**Interfaces:**
- Produces (`onethread/flow.py`):
  - `UP_IS_TO = {"supplied_by","received_under","processed_on","uses_lot","raised_by"}`, `UP_IS_FROM = {"fed_into","packed_in","shipped_in","ordered_in","delivered_to"}`. Mọi quan hệ khác là đính kèm.
  - `@dataclass(frozen=True) DirectedEdge{up: str, down: str, relation: str, link_id: int, tier: int, status: str, shortcut: bool, active: bool, evidence: dict}`.
  - `flow_edges(conn, at: datetime | None = None, *, include_inactive: bool = False) -> list[DirectedEdge]`:
    - chỉ link confirmed/inferred;
    - alias gộp: mọi ID là `to` của `same_as` được thay bằng `from` của nó (`S1-6203-B` → `LOT-B`);
    - `active` = (`evidence.valid_from` ≤ `at` hoặc thiếu) và (`at` < `evidence.valid_to` hoặc thiếu); `at=None` → mọi cạnh active;
    - mặc định chỉ trả cạnh active.
  - `shortcut=True` khi: `relation == "uses_lot"`; hoặc `shipped_in` mà `from` là serial; hoặc `supplied_by` mà `from` gốc là `supplier_lot`.
  - `collapse_map(conn, keep: set[str]) -> dict[str, str]`: mọi serial/box không thuộc `keep` → `f"AGG-{lot}"`. Lô của serial lấy qua `uses_lot`; lô của box lấy qua serial đầu tiên `packed_in` nó.
  - `STAGES: dict[str, str]` = nhãn hiển thị theo Global Constraints.
- `story.yaml`:
  - object `PO-4380` (`purchase_order`, attributes `{qty: 5000, supplier: SUP-S1}`);
  - link `CLM-0012 raised_by CUS-C3`, `PO-4380 supplied_by SUP-S1`, `RCV-1410 received_under PO-4380`, `LOT-A received_under RCV-1410`, `M02 part_of LINE-1` (tier 1 confirmed 1.0 `T1-exact`);
  - evidence `LOT-B fed_into HOP-1` thêm `valid_from: "2026-11-03T13:52:00+07:00"` (giữ `record`, `at`);
  - `LOT-A fed_into HOP-1` thêm `{valid_from: "2026-11-03T08:00:00+07:00", valid_to: "2026-11-03T13:52:00+07:00"}`;
  - M02 attributes `{stage: san_xuat, cycle_target_s: 30, line: LINE-1}`;
  - mọi object khác có `attributes.stage` theo bảng:

    | stage | object |
    |---|---|
    | `cung_ung` | SUP-S1, PO-4410, PO-4380 |
    | `kho` | RCV-*, LOT-A, LOT-B |
    | `san_xuat` | M01–M03, HOP-1, LINE-1 |
    | `logistics` | SHP-* |
    | `khach_hang` | SO-*, CUS-* |
    | `hau_mai` | CLM-* |
    | `dinh_kem` | IQC-*, BRG-6203, S1-6203-B |

- Generator: serial `attributes.stage = "san_xuat"`, box `attributes.stage = "logistics"` (thêm vào dict attributes đang có).

- [ ] **Step 1: Write failing tests** (`test_flow.py`, dùng `seeded_conn`):

```python
SPINE = ["SUP-S1","PO-4410","RCV-2810","LOT-B","HOP-1","M02","MH20-0001",
         "BOX-001","SHP-1112","SO-7781","CUS-C3","CLM-0012"]
AT = datetime.fromisoformat("2026-11-03T14:05:18+07:00")

def test_spine_is_a_directed_path(seeded_conn):
    pairs = {(e.up, e.down) for e in flow_edges(seeded_conn, AT) if not e.shortcut}
    assert all((a, b) in pairs for a, b in zip(SPINE, SPINE[1:]))

def test_lot_a_feed_window(seeded_conn):
    def has(at): return any(e.up == "LOT-A" and e.down == "HOP-1" for e in flow_edges(seeded_conn, at))
    assert not has(AT) and has(datetime.fromisoformat("2026-11-03T13:00:00+07:00"))

def test_alias_merged_as_shortcut(seeded_conn):
    e = next(e for e in flow_edges(seeded_conn, AT) if e.up == "SUP-S1" and e.down == "LOT-B")
    assert e.shortcut and "S1-6203-B" not in {x for e in flow_edges(seeded_conn) for x in (e.up, e.down)}

def test_pending_links_are_not_flow(seeded_conn):
    assert not any("D-07" in (e.up, e.down) for e in flow_edges(seeded_conn, include_inactive=True))

def test_collapse_keeps_root(seeded_conn):
    m = collapse_map(seeded_conn, {"MH20-0001", "BOX-001"})
    assert "MH20-0001" not in m and m["MH20-0002"] == "AGG-LOT-B" and m["BOX-042"] == "AGG-LOT-B"
```
  `test_story_consistency.py` thêm `test_every_object_has_stage`: `select count(*) from objects where attributes->>'stage' is null` = 0.
- [ ] **Step 2: Run** `cd backend && uv run pytest tests/test_flow.py tests/test_story_consistency.py -v` → FAIL (module/attributes thiếu).
- [ ] **Step 3: Implement** YAML + generator + `flow.py`. Đọc toàn bộ link luồng bằng một truy vấn (≈ 4,000 dòng); join `objects.type` để biết `from` là serial/supplier_lot.
- [ ] **Step 4: Run** `uv run pytest -v` → toàn bộ PASS (cả test đợt 1).
- [ ] **Step 5: Commit** `git commit -m "feat(data): flow bible, directed flow edges with validity windows"`

---

### Task 17 (DEMO-17): `GET /api/flow/{id}` — thread thẳng

**Files:**
- Create: `backend/onethread/queries/thread_flow.py`, `backend/tests/test_thread_flow.py`
- Modify: `backend/onethread/api.py`

**Interfaces:**
- Consumes: `flow_edges`, `collapse_map`, `node_info`, `NotFound`.
- Produces:
  - Models:
    - `FlowNode{id, type, name, stage, sub: str, order: int | None, row: int, parent_id: str | None, members: dict | None}`: `type="aggregate"` cho `AGG-*`, `members={"parts": int, "boxes": int}`.
    - `FlowEdge{up, down, relation, tier, status, kind: Literal["spine","branch"], active: bool}`.
    - `Attachment{id, kind: Literal["document","inspection","claim","event","alias","part"], label, status: str | None, tier: int | None, via: str | None}`.
    - `FlowGraph{root, at: datetime, spine: list[FlowNode], branches: list[FlowNode], edges: list[FlowEdge], attachments: dict[str, list[Attachment]]}`.
  - `build_flow(conn, id: str) -> FlowGraph`:
    - `id` là serial, hoặc claim (quy về `attributes.serial`). Loại khác hoặc không tồn tại → `NotFound("serial or claim", id)`.
    - `at` = `event_time` của event `press_cycle` chứa serial.
  - Route `GET /api/flow/{id}`.
- Thuật toán (không suy ra được từ test):

```text
E  = flow_edges(at) bỏ shortcut;  Eall = flow_edges(include_inactive=True) bỏ shortcut
up   : từ root đi ngược E; mỗi bước chọn cạnh link_id nhỏ nhất → chuỗi thượng nguồn
down : từ root đi xuôi E; nếu nhiều cạnh: ưu tiên node có link `about` → root (claim của serial),
       sau đó link_id nhỏ nhất; dừng khi hết cạnh
spine = reverse(up) + [root] + down ; order = chỉ số; row = 0
keep  = set(spine);  cmap = collapse_map(conn, keep)
branches: BFS vô hướng trên Eall (sau khi áp cmap), xuất phát từ mọi node spine, độ sâu ≤ 4,
          bỏ node spine; parent_id = node phát hiện trước (duyệt spine theo order, rồi id)
row của branch: đặt dưới node spine cùng `type` (PO-4380↔PO-4410, AGG↔serial, SHP-1115↔SHP-1112…),
          row = 1 + số branch đã đặt dưới cột đó; không có cùng type → dưới cột của parent
edges: mọi cạnh Eall (áp cmap, bỏ trùng, bỏ tự nối) giữa hai node hiển thị;
       kind="spine" nếu là cặp liên tiếp trong spine; active theo `at`
attachments: với mỗi node hiển thị (không phải AGG):
  - link không phải luồng (mọi status) → đầu kia, nếu không hiển thị và không phải serial/box;
    kind theo type (document/inspection/claim/supplier_lot→alias/part); thêm một cấp nữa với via=<id cấp 1>
  - event của node và của đích `part_of` của node, type ∈ {maintenance, shift, lot_loaded, goods_receipt}
    → một attachment/event (id = source_record_id); press_cycle, env_temp gộp theo source (id = source)
  - bỏ mọi attachment có id đang hiển thị trên graph (vd. goods_receipt RCV-2810 đã là node spine)
```
  - `sub` theo type:

    | type | sub |
    |---|---|
    | supplier | `"ERP: " + erp_code` |
    | purchase_order | `"{qty:,} pcs"` |
    | receipt | `"nhập " + MM-DD HH:mm` (từ event goods_receipt) |
    | lot | `"{part name} · {qty:,}"` |
    | hopper | `"cấp liệu"` |
    | machine | tên line |
    | serial | `"ép " + MM-DD HH:mm` |
    | box | `"{n} part"` |
    | shipment | `"giao MM-DD"` hoặc `"trong kho"` |
    | sales_order / customer | tên khách |
    | claim | `"nhận MM-DD"` |
    | aggregate | `"+{parts:,} part · {boxes} thùng"` |

- [ ] **Step 1: Write failing tests** (`test_thread_flow.py`, qua `client` fixture của `test_api.py`; chuyển fixture đó vào `conftest.py` nếu cần):

```python
def test_flow_spine_from_claim(client):
    f = client.get("/api/flow/CLM-0012").json()
    assert [n["id"] for n in f["spine"]] == SPINE          # hằng số như Task 16
    assert f["at"].startswith("2026-11-03T07:05:18")         # UTC
    assert client.get("/api/flow/MH20-0001").json()["spine"] == f["spine"]

def test_flow_branches(client):
    f = client.get("/api/flow/CLM-0012").json()
    assert {n["id"] for n in f["branches"]} == {"PO-4380","RCV-1410","LOT-A","AGG-LOT-B",
                                               "SHP-1115","SHP-1120","SO-7790","CUS-C5"}
    agg = next(n for n in f["branches"] if n["id"] == "AGG-LOT-B")
    assert agg["members"] == {"parts": 999, "boxes": 41}
    lot_a = next(e for e in f["edges"] if e["up"] == "LOT-A" and e["down"] == "HOP-1")
    assert lot_a["active"] is False

def test_flow_attachments(client):
    a = client.get("/api/flow/CLM-0012").json()["attachments"]
    assert {"IQC-5531","D-07","D-12"} <= {x["id"] for x in a["LOT-B"]}
    assert {"PM-0241","HR-SHIFT-1103","ENV-L1","PLC2"} <= {x["id"] for x in a["M02"]}
    assert {"CLM-0009","D-09","D-03"} <= {x["id"] for x in a["SUP-S1"]}

def test_flow_other_serial_ends_at_c5(client):           # Review Focus #2
    f = client.get("/api/flow/MH20-0500").json()
    ids = [n["id"] for n in f["spine"]]
    assert ids[-3:] == ["SHP-1115","SO-7790","CUS-C5"] and not any(i.startswith("CLM") for i in ids)
    agg = next(n for n in f["branches"] if n["type"] == "aggregate")
    assert agg["members"]["parts"] == 999

@pytest.mark.parametrize("url", ["/api/flow/MH20-9999", "/api/flow/LOT-B"])
def test_flow_404(client, url):
    assert client.get(url).status_code == 404
```
- [ ] **Step 2: Run** `uv run pytest tests/test_thread_flow.py -v` → FAIL.
- [ ] **Step 3: Implement** `build_flow` + route.
- [ ] **Step 4: Run** `uv run pytest -v` → PASS. Chụp fixture cho FE: `curl -s localhost:8000/api/flow/CLM-0012 > frontend/src/test/fixtures/flow_clm0012.json`.
- [ ] **Step 5: Commit** `git commit -m "feat(api): straight flow thread endpoint"`

---

### Task 18 (DEMO-18): `GET /api/objects/{id}/summary`

**Files:**
- Create: `backend/onethread/queries/summary.py`, `backend/tests/test_summary.py`
- Modify: `backend/onethread/api.py`

**Interfaces:**
- Consumes: `get_docs`, `get_events`, `compare_by_lot`, `trace_forward`, `flow_edges`, `node_info`.
- Produces:
  - `Param{label: str, value: str | float | int, unit: str | None, source: str, source_record_id: str | None}`.
  - `NodeSummary{id, type, name, stage, aliases: list[str], params: list[Param], docs: list[DocView], counts: dict[str, int]}`; `counts = {"links": n, "events": n}`.
  - `node_summary(conn, id) -> NodeSummary`. `id` có tiền tố `AGG-` → summary của lô sau tiền tố (Review Focus #1); ID lạ → `NotFound`.
  - Route `GET /api/objects/{id}/summary`.
- `docs = get_docs(conn, id)` (mặc định hops=2). Riêng AGG: `docs = []`.
- Bộ `params` theo type (label chính xác; số làm tròn 1 chữ số thập phân; `source` trong ngoặc):

| type | params |
|---|---|
| machine | ngày D = ngày của `press_cycle` mới nhất. `Cycle TB · <lot>` s (PLC2) và `Lực ép TB · <lot>` kN (PLC2) cho mỗi lô từ `compare_by_lot(D)`; `Mục tiêu cycle` = `cycle_target_s` s (MES); `Số chu kỳ <MM-DD>` (PLC2); `Bảo trì gần nhất` = `"YYYY-MM-DD · <result>"` (CMMS, record PM-…); `Vận hành` = `"<operator> · <shift>"` (HR, record); `Nhiệt độ line` = `"min–max"` °C của env_temp ngày D trên đích `part_of` (ENV-L1). Thiếu dữ liệu thì bỏ dòng |
| hopper | mỗi event `lot_loaded`: `Nạp <lot>` = giờ `MM-DD HH:mm` (WMS, record) |
| lot | `Số lượng` (qty, pcs, ERP) · `Linh kiện` (tên part, PLM) · `Nhà cung cấp` (node `supplier` thượng nguồn theo `flow_edges`, ERP) · `Ngày nhập` (event goods_receipt, WMS, record) · `Cpk IQC` = `"<cpk> · <verdict>"` (record = IQC id) · `Part đã dùng` (`trace_forward(lot).parts`, chỉ khi > 0; nguồn MES) |
| purchase_order / receipt | `Số lượng`, `Nhà cung cấp`, `Ngày nhập` nếu có (ERP/WMS) |
| supplier | `Mã ERP`; `PO` = danh sách PO hạ nguồn; `Claim liên quan` = claim có link tới supplier (QMS) |
| serial | `Ép lúc` (PLC2, record từ `processed_on.evidence`) · `Máy` · `Lô` · `Thùng` · `Lô xuất` (MES/WMS) |
| shipment | `Số part`, `Số thùng`, `Trạng thái`, `Ngày giao`, `Khách` (WMS) |
| sales_order / customer | `Khách`, `Lô xuất` liên quan (ERP) |
| claim | `Triệu chứng`, `Ngày nhận`, `Serial`, `Khách` (QMS) |
| AGG-<lot> | `Số part` = 1,000 · `Số thùng` = 42 · mỗi lô xuất `"<SHP> · <parts> part · <status>"` (từ `trace_forward`, MES/WMS) |
| còn lại | `params = []` |

- [ ] **Step 1: Write failing tests** (`test_summary.py`):

```python
def p(s, label): return next(x for x in s["params"] if x["label"] == label)

def test_machine_summary(client):
    s = client.get("/api/objects/M02/summary").json()
    assert round(p(s, "Cycle TB · LOT-A")["value"]) == 31 and round(p(s, "Cycle TB · LOT-B")["value"]) == 42
    assert p(s, "Mục tiêu cycle")["value"] == 30
    assert p(s, "Lực ép TB · LOT-B")["value"] == pytest.approx(13.1, abs=0.1)
    assert p(s, "Bảo trì gần nhất")["source_record_id"] == "PM-0241"
    assert "NV-118" in p(s, "Vận hành")["value"] and p(s, "Nhiệt độ line")["value"] == "26.2–26.9"

def test_lot_summary(client):
    s = client.get("/api/objects/LOT-B/summary").json()
    assert p(s, "Số lượng")["value"] == 5000 and p(s, "Cpk IQC")["value"].startswith("0.92")
    assert p(s, "Ngày nhập")["value"] == "2026-10-28 09:10" and p(s, "Nhà cung cấp")["value"] == "SUP-S1"

def test_supplier_docs(client):
    s = client.get("/api/objects/SUP-S1/summary").json()
    assert {"D-09","D-03"} <= {d["doc_id"] for d in s["docs"]}

def test_aggregate_summary(client):                       # Review Focus #1
    s = client.get("/api/objects/AGG-LOT-B/summary").json()
    assert s["type"] == "aggregate" and p(s, "Số part")["value"] == 1000 and p(s, "Số thùng")["value"] == 42

def test_empty_node_summary(client):                      # Review Focus #5
    s = client.get("/api/objects/M01/summary").json()
    assert s["params"] == [] and s["docs"] == []

def test_every_flow_node_has_summary(client):
    f = client.get("/api/flow/CLM-0012").json()
    for n in f["spine"] + f["branches"]:
        r = client.get(f"/api/objects/{n['id']}/summary")
        assert r.status_code == 200 and all(x["source"] for x in r.json()["params"])
```
- [ ] **Step 2: Run** `uv run pytest tests/test_summary.py -v` → FAIL.
- [ ] **Step 3: Implement** `node_summary`: mỗi type một hàm `_params_<type>(conn, id) -> list[Param]` trong bảng dispatch.
- [ ] **Step 4: Run** `uv run pytest -v` → PASS. Chụp fixture `summary_m02.json`, `summary_m01.json` vào `frontend/src/test/fixtures/`.
- [ ] **Step 5: Commit** `git commit -m "feat(api): node summary with cited params"`

---

### Task 19 (DEMO-19): Dò lỗi đồ thị

**Files:**
- Create: `backend/onethread/queries/fault.py`, `backend/tests/test_fault.py`
- Modify: `backend/onethread/api.py`

**Interfaces:**
- Consumes: `flow_edges`, `collapse_map`, `node_info`, `get_claim`.
- Produces:
  - `Mark{id: str, reason: str}`; `FaultTrace{origin: str, at: datetime, red: list[Mark], orange: list[Mark]}`. Hai danh sách sắp theo id.
  - `fault_trace(conn, origin: str, at: datetime | None = None) -> FaultTrace`:
    - `origin` là claim có `attributes.serial` tồn tại trong `objects` → quy về serial đó; claim khác (CLM-0009, CLM-0011) giữ nguyên làm origin;
    - `at` mặc định: giờ `press_cycle` nếu origin là serial, ngược lại `2027-02-12T09:00:00+07:00`;
    - origin không tồn tại → `NotFound`.
  - `claim_fault_trace(conn, claim_id) -> FaultTrace` = `fault_trace(conn, claim_id)`.
  - Routes `GET /api/fault-trace?origin=&at=` và `GET /api/claims/{id}/fault-trace`.
- Thuật toán:

```text
keep = {origin} ∪ {box mà origin packed_in}  (khi origin là serial);  cmap = collapse_map(conn, keep)
E = flow_edges(at) gồm cả shortcut, áp cmap, bỏ tự nối
red    = {origin} ∪ BFS ngược E từ origin            reason: origin → "điểm lỗi";
         khác → f"thượng nguồn của {child} qua {relation}" + f" ({evidence.record})" nếu có
orange = BFS xuôi E, đa nguồn từ mọi node đỏ, bỏ node đỏ, bỏ type claim
         reason: f"hạ nguồn của {nguồn đỏ đã phát hiện nó}"
Node không có cạnh luồng (IQC, tài liệu, claim cũ) → red = [origin], orange = []
```
- [ ] **Step 1: Write failing tests** (`test_fault.py`):

```python
RED = {"MH20-0001","M02","HOP-1","LOT-B","RCV-2810","PO-4410","SUP-S1"}
ORANGE = {"BOX-001","AGG-LOT-B","SHP-1112","SHP-1115","SHP-1120","SO-7781","SO-7790",
          "CUS-C3","CUS-C5","PO-4380","RCV-1410","LOT-A"}

def ids(ms): return {m["id"] for m in ms}

def test_claim_fault_matches_spec(client):
    f = client.get("/api/claims/CLM-0012/fault-trace").json()
    assert ids(f["red"]) == RED and ids(f["orange"]) == ORANGE
    assert next(m for m in f["red"] if m["id"] == "HOP-1")["reason"].startswith("thượng nguồn của M02")

def test_time_window_changes_red(client):
    f = client.get("/api/fault-trace", params={"origin": "M02", "at": "2026-11-03T13:00:00+07:00"}).json()
    assert {"LOT-A","RCV-1410","PO-4380","SUP-S1"} <= ids(f["red"]) and "LOT-B" not in ids(f["red"])
    assert "LOT-B" in ids(f["orange"])

@pytest.mark.parametrize("origin", ["IQC-5531", "D-07", "CLM-0009"])   # Review Focus #3
def test_non_flow_origin(client, origin):
    f = client.get("/api/fault-trace", params={"origin": origin}).json()
    assert ids(f["red"]) == {origin} and f["orange"] == []

def test_unknown_origin_404(client):
    assert client.get("/api/fault-trace", params={"origin": "NOPE"}).status_code == 404
```
- [ ] **Step 2: Run** `uv run pytest tests/test_fault.py -v` → FAIL.
- [ ] **Step 3: Implement** theo thuật toán.
- [ ] **Step 4: Run** `uv run pytest -v` → PASS. Chụp fixture `fault_clm0012.json`.
- [ ] **Step 5: Commit** `git commit -m "feat(api): fault trace - upstream red, downstream orange"`

---

### Task 20 (DEMO-20): Gắn tài liệu (phân loại fix cứng)

**Files:**
- Create: `data/attachments.yaml`, `data/attachments/{CoA_S1-6203-B.pdf, BienBan_BaoTri_Press2_2026-11-05.pdf, Email_CustomerC5_xac_nhan_nhan_hang.txt}`, `backend/onethread/attach.py`, `backend/tests/test_attach.py`, `.gitignore` (thêm `backend/var/`)
- Modify: `backend/onethread/api.py`, `backend/onethread/config.py` (`uploads_dir = backend/var/uploads`), `backend/pyproject.toml` (`uv add python-multipart`)

**Interfaces:**
- Produces:
  - `AttachLink{to_id, tier, status, score}`; `AttachResult{doc_id, type, method: Literal["code","rule","llm","manual"], links: list[AttachLink], reason: str, duplicate: bool}`.
  - `attach_document(conn, filename: str, content: bytes, target_hint: str | None) -> AttachResult`
  - `list_samples() -> list[str]`; `reset_uploads(conn) -> int` (số doc đã xoá).
  - Routes:
    - `POST /api/documents` (multipart `file`, form `target_hint?`);
    - `GET /api/documents/samples` → `list[str]`;
    - `POST /api/documents/samples/{name}` (đọc file mẫu, gọi `attach_document`);
    - `POST /api/demo/reset` → `{"removed": n}`.
- Catalog `data/attachments.yaml`: mỗi mục `{file, type, method, target, tier, status, score, reason, text}`, đúng bảng DEMO-20 của spec.
  - CoA → LOT-B, `code`, 4/inferred/0.90, reason `"Khớp mã S1-6203-B ≡ LOT-B (alias NCC)"`.
  - Biên bản → M02, `rule`, 4/pending/0.75, reason `"Alias CMMS 'Press 2' → M02 + từ khoá 'bảo trì'"`.
  - Email → SHP-1115, `llm`, 5/suggested/0.60, reason `"Phân loại: thư khách hàng về lô giao 2026-11-15"`.
  - `text` email: `"Customer C5 xác nhận đã nhận đủ 240 bơm MH-20 của lô giao ngày 15/11/2026. Cảm ơn quý công ty."`.
- Quy tắc (theo thứ tự):
  1. Đuôi ∉ `pdf|txt|png|jpg|docx` → HTTP 415. > 10 MB → 413.
  2. Tên đã làm sạch (`Path(name).name`, chỉ giữ `[A-Za-z0-9._-]`, ký tự khác → `_`) trùng file của một doc `D-U*` đã có → trả doc đó với `duplicate=True`.
  3. Có trong catalog → dùng mục catalog.
  4. Ngược lại regex mọi `object_id` đã biết (độ dài ≥ 4) trong tên file + nội dung (chỉ `.txt`, decode utf-8 bỏ lỗi) → `code`, 4/inferred/0.90 tới từng ID khớp.
  5. Không khớp → `target_hint` (bắt buộc, thiếu → 422), `manual`, 4/pending/0.70.
- Ghi DB:
  - `doc_id = f"D-U{n:02d}"` (n = số doc `D-U%` + 1), `chunk_id = f"{doc_id}-c1"`, `file_uri = f"uploads/{doc_id}_{safe_name}"`;
  - `source = "UPLOAD"`, `page = 1`, `effective_from = 2027-02-12T09:00+07:00`, `extracted_codes = [đích]`;
  - link `{doc_id} mentions {target}` với `rule_version = "demo-attach-v0"`, `evidence = {method, reason, file}`.
  - File ghi vào `settings.uploads_dir`.
- Agent: `load_known_ids` đã nạp lại mỗi lượt hỏi, nên không cần sửa.
- [ ] **Step 1: Write failing tests** (`test_attach.py`; mỗi test gọi `/api/demo/reset` trong fixture `autouse`, override `settings.uploads_dir` sang `tmp_path`):

```python
def test_samples_attach_per_catalog(client):
    assert len(client.get("/api/documents/samples").json()) == 3
    r = client.post("/api/documents/samples/CoA_S1-6203-B.pdf").json()
    assert (r["method"], r["links"][0]["to_id"], r["links"][0]["status"]) == ("code", "LOT-B", "inferred")
    assert r["doc_id"] in {d["doc_id"] for d in client.get("/api/objects/LOT-B/docs").json()}

def test_unknown_txt_matches_code(client):
    r = client.post("/api/documents", files={"file": ("ghi_chu.txt", b"Kiem tra lai PO-4410")}).json()
    assert r["method"] == "code" and r["links"][0]["to_id"] == "PO-4410"

def test_manual_needs_hint(client):
    assert client.post("/api/documents", files={"file": ("x.txt", b"khong co ma")}).status_code == 422
    r = client.post("/api/documents", data={"target_hint": "HOP-1"}, files={"file": ("x.txt", b"khong co ma")}).json()
    assert r["method"] == "manual" and r["links"][0]["to_id"] == "HOP-1"

def test_unsafe_and_duplicate_names(client, tmp_path):     # Review Focus #4
    a = client.post("/api/documents", files={"file": ("../../etc/Biên bản M02.txt", b"M02")}).json()
    b = client.post("/api/documents", files={"file": ("../../etc/Biên bản M02.txt", b"M02")}).json()
    assert b["duplicate"] and b["doc_id"] == a["doc_id"]
    assert all(p.parent == tmp_path for p in tmp_path.iterdir())

def test_limits(client):
    assert client.post("/api/documents", files={"file": ("a.exe", b"x")}).status_code == 415
    assert client.post("/api/documents", files={"file": ("a.txt", b"x" * (10 * 2**20 + 1))}).status_code == 413

def test_reset_removes_uploads(client):
    client.post("/api/documents/samples/CoA_S1-6203-B.pdf")
    assert client.post("/api/demo/reset").json()["removed"] == 1
    assert not any(d["doc_id"].startswith("D-U") for d in client.get("/api/objects/LOT-B/docs").json())
```
- [ ] **Step 2: Run** `uv run pytest tests/test_attach.py -v` → FAIL.
- [ ] **Step 3: Implement.** File mẫu `.pdf` là PDF 1 trang tối thiểu (< 5 KB, chữ ASCII mô tả nội dung); file `.txt` chứa đúng `text` của catalog.
- [ ] **Step 4: Run** `uv run pytest -v` → PASS (story consistency vẫn xanh vì reset). Chụp fixture `attach_coa.json`.
- [ ] **Step 5: Commit** `git commit -m "feat(api): document attach with hard-coded classification and demo reset"`

---

### Task 21 (DEMO-21): Thread thẳng + công tắc Bình thường / Truy lỗi

**Files:**
- Create: `frontend/src/thread/flowLayout.ts`, `frontend/src/thread/flowLayout.test.ts`
- Modify: `frontend/src/api/types.ts`, `frontend/src/api/client.ts`, `frontend/src/store/demo.ts`, `frontend/src/store/demo.test.ts`, `frontend/src/thread/layout.ts`, `frontend/src/thread/ThreadGraph.tsx`, `frontend/src/thread/ThreadGraph.test.tsx`, `frontend/src/thread/ThreadView.tsx`

**Interfaces:**
- Consumes: `/api/flow/{id}` (Task 17), fixture `flow_clm0012.json`.
- Produces:
  - `types.ts`: `FlowNode`, `FlowEdge`, `Attachment`, `FlowGraph`, mirror pydantic Task 17. `client.ts`: `getFlow(id: string): Promise<FlowGraph>`.
  - Store: `mode: 'normal' | 'fault'` (khởi tạo `'normal'`), `setMode(m)`. `openClaim` đặt thêm `mode: 'fault'`. `reset` trả về `'normal'`.
  - `flowLayout(flow: FlowGraph): { nodes: { id: string; x: number; y: number }[]; width: number; height: number; bands: { stage: string; label: string; x: number; w: number }[] }`:
    - cột i: `x = 16 + i * (NODE_W + 20)`;
    - hàng r: `y = 40 + r * (NODE_H + 26)`;
    - branch đặt ở cột của node spine cùng `type`, không có thì cột của `parent_id`, `y` theo `row`;
    - `bands` gom các cột liên tiếp cùng `stage`, nhãn theo `STAGES`.
  - `layout.ts`: bỏ `LAYOUT`, `LANES`, `Tone`. Giữ `edgeStyle`, `NODE_EVIDENCE`, `pickSides`, `NODE_W = 104`, `NODE_H = 34`. Thêm `neutralEdgeStyle(status)`: như `edgeStyle` nhưng `stroke` luôn `#8E959F`.
  - `<ThreadGraph flow={FlowGraph} />`:
    - kích thước = `flowLayout` (zoom 1, `nodesDraggable=false`, `panOnDrag=false`);
    - nền dải chặng có nhãn; badge `"{n} đính kèm"` (`data-testid="att-{id}"`) dưới node khi `attachments[id]?.length > 0`;
    - cạnh `active=false` mờ (`opacity .45`);
    - chế độ bình thường: node trung tính, cạnh `neutralEdgeStyle`;
    - bấm node: `focusNode(id)` + logic tab (Task 22 thay bằng `selectNode`).
  - `ThreadView`:
    - fetch `getClaim` + `getTrace` (giữ cho các tab đợt 1) + `getFlow(claimId)`;
    - toolbar thay nhóm Lanes/Table/Timeline/Depth trang trí bằng toggle `"Truy lỗi"` (`aria-pressed`, gọi `setMode`);
    - vùng graph `overflowX: auto`, tự cuộn tới node đang focus.
- [ ] **Step 1: Write failing tests**

```ts
// flowLayout.test.ts
test("spine is one row in order", () => {
  const { nodes } = flowLayout(flow)
  const spine = flow.spine.map((n) => nodes.find((p) => p.id === n.id)!)
  expect(new Set(spine.map((p) => p.y)).size).toBe(1)
  expect(spine.map((p) => p.x)).toEqual([...spine.map((p) => p.x)].sort((a, b) => a - b))
})
test("branches sit under their same-type spine column", () => {
  const { nodes } = flowLayout(flow); const at = (id: string) => nodes.find((p) => p.id === id)!
  expect(at("LOT-A").x).toBe(at("LOT-B").x); expect(at("AGG-LOT-B").x).toBe(at("MH20-0001").x)
  expect(at("LOT-A").y).toBeGreaterThan(at("LOT-B").y)
})
// ThreadGraph.test.tsx (thay test toạ độ cũ)
test("renders every spine and branch node", () => {
  render(<ThreadGraph flow={flow} />)
  for (const l of ["CLM-0012", "MH20-0001", "Machine 02", "LOT-B", "LOT-A", "Customer C5"]) expect(screen.getByText(l)).toBeInTheDocument()
  expect(screen.getByTestId("att-SUP-S1")).toHaveTextContent("3 đính kèm")   // CLM-0009, D-09, D-03
})
test("normal mode has no fault colours", () => {
  useDemo.setState({ mode: "normal" })
  const { container } = render(<ThreadGraph flow={flow} />)
  expect(container.querySelectorAll(".gn-red, .gn-orange")).toHaveLength(0)
})
// demo.test.ts
test("openClaim switches to fault mode, reset back to normal", () => {
  useDemo.getState().openClaim("CLM-0012"); expect(useDemo.getState().mode).toBe("fault")
  useDemo.getState().reset(); expect(useDemo.getState().mode).toBe("normal")
})
```
- [ ] **Step 2: Run** `cd frontend && npx vitest run` → FAIL.
- [ ] **Step 3: Implement.** Class màu `gn-red`, `gn-orange` khai báo trong `tokens.css` từ task này (Task 23 dùng). Xoá chip tĩnh "nạp LOT-B 13:52"; thông tin này đã nằm trong `sub` của HOP-1/LOT-B và attachment ISS-1103.
- [ ] **Step 4: Run** vitest → PASS. Thủ công `make demo`: 12 node trục trên một hàng ở 1440×900 và 1280×800 (cuộn ngang trong vùng graph, không cuộn cả trang); bật/tắt "Truy lỗi" không lỗi console.
- [ ] **Step 5: Commit** `git commit -m "feat(web): straight flow thread and normal/fault toggle"`

---

### Task 22 (DEMO-22): Tab "Tổng quan" cho mọi node

**Files:**
- Create: `frontend/src/evidence/OverviewTab.tsx`, `frontend/src/evidence/OverviewTab.test.tsx`
- Modify: `frontend/src/store/demo.ts`, `frontend/src/evidence/EvidencePanel.tsx`, `frontend/src/thread/ThreadGraph.tsx`, `frontend/src/agent/AgentPanel.tsx`, `frontend/src/api/{types,client}.ts`

**Interfaces:**
- Consumes: `/api/objects/{id}/summary` (Task 18), fixture `summary_m02.json`, `summary_m01.json`.
- Produces:
  - `types.ts`: `Param`, `NodeSummary`. `client.ts`: `getSummary(id: string): Promise<NodeSummary>`.
  - Store:
    - `EvidenceTab` thêm `'overview'`;
    - `selectNode(id: string)`: `focusNode(id)`; nếu `mode === 'fault'` và `NODE_EVIDENCE[id]` thì `setEvidence(NODE_EVIDENCE[id])`, ngược lại `setEvidence('overview')`.
  - `ThreadGraph` và cite chip trong `AgentPanel` gọi `selectNode`.
  - `<OverviewTab id={string} />`:
    - tiêu đề `"{name} · {type}"` + chặng;
    - bảng `params` (label | value + unit | chip `cite` = `source`, title = `source_record_id`);
    - danh sách `docs` với badge theo status (tái dùng nhãn LotTab: confirmed "bậc N · duyệt", pending "chờ duyệt · 0.78", suggested "chỉ gợi ý · bậc 5");
    - nút `"Đặt làm điểm lỗi"` (ẩn khi `type === 'aggregate'`, gọi `setFaultOrigin` — Task 23) và `"Gắn tài liệu"` (mở dialog — Task 24). Hai nút render disabled cho tới khi task tương ứng nối.
    - Không có params → `"Chưa có thông số"`; không có docs → `"Chưa có tài liệu · Gắn tài liệu"`.
  - `EvidencePanel`:
    - tab đầu `"Tổng quan · {focusNodeId ?? flow.root}"` luôn có;
    - tab m02/lot/impact chỉ hiện khi `mode === 'fault'`;
    - ở chế độ normal mà tab hiện tại không phải overview → hiển thị overview.
- [ ] **Step 1: Write failing tests** (mock `getSummary` bằng fixture):
  - `OverviewTab id="M02"` → thấy `Cycle TB · LOT-B`, `PM-0241` (chip), `NV-118`.
  - `OverviewTab id="M01"` → thấy `Chưa có thông số` và `Chưa có tài liệu` (Review Focus #5).
  - Store: `mode='normal'`, `selectNode('M02')` → `evidenceTab === 'overview'`; `mode='fault'`, `selectNode('M02')` → `'m02'`; `selectNode('PO-4410')` → `'overview'`.
  - `EvidencePanel` ở normal không có tab "Khoanh vùng LOT-B".
- [ ] **Step 2: Run** vitest → FAIL.
- [ ] **Step 3: Implement.** `OverviewTab` dùng `useAsync(() => getSummary(id), [id, dataVersion])`. `dataVersion` thêm vào store ở task này: `dataVersion: 0`, `bumpData()`.
- [ ] **Step 4: Run** vitest → PASS. Thủ công: bấm lần lượt mọi node trục + nhánh, kể cả `AGG-LOT-B`: không node nào "chết".
- [ ] **Step 5: Commit** `git commit -m "feat(web): overview tab for any node"`

---

### Task 23 (DEMO-23): Tô màu dò lỗi

**Files:**
- Modify: `frontend/src/api/{types,client}.ts`, `frontend/src/store/demo.ts`, `frontend/src/thread/{ThreadGraph,ThreadView}.tsx`, `frontend/src/evidence/OverviewTab.tsx`, `frontend/src/thread/ThreadGraph.test.tsx`

**Interfaces:**
- Consumes: `/api/claims/{id}/fault-trace`, `/api/fault-trace` (Task 19), fixture `fault_clm0012.json`.
- Produces:
  - `types.ts`: `Mark`, `FaultTrace`. `client.ts`: `getClaimFault(claimId)`, `getFault(origin: string, at?: string)`.
  - Store: `faultOrigin: string | null` (khởi tạo `null`, reset về `null`); `setFaultOrigin(id | null)`. `setFaultOrigin(id)` đồng thời đặt `mode: 'fault'`.
  - `ThreadView`:
    - khi `mode === 'fault'`: `faultOrigin ? getFault(faultOrigin, claimFault.at) : getClaimFault(claimId)` → `marks: Record<string, 'red' | 'orange'>` + `reasons: Record<string, string>` truyền vào `ThreadGraph`;
    - toolbar hiện `"Điểm lỗi: {origin}"` và nút `"Về điểm lỗi của claim"` khi `faultOrigin` khác null.
  - `<ThreadGraph flow marks? reasons? />`:
    - node `marks[id]` → class `gn-red` / `gn-orange`; `title` = reason;
    - cạnh có cả hai đầu đỏ → `stroke #C62828`, `strokeWidth 3`;
    - claim của flow (`type === 'claim'`) luôn viền đen 2px "điểm báo lỗi", không nền;
    - legend: `"Đỏ: điểm lỗi và thượng nguồn · Cam: hạ nguồn có thể bị ảnh hưởng"`;
    - không có `marks` (chế độ normal) → như Task 21.
  - Bỏ tone cứng còn sót (`focus/bad/suspect`) khỏi graph.
- [ ] **Step 1: Write failing tests**
  - Render `ThreadGraph` với `flow_clm0012` + marks từ `fault_clm0012` → đúng 7 phần tử `.gn-red` và 12 `.gn-orange`.
  - Node CLM-0012 không có `.gn-red`/`.gn-orange`.
  - `setFaultOrigin('M02')` → `mode === 'fault'`.
  - Mock `getFault` → render `ThreadView` với `faultOrigin='LOT-B'`: gọi `getFault('LOT-B', <at của claim>)`.
- [ ] **Step 2: Run** vitest → FAIL.
- [ ] **Step 3: Implement.** Nối nút `"Đặt làm điểm lỗi"` của OverviewTab.
- [ ] **Step 4: Run** vitest → PASS. Thủ công: mở CLM-0012 → 7 đỏ / 12 cam; "Đặt làm điểm lỗi" trên LOT-B → màu đổi < 500 ms không reload; "Về điểm lỗi của claim" khôi phục.
- [ ] **Step 5: Commit** `git commit -m "feat(web): fault-trace colouring with selectable origin"`

---

### Task 24 (DEMO-24): Dialog gắn tài liệu

**Files:**
- Create: `frontend/src/attach/AttachDialog.tsx`, `frontend/src/attach/AttachDialog.test.tsx`
- Modify: `frontend/src/api/{types,client}.ts`, `frontend/src/store/demo.ts`, `frontend/src/evidence/OverviewTab.tsx`, `frontend/src/thread/{ThreadView,ThreadGraph}.tsx`

**Interfaces:**
- Consumes: routes Task 20, fixture `attach_coa.json`.
- Produces:
  - `types.ts`: `AttachResult`.
  - `client.ts`:
    - `uploadDocument(file: File, targetHint?: string): Promise<AttachResult>` (FormData, POST);
    - `listSamples(): Promise<string[]>`;
    - `attachSample(name: string): Promise<AttachResult>`;
    - `resetDemoData(): Promise<{ removed: number }>`.
  - Store: `flashNodeId: string | null`; `flash(id)` đặt rồi tự xoá sau 1200 ms. `attachOpen: boolean`, `openAttach()`, `closeAttach()`.
  - `<AttachDialog />` (modal, mở từ nút toolbar `"Gắn tài liệu"` trong ThreadView và nút trong OverviewTab):
    - vùng kéo thả + `<input type="file">`, 3 nút file mẫu từ `listSamples()`; gửi `targetHint = focusNodeId`;
    - thẻ kết quả: `type`, chip cách phân loại (`code` "Mã" · `rule` "Quy tắc" · `llm` "LLM" · `manual` "Thủ công"), node đích, `"{status} · {score}"`, `reason`; `duplicate` → thêm dòng `"Tài liệu đã gắn trước đó"`;
    - lỗi HTTP → dòng đỏ với `detail`.
    - Thành công: `bumpData()` (ThreadView refetch flow, OverviewTab refetch summary) + `flash(links[0].to_id)`.
  - `ThreadGraph`: node `flashNodeId` có outline teal nhấp nháy (CSS animation 1.2 s). Doc có `doc_id` bắt đầu `D-U` trong OverviewTab mang badge `"mới"`.
  - Plan đợt 1 Task 14: nút "Reset demo" gọi thêm `resetDemoData()` (ghi trong plan đó, không làm ở đây).
- [ ] **Step 1: Write failing tests** (mock client):
  - Bấm nút mẫu `CoA_S1-6203-B.pdf` → thấy `"Mã"`, `"LOT-B"`, `"inferred · 0.9"`; `useDemo.getState().dataVersion` tăng 1; `flashNodeId === 'LOT-B'`.
  - Upload trả 415 → thấy dòng lỗi chứa detail, `dataVersion` không đổi.
  - Kết quả `duplicate: true` → thấy `"Tài liệu đã gắn trước đó"`.
- [ ] **Step 2: Run** vitest → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `make test` → backend + frontend PASS. Thủ công: gắn 3 file mẫu → badge đính kèm của LOT-B, M02, SHP-1115 mỗi cái +1, tài liệu hiện trong Tổng quan với badge "mới"; `curl -X POST localhost:8000/api/demo/reset` + reload → về số cũ; không lỗi console.
- [ ] **Step 5: Commit** `git commit -m "feat(web): attach document dialog"`

---

## Thứ tự & song song

```
T16 ─┬─ T17 ─┬─ T21 ─┬─ T22 ─┬─ T23
     ├─ T18 ─┘       │       └─ T24
     ├─ T19 ─────────┘ (T23 cần fixture T19)
     └─ T20 ───────────────────── T24
Sau đó: plan đợt 1 Task 14 (deep link thêm `mode`, reset gọi resetDemoData) → Task 15.
```
