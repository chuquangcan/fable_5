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
| Khoanh vùng | 1,000 part dùng LOT-B · 42 thùng · `SHP-1112` C3 400 pcs/17 thùng giao 11-12 · `SHP-1115` C5 240/10 giao 11-15 · `SHP-1120` 360/15 trong kho |
| Claim | `CLM-0012` nhận 2027-02-10 · `CLM-0011` (rò nước, nhiễu) · `CLM-0009` 09/2026 tiếng ồn 6203, đã đóng bằng tăng lấy mẫu IQC n=5 → 20 |
| Tài liệu | `D-12` bản vẽ MH-20 p.7 (bậc 4 confirmed) · `D-09` 8D CLM-0009 (bậc 4 confirmed) · `D-07` biên bản họp 10-29 "lô B hơi rơ" (bậc 4 chờ duyệt 0.78) · `D-03` báo cáo lỗi 2025 "tiếng ồn ổ bi" (bậc 5 gợi ý) |

### 3.2 Cách tạo
- **Viết tay (~30 object)**: `data/story.yaml` chứa mọi object, alias, link, tài liệu (text chunk ngắn) và time mapping ở bảng trên.
- **Sinh bằng script, seed cố định**: 1,000 serial (MH20-0001…1000) + link `processed_on`/`packed_in`/`shipped_in`; 42 thùng; event cycle Machine 02 ngày 11-03 12:00–16:00 (~400 event, nhiễu nhỏ quanh 31/42 s); event bảo trì/ca/nhiệt độ; vài serial LOT-A ngày 11-02 làm đối chứng.
- **Schema**: đúng 6 bảng của tài liệu: `objects`, `aliases`, `events`, `documents`, `links`, `time_mappings`.
- **Chốt nhất quán**: `test_story_consistency.py` truy vấn DB và assert mọi con số ở 3.1.

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
- **Việc:** endpoint `POST /agent/ask` (SSE): vòng tool-use Claude với 7 tool map vào DEMO-05; system prompt bắt buộc dẫn nguồn, chỉ dùng link confirmed/inferred làm bằng chứng, gợi ý bậc 5 chỉ là hướng kiểm tra; stream sự kiện `tool_call`/`text`/`cite` đúng format fixture của DEMO-10. Model: `claude-sonnet-5-5` cho tốc độ (đổi `claude-opus-5-5` nếu chất lượng chưa đạt).
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
