# One Thread · Demo PoC "Truy vết claim sau 3 tháng" — Design & Tickets

- Ngày: 2026-11-11
- Nguồn: `docs/One_Thread_Kien_truc_he_thong.pdf` (mục 6 kịch bản, mục 8 phạm vi demo), các sơ đồ trong `docs/`
- Style UI: bộ wireframe "One Thread — command room" (https://claude.ai/artifact/3NJQG5yRLjbVpMHVFSBqoV)
- Mockup màn trung tâm để duyệt: https://claude.ai/artifact/Cy8mwVgVmm3A1fAQawfqgh

## 1. Mục tiêu và phạm vi

**Mục tiêu.** Trình diễn happy path cho stakeholder: một bơm MH-20 đã giao 3 tháng bị khách khiếu nại kêu to; One Thread truy vết serial qua sản xuất, kho, mua hàng, chất lượng, tài liệu; AI agent đề xuất nguyên nhân gốc kèm nguồn: **ổ bi Bearing 6203 LOT-B nhập kho ngày 28/10/2026 từ Supplier S1, IQC Cpk 0.92**.

**Quyết định đã chốt**
| Chủ đề | Quyết định |
|---|---|
| Nguyên nhân gốc | Bearing 6203 LOT-B, đúng tài liệu (thay cho "ốc vít" trong brief ban đầu) |
| UI | Tự thiết kế theo style bộ wireframe command room: IBM Plex Sans/Mono 12px, header `#1C2026`, activity bar `#23272E`, accent teal `#0E7C86`, đỏ `#C62828`, amber `#B45309`, radius 2px, panel Agent 340px bên phải, timeline đáy |
| AI | Hybrid: agent gọi Claude thật qua tool chỉ đọc; `DEMO_MODE` phát lại câu trả lời đã ghi khi lỗi/mất mạng |
| Stack | Đúng mục 8: PostgreSQL (6 bảng lõi) · FastAPI · React + Vite + React Flow + Tailwind |

**Ngoài phạm vi (hardcode/bỏ):** ingest pipeline (Kafka, Flink, Bronze), Redis, lakehouse, Neo4j, Keycloak/auth, màn Plant và Connections (chỉ là icon không hoạt động), duyệt link thật (nút có nhưng không ghi).

**Ngoại lệ đợt 2:** "gắn tài liệu" (DEMO-20) là endpoint ghi duy nhất. Phân loại fix cứng theo catalog, dữ liệu upload xoá được bằng reset.

## 2. Demo Flow (4 màn)

Đồng hồ demo cố định **2027-02-12 09:00**. Hàng giao **2026-11-12**, tức 3 tháng trước.

| # | Màn | Người thuyết trình bấm | Thông điệp |
|---|---|---|---|
| 1 | **Claims inbox** (sidebar trái + tab claim) | Chọn `CLM-0012`: Customer C3, serial MH20-0001, "bơm kêu to bất thường" | Claim tự nối serial bằng khoá chính xác (bậc 1) |
| 2 | **Thread trace** (lanes graph) | Mở tab `Thread · MH20-0001`: CLM-0012 → SHP-1112 → MH20-0001 → Machine 02 ← Hopper 1 ← LOT-B ← RCV-2810 / PO-4410 / S1 · IQC-5531 · tài liệu | Truy ngược 3 tháng trên một màn, link có bậc tin cậy |
| 3 | **Evidence panel** (bấm node) | Machine 02: cycle time 31 → 42 s sau 13:52, lực ép +6%, loại trừ bảo trì/vận hành/nhiệt độ. LOT-B/IQC: Cpk 0.92 vs LOT-A 1.45, CLM-0009, tài liệu D-12/D-09/D-07/D-03 | Bằng chứng nhiều phòng ban gom một chỗ |
| 4 | **Agent RCA + Khoanh vùng** | Gõ (hoặc bấm chip) câu hỏi → tool calls chạy → câu trả lời có `cite`; bấm "Xem khoanh vùng" → 1,000 part · 42 thùng · 3 lô · 2 đã tới khách; "Tạo nháp báo cáo" | AI đề xuất, mọi câu dẫn nguồn, người duyệt |

Mockup (link ở đầu) thể hiện bước 2–4 trên một màn; bước 1 là sidebar trái của cùng layout.

## 3. Dummy Data

### 3.1 Story bible — hằng số không được lệch

| Khoá | Giá trị |
|---|---|
| Sản phẩm / serial | Bơm nước MH-20 · `MH20-0001` |
| Khách / đơn | Customer C3 · `SO-7781` |
| Linh kiện / lô | Bearing 6203 · `LOT-B` (alias NCC `S1-6203-B`), đối chứng `LOT-A` |
| Nhập kho LOT-B | `RCV-2810` · 2026-10-28 09:10 · `PO-4410` · Supplier S1 (ERP `NCC-S1`) · 5,000 pcs |
| IQC | `IQC-5507` LOT-A Cpk 1.45 Đạt · `IQC-5531` LOT-B Cpk 0.92 "chấp nhận có điều kiện" · spec ≥ 1.33 (D-12 p.7) |
| Nạp lô | LOT-B vào Hopper 1, 2026-11-03 13:52:00 giờ nhà máy (PLC2 ghi 13:52:38, lệch +38 s) |
| Ép serial | MH20-0001 trên Machine 02 (alias `MC-02`/`PLC2`/`Press 2`) lúc 2026-11-03 14:05 |
| Tín hiệu máy | Cycle time 31 s → 42 s sau 13:52 (mục tiêu 30 s); lực ép đỉnh 12.4 → 13.1 kN (+6%) |
| Loại trừ | Bảo trì `PM-0241` 2026-10-20 bình thường · vận hành `NV-118` ca 2 không đổi · nhiệt độ `ENV-L1` 26–27 °C |
| Nguồn LOT-A (đợt 2) | `PO-4380` · Supplier S1 · 5,000 pcs → `RCV-1410` 2026-10-06 09:30 → LOT-A |
| Khoanh vùng | 1,000 part dùng LOT-B · 42 thùng · `SHP-1112` C3 400 pcs/17 thùng giao 11-12 · `SHP-1115` C5 240/10 giao 11-15 · `SHP-1120` 360/15 trong kho |
| Claim | `CLM-0012` nhận 2027-02-10 · `CLM-0011` (rò nước, nhiễu) · `CLM-0009` 09/2026 tiếng ồn 6203, đã đóng bằng tăng lấy mẫu IQC n=5 → 20 |
| Tài liệu | `D-12` bản vẽ MH-20 p.7 (bậc 4 confirmed) · `D-09` 8D CLM-0009 (bậc 4 confirmed) · `D-07` biên bản họp 10-29 "lô B hơi rơ" (bậc 4 chờ duyệt 0.78) · `D-03` báo cáo lỗi 2025 "tiếng ồn ổ bi" (bậc 5 gợi ý) |

### 3.2 Cách tạo
- **Viết tay (~30 object)**: `data/story.yaml` chứa mọi object, alias, link, tài liệu (text chunk ngắn) và time mapping ở bảng trên.
- **Sinh bằng script, seed cố định**: 1,000 serial (MH20-0001…1000) + link `processed_on`/`packed_in`/`shipped_in`; 42 thùng; event cycle Machine 02 ngày 11-03 12:00–16:00 (~400 event, nhiễu nhỏ quanh 31/42 s); event bảo trì/ca/nhiệt độ; vài serial LOT-A ngày 11-02 làm đối chứng.
- **Schema**: đúng 6 bảng của tài liệu: `objects`, `aliases`, `events`, `documents`, `links`, `time_mappings`.
- **Chốt nhất quán**: `test_story_consistency.py` truy vấn DB và assert mọi con số ở 3.1.

### 3.3 Luồng vật tư (flow bible) — trục "thread thẳng" (đợt 2)

**Vì sao cần.** Dữ liệu đợt 1 có đủ mắt xích cho câu chuyện nhưng **chưa có hướng luồng**:
- Link ghi theo nhiều chiều. `LOT-B received_under RCV-2810` đi ngược luồng, `HOP-1 fed_into M02` đi xuôi.
- Trace là BFS vô hướng, lane xếp theo phòng ban.
- Có mắt xích hở: LOT-A không có PO/NCC, `RCV-1410` không có link, `LINE-1` không nối với M02, claim không nối với khách.
- `LOT-A fed_into HOP-1` không có mốc thời gian. Dò ngược đơn giản sẽ kéo cả LOT-A vào chuỗi lỗi.

Mục này chốt luồng; DEMO-16 nạp nó vào dữ liệu. Phần thêm mới đánh dấu **mới**.

**Trục chính của MH20-0001** (trái → phải, một hàng, 6 chặng):

| Chặng | Node | Cạnh nối từ node trước | Mốc |
|---|---|---|---|
| Cung ứng | `SUP-S1` | — | ERP `NCC-S1` |
| Cung ứng | `PO-4410` | `PO-4410 supplied_by SUP-S1` | 5,000 pcs |
| Kho | `RCV-2810` | `RCV-2810 received_under PO-4410` | 2026-10-28 09:10 |
| Kho | `LOT-B` | `LOT-B received_under RCV-2810` | Bearing 6203 · 5,000 pcs |
| Sản xuất | `HOP-1` | `LOT-B fed_into HOP-1` | hiệu lực từ 2026-11-03 13:52 (ISS-1103) |
| Sản xuất | `M02` | `HOP-1 fed_into M02` | |
| Sản xuất | `MH20-0001` | `MH20-0001 processed_on M02` | 2026-11-03 14:05:18 (PLC2-000702) |
| Logistics | `BOX-001` | `MH20-0001 packed_in BOX-001` | |
| Logistics | `SHP-1112` | `BOX-001 shipped_in SHP-1112` | giao 2026-11-12 |
| Khách hàng | `SO-7781` | `SHP-1112 ordered_in SO-7781` | |
| Khách hàng | `CUS-C3` | `SO-7781 delivered_to CUS-C3` | |
| Hậu mãi | `CLM-0012` | **mới** `CLM-0012 raised_by CUS-C3` | nhận 2027-02-10 |

**Nhánh phụ** (hàng thứ hai, dưới node cha):
- `LOT-A → HOP-1` hiệu lực **2026-11-03 08:00 → 13:52**. **Mới:** `valid_from/valid_to` trong `evidence`; LOT-B có `valid_from` 13:52.
- Thượng nguồn LOT-A (**mới**, bịt lỗ hở): `PO-4380 supplied_by SUP-S1` (5,000 pcs), `RCV-1410 received_under PO-4380`, `LOT-A received_under RCV-1410` (2026-10-06 09:30, khớp event đã seed).
- Hạ nguồn: `M02` → nút gộp `AGG-LOT-B` "+999 part · LOT-B" (MH20-0002…1000 cùng thùng của chúng) → `SHP-1112`, `SHP-1115` → `SO-7790` → `CUS-C5`, và `SHP-1120` (360 pcs, còn trong kho).

**Đính kèm** (không nằm trên trục, hiện thành badge số trên node):

| Node | Đính kèm |
|---|---|
| `SUP-S1` | CLM-0009 (inferred 0.81), D-09, D-03 (gợi ý) |
| `LOT-B` | IQC-5531 (+ D-12 p.7), D-07 (chờ duyệt 0.78), alias S1-6203-B, BRG-6203 |
| `LOT-A` | IQC-5507 |
| `HOP-1` | ISS-1103 |
| `M02` | PM-0241, ca NV-118, PLC2, ENV-L1 (qua **mới** `M02 part_of LINE-1`) |

**Hướng luồng theo quan hệ.** Graph và thuật toán dò lỗi dùng chung bảng này:

| Quan hệ | Thượng nguồn → hạ nguồn |
|---|---|
| `supplied_by`, `received_under`, `processed_on`, `uses_lot`, `raised_by` | `to → from` |
| `fed_into`, `packed_in`, `shipped_in`, `ordered_in`, `delivered_to` | `from → to` |
| `about`, `inspected`, `specified_by`, `describes`, `mentions`, `similar_to`, `concerns`, `part_of`, `same_as` | không phải luồng → đính kèm |

- `uses_lot` và `serial shipped_in SHP` là cạnh tắt: dùng khi dò, không vẽ.
- `same_as` gộp alias thành một node.
- Chỉ link `confirmed`/`inferred` được coi là luồng.

**Kết quả dò lỗi mong đợi cho CLM-0012.** DEMO-19 assert đúng bảng này:

| Màu | Node | Lý do |
|---|---|---|
| Điểm lỗi | `MH20-0001` @ 2026-11-03 14:05:18 | serial của claim |
| Đỏ | MH20-0001, M02, HOP-1, LOT-B, RCV-2810, PO-4410, SUP-S1 | điểm lỗi + toàn bộ thượng nguồn còn hiệu lực tại thời điểm đó |
| Cam | BOX-001, AGG-LOT-B, SHP-1112, SHP-1115, SHP-1120, SO-7781, SO-7790, CUS-C3, CUS-C5 | hạ nguồn của node đỏ: hàng có thể đã nhận linh kiện lỗi |
| Cam | PO-4380, RCV-1410, LOT-A | hạ nguồn của SUP-S1: lô khác cùng NCC, cần xem lại (IQC-5507 Cpk 1.45 cho phép loại trừ) |
| Viền "điểm báo lỗi" | CLM-0012 | claim không tô nền, kể cả khi nằm ở hạ nguồn |

Không có node luồng nào giữ màu trung tính. Tài liệu và đính kèm không tô màu.

## 4. Tickets

Tag: `[Infra]` · `[Dummy Data]` · `[Integration]` (API, agent) · `[UI/Frontend]` · `[Demo Ops]`

### DEMO-01 `[Infra]` Khởi tạo repo và chạy một lệnh
- **Việc:** `backend/` (FastAPI, uv, Python 3.13), `frontend/` (Vite + React + TS + Tailwind + React Flow), `docker-compose.yml` với PostgreSQL 16, `Makefile`: `make demo` = up DB → seed → API → web.
- **Hardcode:** không auth, không env theo môi trường; một file `.env.example`.
- **DoD:** clone sạch → `make demo` → mở `localhost:5173` thấy app shell rỗng, API `/health` trả 200, trong < 3 phút.

### DEMO-02 `[Dummy Data]` Story bible + schema 6 bảng
- **Việc:** viết `data/story.yaml` theo mục 3.1; tạo DDL 6 bảng lõi.
- **Hardcode:** ID dạng chuỗi dễ đọc (`LOT-B`, `M02`) thay UUID; `embedding` để NULL.
- **DoD:** người thuyết trình đọc `story.yaml` và kể được toàn bộ câu chuyện; DDL chạy sạch.

### DEMO-03 `[Dummy Data]` Seed + generator
- **Việc:** `seed.py` nạp `story.yaml`, sinh dữ liệu khối lượng (mục 3.2) với `random.seed(42)`.
- **Hardcode:** link được ghi thẳng với `tier/status/score/evidence`, không chạy thuật toán liên kết thật; time offset đã bù sẵn nhưng vẫn lưu `time_mappings` PLC2 +38 s để hiển thị.
- **DoD:** `make seed` idempotent; chạy 2 lần cho cùng dữ liệu.

### DEMO-04 `[Dummy Data]` Test nhất quán câu chuyện
- **Việc:** `tests/test_story_consistency.py` assert: 31→42 s quanh 13:52, +6%, Cpk 0.92/1.45, 1,000/42/3/2, serial 0001 ép 14:05 trên M02, CLM-0012 → MH20-0001.
- **DoD:** test xanh; sửa một số trong YAML làm lệch → test đỏ.

### DEMO-05 `[Integration]` Read API = tool của agent
- **Việc:** REST chỉ đọc, mỗi endpoint đồng thời là một tool: `GET /claims`, `/claims/{id}`, `/trace/{serial}` (trace_serial), `/objects/{id}/events?from&to` (get_events), `/objects/{id}/links?status` (get_links), `/objects/{id}/docs?at` (get_docs), `/metrics/{kpi}?objects` (metrics), `/impact/{lot}` (trace_forward). Mỗi bản ghi trả kèm `source`, `source_record_id` để làm `cite`.
- **Hardcode:** truy vấn SQL thẳng trên bảng lõi, recursive CTE cho trace; `run_python` là hàm so sánh cố định theo lô (không sandbox).
- **DoD:** gọi đủ 8 endpoint bằng `httpie` ra đúng số liệu story bible; có test API cho `/trace/MH20-0001` và `/impact/LOT-B`.

### DEMO-06 `[UI/Frontend]` App shell theo style command room
- **Việc:** design tokens (màu, font, chip/cite/btn/tab) từ mockup; header, activity bar, tab bar, sidebar trái, panel Agent phải, timeline + status bar đáy; khung 1440×900.
- **Hardcode:** đồng hồ `2027-02-12 09:00`, badge "DEMO", user "Quality · QA engineer"; icon Plant/Connections không hoạt động.
- **DoD:** so cạnh mockup ở 1440×900 khớp layout, màu, font; không vỡ ở 1280×800 (máy chiếu).

### DEMO-07 `[UI/Frontend]` Màn 1 · Claims inbox
- **Việc:** sidebar danh sách claim (Đang mở / Đã đóng), legend link theo độ tin cậy, review queue, alias đã hợp nhất; chọn claim mở tab claim + tab Thread.
- **Hardcode:** chỉ CLM-0012 điều hướng được; CLM-0011, CLM-0009 hiển thị tĩnh; ô tìm kiếm không lọc.
- **DoD:** từ trang mở đầu, 1 click vào CLM-0012 tới màn Thread.

### DEMO-08 `[UI/Frontend]` Màn 2 · Thread trace lanes graph
- **Việc:** React Flow với 6 lane (Khách hàng/Logistics, Sản xuất, Kho, Mua hàng, Chất lượng, Tài liệu), node từ `/trace`, cạnh theo trạng thái: liền = confirmed, gạch = inferred, chấm teal = chờ duyệt, chấm xám = gợi ý; node lỗi đỏ, lô nghi vấn amber; entity header + "As of".
- **Hardcode:** toạ độ node cố định theo lane (không auto-layout); nút Table/Timeline/Depth chỉ là trang trí.
- **DoD:** graph khớp mockup; bấm Machine 02, LOT-B, IQC-5531 đổi evidence panel; render < 1 s.

### DEMO-09 `[UI/Frontend]` Màn 3 · Evidence panel
- **Việc:** 3 tab: (a) Machine 02: chart cycle time 12:00–16:00 với vạch 13:52 và 14:05, bảng yếu tố trước/sau + loại trừ; (b) LOT-B: bảng IQC A vs B, ca tương tự CLM-0009, danh sách tài liệu theo bậc; (c) Khoanh vùng: 4 KPI + bảng 3 lô xuất hàng.
- **Hardcode:** cửa sổ thời gian chart cố định; dòng "Đọc nhanh" là text tĩnh.
- **DoD:** mọi số trên panel lấy từ API và khớp story bible; mọi dòng có chip nguồn.

### DEMO-10 `[UI/Frontend]` Màn 4 · Agent panel (scripted trước)
- **Việc:** chat UI: bubble câu hỏi, khối "N tool calls · read-only" hiện dần từng dòng, câu trả lời stream với chip `cite`; bấm cite → focus node tương ứng trên graph; nút "Xem khoanh vùng" và "Tạo nháp báo cáo"; chip gợi ý câu hỏi.
- **Hardcode:** v1 đọc kịch bản từ `fixtures/agent_clm0012.json` (tool calls + answer + delay), không gọi API.
- **DoD:** bấm chip câu hỏi → hiệu ứng tool call → trả lời đầy đủ trong ~15–25 s; cite click được.

### DEMO-11 `[UI/Frontend]` Trang nháp báo cáo RCA
- **Việc:** tab "Report · nháp" theo bố cục Report của bộ wireframe: tiêu đề, tóm tắt, chuỗi truy vết dạng chip, phạm vi ảnh hưởng 4 ô, nguyên nhân (giả thuyết chờ xác nhận), hành động đề xuất.
- **Hardcode:** nội dung sinh từ template + số liệu API; Export PDF / Send chỉ hiện toast.
- **DoD:** "Tạo nháp báo cáo" mở tab này; mọi câu có cite.

> **Mốc M1 · Dry-run #1** sau DEMO-01 → 11: chạy trọn kịch bản 4 màn với AI scripted.

### DEMO-12 `[Integration]` Agent Claude live qua tool
- **Việc:** endpoint `POST /agent/ask` (SSE): vòng tool-use Claude với 7 tool map vào DEMO-05; system prompt bắt buộc dẫn nguồn, chỉ dùng link confirmed/inferred làm bằng chứng, gợi ý bậc 5 chỉ là hướng kiểm tra; stream sự kiện `tool_call`/`text`/`cite` đúng format fixture của DEMO-10. Model: `claude-opus-5-5`, effort `low` cho tốc độ (env `AGENT_EFFORT`, nâng `medium` nếu chất lượng chưa đạt), bật server-side fallback khi bị refusal.
- **Hardcode:** context luôn là CLM-0012; giới hạn 10 tool call; không lưu lịch sử chat.
- **DoD:** câu hỏi chuẩn cho kết luận LOT-B + loại trừ 3 yếu tố + khoanh vùng đúng số trong 5/5 lần chạy; một câu hỏi ngoài kịch bản (vd "Machine 02 bảo trì lần cuối khi nào?") trả lời đúng có nguồn.

### DEMO-13 `[Integration]` DEMO_MODE fallback + record/replay
- **Việc:** ghi một lượt chạy live tốt thành fixture; `DEMO_MODE=replay|live|auto`; `auto` chuyển sang replay khi lỗi API hoặc quá 30 s; phím tắt ẩn cho người thuyết trình để ép replay.
- **DoD:** rút mạng giữa demo → câu trả lời vẫn ra, UI không khác biệt.

### DEMO-14 `[UI/Frontend]` Polish & điều khiển demo
- **Việc:** nút "Reset demo" (về màn 1, xoá chat), deep link mỗi bước (`/?step=2`), skeleton loading, transition highlight đường truy vết, kiểm tra 1280×800 và 1440×900.
- **DoD:** reset + chạy lại kịch bản 3 lần liên tiếp không lỗi console.

### DEMO-15 `[Demo Ops]` Kịch bản thuyết trình + dự phòng
- **Việc:** script nói theo 4 bước (≤ 7 phút), checklist trước giờ (seed, DEMO_MODE, độ phân giải, zoom), quay video backup toàn kịch bản.
- **DoD:** 2 lần dry-run có người ngoài đội xem; video backup lưu offline.

### Đợt 2 · Tương tác ngoài kịch bản (DEMO-16 → 24)

**Mục tiêu.** Người xem tự bấm và khám phá được, không chỉ đi đúng 4 bước:
- **Chế độ bình thường:** không tô màu; bấm node nào cũng ra tổng hợp tài liệu và thông số.
- **Chế độ truy lỗi:** dò đồ thị đơn giản. Đỏ = điểm lỗi + thượng nguồn; cam = hạ nguồn của node đỏ.
- **Thread thẳng** theo luồng vật tư ở mục 3.3.
- **Gắn tài liệu:** hệ thống "phân loại" rồi gắn vào node. Phân loại fix cứng, không viết logic thật.

Đợt 1 giữ nguyên: mọi test cũ (story consistency, API, agent, report) phải còn xanh.

### DEMO-16 `[Dummy Data]` Nạp flow bible (mục 3.3) vào dữ liệu
- **Việc:**
  - `story.yaml` thêm object `PO-4380`.
  - Thêm link `CLM-0012 raised_by CUS-C3`, `PO-4380 supplied_by SUP-S1`, `RCV-1410 received_under PO-4380`, `LOT-A received_under RCV-1410`, `M02 part_of LINE-1`.
  - Thêm `valid_from/valid_to` vào `evidence` của 2 link `fed_into` vào HOP-1.
  - Mỗi object không phải serial/box có `attributes.stage` ∈ `cung_ung|kho|san_xuat|logistics|khach_hang|hau_mai|dinh_kem`.
  - M02 thêm `cycle_target_s: 30`, `line: LINE-1`.
  - Module mới `onethread/flow.py`:
    - `FLOW_DIRECTION` (bảng hướng ở 3.3).
    - `flow_edges(conn, at: datetime | None) -> list[DirectedEdge{up, down, relation, link_id, shortcut: bool}]`: chỉ link confirmed/inferred, lọc theo hiệu lực tại `at`.
- **Hardcode:** stage gán tay trong YAML; không suy luận stage hay hướng.
- **DoD:**
  - Test mới: qua `flow_edges` tồn tại đúng đường 12 node của trục theo thứ tự 3.3.
  - `flow_edges(at=11-03 14:05:18)` không có `LOT-A→HOP-1`; `at=11-03 13:00` thì có.
  - Mọi object không phải serial/box đều có `stage`.
  - Test đợt 1 vẫn xanh.

### DEMO-17 `[Integration]` API thread thẳng `GET /api/flow/{id}`
- **Việc:**
  - `id` là serial, hoặc claim (quy về serial của claim qua `about`).
  - Trả `FlowGraph{root, spine: FlowNode[], branches: FlowNode[], edges: FlowEdge[], attachments: {node_id: Attachment[]}}`:
    - `FlowNode{id, type, name, stage, order, parent_id?}`
    - `FlowEdge{up, down, relation, tier, status, kind: spine|branch}`
    - `Attachment{id, kind: document|inspection|claim|event|alias, label, status, tier}`
  - Serial/box ngoài trục gộp thành `AGG-<lot>`.
  - **Không trả màu**: graph ở trạng thái bình thường.
- **Hardcode:** nhánh là mọi node luồng nối được vào trục sau khi gộp, sâu tối đa 4 bước; không phân trang.
- **DoD:**
  - `/api/flow/CLM-0012` và `/api/flow/MH20-0001` trả `spine` đúng 12 node theo thứ tự 3.3.
  - `branches` = {PO-4380, RCV-1410, LOT-A, AGG-LOT-B, SHP-1115, SHP-1120, SO-7790, CUS-C5}.
  - `attachments["LOT-B"]` chứa IQC-5531, D-07.
  - ID lạ → 404.

### DEMO-18 `[Integration]` Tổng hợp node `GET /api/objects/{id}/summary`
- **Việc:**
  - Trả `NodeSummary{id, type, name, stage, aliases, params: Param[], docs: DocView[], attachments, counts{links, events}}`.
  - `Param{label, value, unit?, source, source_record_id?}`: mỗi thông số có nguồn để làm chip `cite`.
  - Bộ thông số theo `type`:
    - **machine:** cycle TB theo lô ngày gần nhất có dữ liệu, mục tiêu, lực ép TB, bảo trì gần nhất, ca/vận hành, nhiệt độ line (min–max), số chu kỳ.
    - **hopper:** lịch sử nạp lô.
    - **lot:** số lượng, linh kiện, NCC, ngày nhập, Cpk + kết luận IQC, số part đã dùng.
    - **receipt / PO:** ngày, số lượng, NCC.
    - **supplier:** các lô/PO, claim liên quan.
    - **serial:** giờ ép, máy, lô, thùng, lô xuất, claim.
    - **shipment / SO / customer:** part, thùng, trạng thái, ngày, khách.
    - **claim:** triệu chứng, ngày nhận, serial, khách.
  - `docs` = tài liệu trong 1 bước, gồm cả tài liệu upload (DEMO-20).
- **Hardcode:** bộ thông số theo type viết tay trong code, tái dùng các hàm query đợt 1.
- **DoD:**
  - M02 trả cycle 31/42 s theo lô, mục tiêu 30, lực 12.4/13.1, PM-0241, NV-118, 26.2–26.9 °C.
  - LOT-B trả 5,000 · 10-28 · Cpk 0.92.
  - SUP-S1 có D-09, D-03, CLM-0009.
  - Test lặp: mọi node trong `/api/flow/MH20-0001` gọi summary không lỗi.
  - Mọi `Param` có `source`.

### DEMO-19 `[Integration]` Dò lỗi đồ thị đơn giản
- **Việc:**
  - Route `GET /api/fault-trace?origin=<id>&at=<iso>` và `GET /api/claims/{id}/fault-trace` (origin = serial của claim, `at` = giờ ép serial).
  - Thuật toán trên `flow_edges(at)`:
    1. Đỏ = origin ∪ mọi node thượng nguồn của origin (BFS ngược hướng luồng).
    2. Cam = mọi node hạ nguồn của bất kỳ node đỏ nào (BFS xuôi hướng luồng) mà chưa đỏ. Serial/box gộp như DEMO-17. Claim (chặng `hau_mai`) không tô.
  - Trả `{origin, at, red: [{id, reason}], orange: [{id, reason}]}`. `reason` ghi node đỏ gần nhất, ví dụ "thượng nguồn của MH20-0001 qua fed_into (ISS-1103, từ 13:52)", "hạ nguồn của LOT-B", "hạ nguồn của SUP-S1".
- **Hardcode:** không chấm điểm xác suất; link pending/suggested không tham gia; `at` mặc định cho node không phải serial = đồng hồ demo.
- **DoD:**
  - CLM-0012 đúng bảng "Kết quả dò lỗi mong đợi" ở 3.3 (7 đỏ, 12 cam).
  - `origin=M02&at=2026-11-03T13:00+07:00` → đỏ chứa LOT-A, RCV-1410, PO-4380, không chứa LOT-B; LOT-B là cam qua SUP-S1 → PO-4410 (kiểm tra cửa sổ hiệu lực).
  - origin lạ → 404.

### DEMO-20 `[Integration]` Gắn tài liệu (phân loại fix cứng)
- **Việc:**
  - `POST /api/documents` (multipart `file`, tuỳ chọn `target_hint`): lưu file vào `backend/var/uploads/` (gitignore), ghi `documents` + `links`, đặt `rule_version="demo-attach-v0"`.
  - Trả `{doc_id: "D-U01"…, type, method: code|rule|llm|manual, links: [{to_id, tier, status, score}], reason}`.
  - `POST /api/demo/reset` xoá mọi bản ghi `demo-attach-v0` và file upload.
  - Nạp lại `known_ids` của agent sau upload/reset để cite tài liệu mới bấm được.
  - **Đây là endpoint ghi duy nhất** của demo.
- **Hardcode:**
  - Catalog `data/attachments.yaml` + 3 file mẫu trong `data/attachments/`:

    | File | Loại | Cách | Gắn vào | Link |
    |---|---|---|---|---|
    | `CoA_S1-6203-B.pdf` | Chứng nhận chất lượng NCC | `code`: khớp alias S1-6203-B ≡ LOT-B | LOT-B | bậc 4 inferred 0.90 |
    | `BienBan_BaoTri_Press2_2026-11-05.pdf` | Biên bản bảo trì | `rule`: alias CMMS "Press 2" → M02 + từ khoá "bảo trì" | M02 | bậc 4 pending 0.75 |
    | `Email_CustomerC5_xac_nhan_nhan_hang.txt` | Thư khách hàng | `llm` (chỉ là nhãn, không gọi model) | SHP-1115 | bậc 5 suggested 0.60 |

  - Nội dung email trung tính: Customer C5 xác nhận đã nhận đủ 240 bơm của lô giao 2026-11-15, không nhắc tới lỗi. Mục đích là không làm lệch câu trả lời của agent.

  - File ngoài catalog: regex tìm ID đã biết trong tên file (và trong nội dung nếu là `.txt`) → `code`, link bậc 4 inferred 0.90. Không khớp → gắn vào `target_hint`, `manual`, bậc 4 pending.
- **DoD:**
  - Upload 3 file mẫu → doc + link đúng bảng; doc mới hiện trong `/api/objects/{id}/docs` và summary.
  - Reset → biến mất, story consistency vẫn xanh.
  - File > 10 MB → 413; đuôi ngoài `pdf|txt|png|jpg|docx` → 415.

### DEMO-21 `[UI/Frontend]` Thread thẳng + công tắc Bình thường / Truy lỗi
- **Việc:**
  - Thay `LAYOUT` toạ độ cứng bằng layout tính từ `/api/flow`:
    - trục một hàng theo `order`, nền 6 dải chặng có nhãn;
    - nhánh ở hàng dưới node cha;
    - badge "N đính kèm" dưới node.
  - Công tắc "Truy lỗi" trên toolbar: mở từ claim thì bật; tắt thì về chế độ bình thường (node trung tính, cạnh xám giữ kiểu nét theo trạng thái).
  - Cite click → focus node vẫn chạy.
- **Hardcode:** kích thước node cố định, không kéo thả, fitView; zoom < 0.75 thì cho cuộn ngang trong vùng graph.
- **DoD:**
  - Trục 12 node đúng thứ tự trên một hàng ở 1440×900 và 1280×800.
  - Chế độ bình thường không có node đỏ/cam/amber (test theo class).
  - Test ThreadGraph cũ cập nhật theo layout mới.

### DEMO-22 `[UI/Frontend]` Panel tổng quan node
- **Việc:**
  - Bấm node bất kỳ, ở cả hai chế độ, → evidence panel có tab đầu "Tổng quan · <ID>" từ `/summary`:
    - bảng thông số, mỗi dòng có chip nguồn;
    - tài liệu có badge trạng thái, đính kèm;
    - nút "Đặt làm điểm lỗi" và "Gắn tài liệu".
  - Ở chế độ truy lỗi, M02 / LOT-B / IQC-5531 vẫn mở thêm các tab chuyên sâu của đợt 1.
- **DoD:** bấm lần lượt mọi node trục + nhánh đều ra nội dung, không node nào "chết"; node chưa có tài liệu hiện "Chưa có tài liệu · Gắn tài liệu".

### DEMO-23 `[UI/Frontend]` Tô màu dò lỗi
- **Việc:**
  - Bật truy lỗi → gọi `/api/claims/{id}/fault-trace`. Node đỏ nền `--red-bg` viền `--red`; cam nền `--amber-bg` viền `--amber`; cạnh giữa hai node đỏ tô đỏ đậm.
  - Hover node hiện `reason`; legend "Đỏ: điểm lỗi và thượng nguồn · Cam: hạ nguồn có thể bị ảnh hưởng".
  - "Đặt làm điểm lỗi" → gọi `fault-trace?origin=&at=<As-of>`; nút "Về điểm lỗi của claim".
  - Bỏ `tone` cứng (focus/bad/suspect) của đợt 1, màu chỉ lấy từ API.
- **DoD:** CLM-0012 hiện đúng 7 đỏ / 12 cam như 3.3; đổi điểm lỗi cập nhật màu < 500 ms, không reload trang.

### DEMO-24 `[UI/Frontend]` Gắn tài liệu
- **Việc:**
  - Dialog kéo thả / chọn file + 3 nút "file mẫu", gửi kèm `target_hint` = node đang chọn.
  - Thẻ kết quả: loại tài liệu, chip cách phân loại (Mã / Quy tắc / LLM / Thủ công), node được gắn, trạng thái + điểm.
  - Graph: badge của node tăng, nhấp nháy 1.2 s. Panel tổng quan hiện tài liệu với badge "mới".
  - "Reset demo" (DEMO-14) gọi thêm `/api/demo/reset`.
- **DoD:** 3 file mẫu gắn đúng LOT-B, M02, SHP-1115 theo bảng DEMO-20; reset → badge về số cũ; không lỗi console.

## 5. Thứ tự ưu tiên

```
Ngày 1   DEMO-01 → DEMO-02 → DEMO-03 → DEMO-04     (data đúng trước mọi thứ)
         DEMO-06 song song (chỉ cần mockup)
Ngày 2   DEMO-05  ║  DEMO-07, DEMO-08
Ngày 3   DEMO-09, DEMO-10, DEMO-11                  → M1 DRY-RUN #1 (AI scripted)
Ngày 4   DEMO-12 → DEMO-13                          → Dry-run #2 (AI live + fallback)
Ngày 5   DEMO-14, DEMO-15                           → Tổng duyệt
```

Lý do: data + test nhất quán khoá câu chuyện sớm, mọi màn sau chỉ đọc lại số liệu này. AI scripted (DEMO-10) cho phép tổng duyệt toàn luồng trước khi phụ thuộc Claude live. DEMO-12/13 là phần rủi ro nhất nhưng đã có lưới an toàn.

Với 2 người: một người Data/API (01–05, 12–13), một người UI (06–11, 14); DEMO-15 làm chung.

**Đợt 2** chen trước DEMO-14/15, vì deep link và kịch bản thuyết trình phụ thuộc màn mới:

```
DEMO-16 (flow bible vào dữ liệu)
  → DEMO-17, DEMO-18, DEMO-19, DEMO-20      (BE, song song)
  → DEMO-21 → DEMO-22, DEMO-23, DEMO-24     (FE; 21 trước vì đổi layout)
  → DEMO-14 (thêm deep link `mode=normal|fault`, reset gọi /api/demo/reset)
  → DEMO-15 (thêm phần "khám phá tự do" + gắn tài liệu vào kịch bản nói)
```
