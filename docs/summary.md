# One Thread demo — tóm tắt trạng thái hiện tại

Cập nhật: 2026-11-11 · nhánh `feat/one-thread-demo` · plan: `docs/superpowers/plans/2026-11-11-one-thread-demo.md`

## 1. Tiến độ

| Task | Nội dung | Trạng thái |
|------|----------|-----------|
| 1–5 | Scaffold, story bible + schema, seed/generator, test nhất quán, Read API | Xong |
| 6–9 | App shell, Claims inbox, Thread graph, Evidence panel | Xong |
| 10 | Agent panel (scripted) | Xong |
| 11 | Trang nháp báo cáo RCA | Xong |
| 12 | Agent live qua tool (backend) | Xong — đã chạy thật với DeepSeek flash; **chưa thử với Claude** (chưa có key) |
| 13 | `DEMO_MODE` fallback + record/replay | Xong |
| 12b | Chọn provider theo key (Claude hoặc DeepSeek flash) + đọc `.env` | Xong |
| 14 | Deep link `?step=`, nút Reset, skeleton loading | **Chưa làm** |
| 15 | Kịch bản thuyết trình + checklist (`docs/demo/`) | **Chưa làm** |

Test: backend 101 pytest, frontend 35 vitest, `tsc -b` sạch.

## 2. Kiến trúc pipeline

```
data/story.yaml ──► seed (generator, seed cố định) ──► PostgreSQL (6 bảng: objects, aliases,
                                                        events, documents, links, time_mappings)
                                                               │
                                          queries/* (hàm đọc, chỉ đọc)
                                          │                         │
                                   FastAPI REST /api/*        Agent tools (7 tool)
                                          │                         │
                                          │               run_agent (vòng tool-use thủ công)
                                          │                         │ turn = ClaudeTurn | DeepSeekTurn (chọn theo API key)
                                          │                         │ CiteParser tách [[cite:ID]]
                                          │               agent_event_stream (live / replay / auto)
                                          │                         │ SSE /api/agent/ask
                                          ▼                         ▼
                                  React + React Flow (Vite, proxy /api → :8000)
                       Claims inbox → Thread lanes → Evidence panel → Agent panel → Report
```

- **Chỉ đọc**: API không có endpoint ghi; nút Duyệt/Export/Send chỉ hiện toast.
- **Đồng hồ demo cố định** `2027-02-12 09:00`, giờ hiển thị luôn UTC+7, không phụ thuộc múi giờ máy.
- **Câu chuyện**: claim `CLM-0012` (bơm MH-20 kêu to) → serial `MH20-0001` → Machine 02 → `LOT-B` (Bearing 6203, Cpk 0.92) → PO-4410 / Supplier S1; 1,000 part, 42 thùng, 3 shipment (640 đã giao, 360 còn trong kho).

## 3. Yêu cầu môi trường

- Docker (Postgres 16), Python ≥ 3.13 + `uv`, Node 22 + npm.
- Cài phụ thuộc lần đầu: `cd backend && uv sync` · `cd frontend && npm install`.

## 4. Lệnh chạy (từ thư mục gốc repo)

| Lệnh | Việc làm |
|------|----------|
| `make db` | `docker compose up -d --wait db` — Postgres cổng **5433** (user/pass/db `onethread`; init script tạo thêm DB `onethread_test`) |
| `make seed` | Bật DB rồi nạp dữ liệu: `uv run python -m onethread.seed` (xoá và tạo lại schema, idempotent, < 10 s) |
| `make api` | `uvicorn onethread.api:app --port 8000 --reload` |
| `make web` | Vite dev server cổng **5173** (`--strictPort`), proxy `/api` → `http://localhost:8000` |
| `make demo` | `db` → `seed` → chạy `api` và `web` song song (Ctrl-C dừng cả hai). Mở http://localhost:5173 |
| `make test` | `pytest` (backend) rồi `vitest run` (frontend) |
| `make record-agent` | Chạy agent live với Claude, ghi đè `frontend/public/fixtures/agent_clm0012.json` (cần `ANTHROPIC_API_KEY`). Chỉ ghi khi lượt chạy kết thúc bằng `done` và không có `error`; xem lại nội dung rồi mới commit |

Lệnh lẻ hữu ích:

```bash
cd backend  && uv run pytest -q                       # test backend
cd backend  && uv run pytest tests/test_agent_stream.py -v
cd frontend && npx vitest run                         # test frontend
cd frontend && npx tsc -b                             # kiểm tra kiểu
cd backend  && uv run python -m onethread.agent.replay record [out_path]   # = make record-agent
```

## 5. Tham số cấu hình (biến môi trường)

> **`.env`:** backend tự đọc file `.env` ở **thư mục gốc repo** khi khởi động (`python-dotenv`, không ghi đè biến đã có trong môi trường). Đổi `.env` thì phải restart API (`make api` có `--reload` nhưng chỉ theo dõi file `.py`). Biến đặt trước lệnh vẫn thắng file, ví dụ `DEMO_MODE=replay make api`. Giá trị rỗng (`ANTHROPIC_API_KEY=`) coi như chưa đặt.

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `DATABASE_URL` | `postgresql://onethread:onethread@localhost:5433/onethread` | DB cho API và seed |
| `TEST_DATABASE_URL` | `postgresql://onethread:onethread@localhost:5433/onethread_test` | DB cho pytest (test sẽ drop/tạo lại schema ở đây) |
| `DEMO_MODE` | `auto` | Chế độ agent, xem mục 6 |
| `AGENT_EFFORT` | `low` | `output_config.effort` gửi cho **Claude** (`low`/`medium`/… — nâng lên `medium` nếu câu trả lời chưa đủ ý). DeepSeek bỏ qua biến này |
| `AGENT_TIMEOUT_S` | `30` | Giới hạn thời gian cả lượt live ở chế độ `auto` (DeepSeek flash chạy ~8–10 s) |
| `AGENT_PROVIDER` | `auto` | `auto`: có `ANTHROPIC_API_KEY` thì dùng Claude, không thì dùng DeepSeek nếu có `DEEPSEEK_API_KEY` (cả hai đều có ⇒ Claude). `anthropic` / `deepseek`: ép dùng một bên, thiếu khoá tương ứng ⇒ lỗi. Giá trị khác ⇒ lỗi |
| `ANTHROPIC_API_KEY` | (trống) | Khoá Claude (model `claude-opus-5-5`) |
| `DEEPSEEK_API_KEY` | (trống) | Khoá DeepSeek — luôn dùng model **`deepseek-flash`** (cố định trong code, không đổi được qua env) |
| `ANTHROPIC_BASE_URL` | (mặc định SDK) | Dùng để giả lập mất mạng khi thử fallback, ví dụ `http://127.0.0.1:9` |
| `VITE_AGENT_SOURCE` | `server` trong `frontend/.env.development`; vắng mặt ⇒ `scripted` | Nguồn dữ liệu cho Agent panel phía web (mục 6) |

Giá trị cố định trong code: Claude model `claude-opus-5-5` (`config.py`), DeepSeek `deepseek-flash` qua `https://api.deepseek.com` (OpenAI-format, `thinking` tắt, `max_tokens=8000`, `temperature=0.2`) (`agent/deepseek.py`), `replay_fixture = ../frontend/public/fixtures/agent_clm0012.json`. Agent gửi `betas=["server-side-fallback-2026-07-01"]` + `fallbacks="default"`, không gửi `thinking`, `max_tokens=16000`, tối đa 14 tool call mỗi câu hỏi.

## 6. Các chế độ có thể tuỳ chỉnh

### `DEMO_MODE` (backend, hoặc `?mode=` trên từng request)

| Mode | Hành vi |
|------|---------|
| `live` | Chỉ gọi Claude. Lỗi ⇒ event `error`, không fallback. Không cần fixture |
| `replay` | Chỉ phát lại fixture đã ghi (mỗi khoảng chờ tối đa 400 ms), không gọi Claude/không tốn API |
| `auto` (mặc định) | Chạy live; nếu Claude lỗi / mất mạng / thiếu khoá / quá `AGENT_TIMEOUT_S` / trả `error` ⇒ gửi `reset` (client xoá câu trả lời dở dang) rồi phát toàn bộ replay |

Ví dụ: `DEMO_MODE=replay make api`, hoặc `curl -N "localhost:8000/api/agent/ask?q=...&claim=CLM-0012&mode=live"`. Giá trị `mode` không hợp lệ ⇒ HTTP 422; claim không tồn tại ⇒ 404.

### Provider (Claude / DeepSeek)

- Chọn theo key có trong `.env` (xem `AGENT_PROVIDER` ở trên). Hiện `.env` chỉ có `DEEPSEEK_API_KEY` ⇒ live dùng DeepSeek flash.
- Kiểm tra nhanh provider đang dùng: `curl localhost:8000/api/agent/provider` → `{"provider":"deepseek","model":"deepseek-flash","mode":"auto"}` (`provider: null` ⇒ chưa có key, chế độ `auto` sẽ replay, `live` báo lỗi).
- Cả hai provider dùng chung vòng lặp, 7 tool, prompt và cách dẫn nguồn `[[cite:ID]]`; `DeepSeekTurn` chỉ đổi định dạng ở rìa. Với DeepSeek, câu dẫn trước khi gọi tool (“I'll start by…”) bị bỏ, và câu trả lời cuối hiện ra một lần sau khi model viết xong (không gõ dần như Claude).
- `make record-agent` cũng dùng provider theo key (ghi fixture bằng DeepSeek nếu chỉ có DeepSeek).

### Nguồn Agent phía web (`VITE_AGENT_SOURCE`)

- `server` (mặc định khi chạy `make web`): stream SSE từ `/api/agent/ask`, claim lấy từ claim đang mở.
- Bất kỳ giá trị khác / không đặt: phát kịch bản có sẵn từ `public/fixtures/agent_clm0012.json` ngay trên trình duyệt (không cần backend agent). Vitest không đọc `.env.development` nên test luôn dùng bản scripted.

### Phím tắt trình chiếu

- **`Alt+Shift+D`**: bật/tắt ép `mode=replay` cho các câu hỏi tiếp theo (chấm amber cạnh chữ "Agent" khi đang bật). Dùng khi mạng hội trường chập chờn.

### Trong Agent panel

- Nút **/report** hoặc **Send** với ô trống ⇒ hỏi câu mặc định: *"Vì sao MH20-0001 của CLM-0012 kêu to? Tìm nguyên nhân gốc và phạm vi ảnh hưởng."*
- Hỏi lại khi đang stream ⇒ stream cũ bị huỷ, không xen kẽ câu trả lời.
- Chip cite có ID tồn tại trong DB bấm được (focus node + đổi tab bằng chứng); ID không có ⇒ chip tĩnh.

## 7. API (tiền tố `/api`, chỉ GET)

`/health` · `/claims` · `/claims/{id}` · `/trace/{serial}` · `/objects/{id}/events?start&end&type&limit` · `/objects/{id}/links?status=` · `/objects/{id}/docs?at` · `/metrics/{cpk|cycle_time}?objects=` · `/compare/{machine}?day=` · `/impact/{lot}` · `/reports/{claim_id}/draft` · `/agent/ask?q&claim&mode` (SSE) · `/agent/provider`.

ID không tồn tại ⇒ 404 `{"detail": "<kind> <id> not found"}`.

Agent có 7 tool, dùng chung hàm query với API: `trace_serial`, `get_events`, `get_links`, `get_docs`, `metrics`, `run_python` (chỉ `compare_by_lot`), `trace_forward`. Danh sách trả về cắt ≤ 200 phần tử.

Định dạng event SSE (mỗi dòng `data: <json>`): `tool_call`, `text`, `cite`, `action` (`open_impact` | `open_report`), `reset`, `done{elapsed_s}`, `error`.

## 8. Giới hạn hiện tại / việc còn lại

- **Claude chưa chạy thật** (chưa có `ANTHROPIC_API_KEY`); chỉ có test với mock. **DeepSeek flash đã chạy thật 5/5 lần** (~8 s/lượt): đều ra LOT-B, Cpk 0,92, loại trừ PM-0241 + nhiệt độ; số 1,000 / 42 thùng / ca NV-118 không phải lần nào cũng được nhắc đủ. Thỉnh thoảng model dẫn nhầm nguồn (ví dụ Cpk dẫn `[[D-12]]`) hoặc dẫn ID bản ghi chu kỳ (`PLC2-000001`, chip không bấm được). Chưa thử câu ngoài kịch bản ("Machine 02 bảo trì lần cuối khi nào?").
- **Fixture replay là bản dựng tay** (Task 10), chưa quay lại từ LLM thật. Nên giữ bản dựng tay (đầy đủ ý, cite chuẩn) làm dự phòng; nếu muốn bản quay thật: `make record-agent`, đọc lại nội dung rồi mới commit.
- **Task 14/15 chưa làm**: chưa có deep link `?step=1..4`, nút Reset demo, skeleton loading, `docs/demo/script.md`, `docs/demo/checklist.md`, video backup.
- Dev server `uvicorn` (`make api`) có `--reload`; nếu bạn chạy nó bằng lệnh khác không có `--reload`, cần restart để thấy route mới.
- Chưa chạy review toàn nhánh (final review của quy trình executing-plans).
- File chưa track của riêng bạn (`main.py`, `pyproject.toml` gốc, `uv.lock`, `.python-version`, ảnh/PDF trong `docs/`) không bị động tới.
