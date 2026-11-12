# One Thread · Đợt 4: workspace kiểu VS Code, plant twin, feed thông báo

- Ngày: 2026-11-12 · nguồn yêu cầu: `One_Thread_demo_UI_spec.txt`
- Tiếp theo: `2026-11-11-one-thread-phase3.md`
- Ngôn ngữ UI: **tiếng Anh** (bản dịch đã commit ở `d299fbb`). Nhãn tiếng Việt trong yêu cầu được dịch sang tiếng Anh, ví dụ "Tổng quan nhà máy" → "Plant overview", "Thông báo và thay đổi" → "Notifications & changes".
- Giữ nguyên: stack (React 19, zustand, @xyflow/react, FastAPI, Postgres seed từ `data/story.yaml`), `tokens.css`, câu chuyện ổ bi (CLM-0012, LOT-B, M02, HOP-1). EvidencePanel, ThreadView, ThreadGraph, ReportView, phần thân DocDrawer, luồng duyệt và agent được giữ lại và chuyển vào shell mới.

## 0. Xung đột với code hiện tại và cách xử lý

| # | Yêu cầu | Thực tế trong code | Xử lý |
|---|---|---|---|
| 1 | Giữ nhãn tiếng Việt | Working tree đã dịch toàn bộ sang tiếng Anh | Giữ tiếng Anh (quyết định của chủ dự án) |
| 2 | Sinh cycle M01/M03, thêm line 2, giữ `test_story_consistency` xanh | Test kiểm tra toàn cục: 42 thùng `packed_in`, 1.000 serial dùng LOT-B, chỉ một event `lot_loaded` | Line 2 chỉ có event, không tạo serial hay thùng mới; lô của line 2 nối bằng link `fed_into`, không sinh event `lot_loaded` |
| 3 | Bỏ `TRACEABLE` | Chỉ CLM-0012 có object serial (MH20-2457 của CLM-0011 không có object) | Bỏ giới hạn và mở theo điều kiện "serial có trong dữ liệu"; trên dữ liệu hiện tại vẫn chỉ CLM-0012 mở được |
| 4 | Search phải trả về serial | Đã trả về, nhưng serial bị xếp cuối, sau tài liệu, trong giới hạn 20 kết quả | Đổi thứ tự xếp: object khớp tiền tố trước, rồi tới object khác, tài liệu xếp sau |
| 5 | Ánh xạ source → phòng ban | Thiếu `HR` và `ENV-L1`; stage `dinh_kem` gom nhiều loại object; "Họp" không có trong danh sách phòng ban | Xem §2.2 |
| 6 | As-of mặc định 2026-11-03 14:05 | Header đang hiển thị `DEMO_NOW` = 2027-02-12; CLM-0012 nằm sau as-of | Feed không lọc theo as-of; bấm card thì đổi as-of; header hiển thị as-of |
| 7 | Giữ câu "read-only" trên status line | Status line chưa có câu này | Thêm `DEMO · sample data · read-only` |
| 8 | Gửi claim của product tab cho agent | Replay chỉ có fixture CLM-0012 | Chấp nhận được, vì chỉ CLM-0012 mở được |
| 9 | Danh sách kind có 9 loại | Tab chi tiết card feed không vừa với kind nào | Thêm kind thứ 10 là `feed` |

## 1. Chia đợt

| Đợt | Nội dung | Kết thúc khi |
|---|---|---|
| A | Seed, phòng ban, `notices`, `/api/feed`, `/api/plant/state`, `/api/plant/overview`, xếp hạng search | pytest xanh, commit |
| B | Workspace store, TabBar, Workspace/Dock/Resizer, product tab theo serial, đổi rail trái, `goTo`, `applyStep`, lưu trạng thái | vitest + lint + build xanh, commit |
| C | TwinView, DeptStrip, Feed, PlantOverview, DataSources, FeedDetail, CycleChart có dải lô và marker, agent context | `make test` + lint + build xanh, chạy app ở 1440×900, commit |

## 2. Dữ liệu và backend (đợt A)

### 2.1 Seed

`story.yaml` thêm:

- `LINE-2` (`product: MH-25`), `HOP-2`, `LOT-C` (part `BRG-6204`, qty 4000, stage kho), `BRG-6204`.
- Thuộc tính `line`, `product`, `cycle_target_s` cho máy và line: `LINE-1` có `product: MH-20`; M01 có `cycle_target_s: 32`; M03 có `cycle_target_s: 29`.
- Link (tier 1, confirmed):
  - `M01 → LINE-2 part_of`, `M03 → LINE-2 part_of`, `HOP-1 → LINE-1 part_of`, `HOP-2 → LINE-2 part_of`
  - `HOP-2 → M01 fed_into`, `HOP-2 → M03 fed_into`
  - `LOT-C → HOP-2 fed_into` (evidence `valid_from 2026-11-03T08:00`)
- `volume.extra_machines`: M01 (LOT-C, 33 s), M03 (LOT-C, 29.5 s); chạy từ 08:00 đến 20:00 ngày 2026-11-03, nhiễu ±0.8 s.

`generate.py` sinh press cycle cho M01/M03 với `object_ids=[machine]` (không có serial), source `PLC1`/`PLC3`, đánh số event riêng (`EV-PLC1-…`, `EV-PLC3-…`). M02 và LOT-B giữ nguyên.

Line 2 không có đường nối nào tới LOT-B, HOP-1 hay M02, nên fault-trace và impact của CLM-0012 không đổi.

### 2.2 Phòng ban: `backend/onethread/departments.py`, đồng bộ sang `frontend/src/lib/labels.ts`

```
DEPARTMENTS = purchasing, quality, production, warehouse, logistics, design, maintenance
STAGE_DEPT  = cung_ung→purchasing, kho→warehouse, san_xuat→production, dinh_kem→quality,
              logistics→logistics, khach_hang→logistics, hau_mai→quality
SOURCE_DEPT = ERP→purchasing, WMS→warehouse, QMS→quality, PLM→design, CMMS→maintenance,
              PLC1/PLC2/PLC3/MES/ENV-L1/HR→production, Meeting→meeting
CHANNELS    = purchasing·ERP, quality·QMS, design·PLM, warehouse·WMS, maintenance·CMMS, logistics, meeting
```

`meeting` là kênh gửi, không phải phòng ban phải xử lý. Pill bên gửi hiển thị "Meeting". Nhãn tiếng Anh nằm trong `deptLabel` (`labels.ts`). Không component nào được tự định nghĩa ánh xạ riêng.

### 2.3 Bảng `notices` (`schema.sql`) và mục `notices:` trong story

Cột: `notice_id, kind (alert|4m_change), severity (P1|P2|P3|null), category (Man|Machine|Material|Method|null), title, reason, source, acting text[], object_ids text[], status (proposed|watching|approved|closed), at timestamptz`.

| id | kind | at | source → bên gửi | cần xử lý | object | status |
|---|---|---|---|---|---|---|
| 4M-0001 | 4m_change Material | 2026-10-28 15:00 | QMS → quality | purchasing, production | LOT-B, IQC-5531, SUP-S1 | watching |
| 4M-0002 | 4m_change Material | 2026-11-03 13:52 | WMS → warehouse | production, quality | HOP-1, LOT-B, M02 | watching |
| AL-0001 | alert P1 | 2026-11-03 14:00 | PLC2 → production | quality, maintenance | M02, LINE-1, LOT-B | watching |

Tiêu đề và lý do lấy từ câu chuyện: Cpk 0.92 < 1.33; ISS-1103 đổi từ LOT-A sang LOT-B; cycle 31 s → 42 s, mục tiêu 30 s.

### 2.4 `GET /api/feed` (`queries/feed.py`)

`FeedItem { id, kind: alert|4m|doc|link|claim, badge: P1|P2|P3|4M|DOC|LINK|CLAIM, at, title, reason, sender, acting[], objects[], status, ref: {doc_id?, link_id?, claim_id?} }`, sắp xếp theo `at` giảm dần.

| Nguồn | badge | at | sender | acting | objects | status |
|---|---|---|---|---|---|---|
| notices | severity hoặc 4M | at | SOURCE_DEPT[source] | acting | object_ids | status |
| documents (gồm file upload) | DOC | effective_from hoặc uploaded_at | SOURCE_DEPT[source] | phòng ban theo stage của object được link | object được link | approved nếu mọi link confirmed, ngược lại proposed |
| review queue | LINK | created/effective time của tài liệu | SOURCE_DEPT của tài liệu | quality | from/to | proposed |
| claims | CLAIM | received | quality | quality, logistics | claim, serial | open → watching, closed → closed |

### 2.5 `GET /api/plant/state?at=` (`queries/plant_state.py`)

Trả `{ at, nodes: { [id]: { state, value, sub? } } }`.

- **Máy:** `running` nếu có press cycle trong 5 phút trước `at`, ngược lại `stopped`. Chuyển `warning` nếu có alert chưa đóng chạm tới máy với `at_notice ≤ at`; chuyển `watch4m` nếu có 4M đang theo dõi chạm tới máy. Value = `"{cycle trung bình 20 cycle gần nhất} s / {target} s"`.
- **Lot:** value = `qty − số cycle đã dùng lot đến lúc at` (theo `payload.lot`). State `watch4m` nếu có 4M chạm tới lot.
- **Hopper:** value = lô đang nạp lúc `at` (link `fed_into` còn hiệu lực).
- **Line:** `{ product, output (cycle trong ngày), cycle }`.
- **Shipment:** value = `"{status} · {date}"`.
- **Receipt/IQC:** value = ngày hoặc Cpk.

### 2.6 `GET /api/plant/overview?at=`

- `kpis`: output trong ngày; cycle trung bình so với mục tiêu (trung bình có trọng số); số alert đang mở; số 4M đang theo dõi; số link chờ duyệt.
- `rows`: mỗi line một dòng, sau đó các máy của line: `{ id, kind, name, line, state, cycle, target, output, lot, trend: number[30] }`.
- `shipments`: `{ id, status, date, customer, parts, risk: high|none, reason }`. Risk là `high` khi shipment chứa serial dùng lô có IQC Cpk < spec_min.

### 2.7 Search

`ORDER BY (object_id ILIKE q%) DESC, kind object trước document, object_id`, giữ giới hạn 20. Gõ "0457" phải tìm ra `MH20-0457`.

## 3. Workspace (đợt B)

### 3.1 Kiểu dữ liệu

```ts
type TabKind = 'twin'|'thread'|'claim'|'report'|'doc'|'object'|'overview'|'review'|'table'|'feed'
interface Tab { id: string; kind: TabKind; target: string; title: string; pinned: boolean; preview: boolean }
type GroupId = 'main' | 'bottom' | 'bottom2'
interface Group { tabs: Tab[]; active: string | null }
interface ProductTab { root: string; claimId: string|null; threadIds: string[]; focusNodeId: string|null;
                       mode: 'normal'|'fault'; faultOrigin: string|null; evidenceTab: EvidenceTab }
```

Id tab: `twin`, `thread:<serial>`, `report:<claim>`, `claim:<claim>`, `doc:<D-id>`, `object:<id>`, `overview`, `review`, `table:sources`, `table:<db table>`, `feed:<item id>`, `detail:<thread tab id>`.

### 3.2 State và action chính

- `groups`, `product: Record<tabId, ProductTab>`, `twin: { selected, evidenceTab }`, `objectEvidence: Record<tabId, EvidenceTab>`.
- `dockActive: Record<mainTabId, bottomTabId>`: khi main tab đổi, dock khôi phục tab dưới đã mở cho main tab đó.
- `layout: { leftRail: 'feed'|'assets'|'data', leftW, agentW, dockH, dockCollapsed, split }`.
- `asOf` (mặc định `2026-11-03T14:05:00+07:00`), `feed: { selected, kindFilter, deptFilter, read: string[] }`, `hoverIds`, `reach: { red: string[], orange: string[] }`.
- `openTab(group, tab, { preview?, activate? })`: nếu id đã có thì focus. Nếu mở dạng preview thì thay tab preview cũ của group. Nếu mở tab cố định trùng id với tab preview thì bỏ trạng thái preview.
- `keepTab(group, id)` (double-click hoặc ghim), `closeTab(group, id)` (tab ghim không đóng được; khi đóng tab đang mở thì kích hoạt tab bên phải hoặc bên trái; nếu `bottom2` hết tab thì gộp lại), `moveTab(group, from, to)`, `splitDock()`.
- `openProduct(serial, { claimId?, fault? })`: tạo `thread:<serial>` nếu chưa có, đặt làm main tab đang mở, mở tab `detail:` ở dock.
- `openClaim(id)` = `openProduct(serialOfClaim, { claimId: id, fault: true })`, trong đó serial lấy từ `/api/claims`. Trong `applyStep`, serial của CLM-0012 dùng hằng số trong `lib/story.ts`.
- Mọi action thread nhận `tabId`: `focusNode`, `selectNode`, `setMode`, `setFaultOrigin`, `setEvidence`, `setThreadIds`, `setRoot`.
- `goTo(id)`:

| id | Kết quả |
|---|---|
| `D-*` | Tab `doc:` ở main |
| serial (`MH20-*`) hoặc box (`BOX-*`) | `openProduct` (box: serial đầu tiên của box, lấy qua `/api/objects/{box}/links`) |
| `CLM-*` | `openClaim` |
| khác | Tab `object:` dạng preview ở dock. Nếu main tab đang mở là twin thì chọn node đó; nếu là product tab có id trong `threadIds` thì focus node đó |

- `applyStep(1..4, mode?)`:
  - 1: reset, chỉ twin, rail trái là feed.
  - 2: thêm `openClaim('CLM-0012')`.
  - 3: thêm focus LOT-B, sub-tab `lot`.
  - 4: thêm câu hỏi cho agent.
  - `mode` ghi đè fault mode của product tab.
- Lưu trạng thái: `persist` (localStorage, bọc try/catch) cho `groups`, `product`, `dockActive`, `layout`, `feed.read`. Khi có deep link thì bỏ qua state đã lưu.
- `reset()` đưa về trạng thái của bước 1.

### 3.3 Shell

- **Bố cục:** Header 32 px | thân: ActivityBar 48 · rail trái (`leftW`, 200–480) · Resizer · Workspace · Resizer · rail Agent (`agentW`, 280–560) | StatusBar.
- **Workspace:** TabBar main + nội dung main | Resizer ngang (kéo, double-click để thu gọn hoặc khôi phục) | dock: TabBar bottom (nút ⊟ thu gọn, ◫ tách) + nội dung, có thể chia đôi `bottom` / `bottom2`.
- **TabBar:** `role=tablist`; tiêu đề; ✕ (ẩn với tab ghim); middle-click đóng (`onAuxClick` với nút 1); kéo thả HTML5 để sắp lại thứ tự; tab đang mở có gạch chân; tab preview chữ nghiêng; double-click giữ tab lại.
- **Nội dung main theo kind:**
  - `twin` → TwinView
  - `thread` → ThreadView `tabId`
  - `claim` → OverviewTab
  - `report` → ReportView `claimId`
  - `doc` → DocBody
  - `table` → bảng của DataView
- **Nội dung dock theo kind:**
  - `overview` → PlantOverview
  - `table:sources` → DataSources
  - `review` → ReviewQueueList
  - `object` → EvidencePanel `owner`
  - `detail:` → EvidencePanel của node đang focus (hoặc root) trong product tab đó
  - `feed` → FeedDetail
- **ActivityBar:** Notifications (badge số chưa đọc) / Assets / Data repository chỉ đổi rail trái; Report mở `report:<claim>` khi product tab đang mở có claim; ✦ bật/tắt Agent.
- **Header:** search (`Ctrl K`, chọn serial thì mở product tab) và as-of `YYYY-MM-DD HH:mm`.
- **StatusBar:** Journey chỉ hiện khi product tab đang mở có claim; có nhãn demo và `read-only`.

### 3.4 Component cũ chuyển sang shell mới

- `ThreadView` đọc `product[tabId]`; lấy flow qua `getFlow(claimId ?? root)`; khi không có claim thì không gọi `getClaim`/`getClaimFault`, `EntityHeader` ẩn công tắc fault mode, và không có "Set as fault point".
- `ThreadGraph` lấy `tabId` qua `ProductTabContext` và tô sáng `hoverIds`.
- `EvidencePanel({ nodeId, owner })` lưu sub-tab theo `owner`.
- Phần thân `DocDrawer` tách thành `DocBody`; bỏ lớp drawer phủ màn hình.
- `ClaimsSidebar` bỏ `TRACEABLE` và không còn là rail mặc định (claim xuất hiện trong feed). Chú giải độ tin cậy chuyển thành component `LinkLegend` dùng ở product tab và twin.
- `PlantSidebar` và `DataSidebar` thành nội dung rail Assets và Data; click item gọi `goTo`.
- `PlantView` bị thay bằng TwinView.
- Xem chéo:
  - "View on plant" ở `OverviewBody` của node thread: kích hoạt twin và chọn node đó.
  - "View on thread" ở object của twin: tìm các product tab có id trong `threadIds`. Có 1 tab thì focus tab đó; có nhiều tab thì hiện menu chọn; không có tab nào thì mở product tab đầu tiên lấy từ impact (nếu là lot hoặc máy) hoặc ẩn nút.

## 4. Twin, feed, dock, agent (đợt C)

### 4.1 Feed (`feed/`)

- Chip: All, Alerts, 4M changes, Pending review, Documents, Claims (kèm số lượng); chip lọc phòng ban có ✕.
- Card:
  - badge, id, giờ, tiêu đề 1 dòng, lý do 1 dòng;
  - pill bên gửi (nền đặc, màu theo phòng ban), pill cần xử lý (viền), pill object, pill trạng thái;
  - card chưa đọc có chấm teal; card khác phòng ban của người dùng (Quality) có viền trái màu bên gửi;
  - card LINK có `ReviewActions`.
- Hover → `hoverIds`.
- Click →
  - `feed.selected`, đánh dấu đã đọc;
  - `asOf = at`;
  - `reach`: red từ `/api/fault-trace?origin=<object đầu tiên>&at=`, orange từ `/api/impact/<lot>` khi có lot;
  - tab `feed:` dạng preview ở dock;
  - context cho agent.

### 4.2 Twin (`plant/TwinView.tsx`, `twinLayout.ts`, `DeptStrip.tsx`)

- Bố cục cố định theo cột trong `twinLayout(plant, links)`:
  - cột 0: receipt, lot;
  - cột 1: header line → hopper → máy, mỗi line một hàng;
  - cột 2: IQC;
  - cột 3: node volume "1,000 serials · 42 boxes" và shipment.
- Node dùng chung kiểu thẻ ThreadGraph: tên; chấm màu kèm chữ trạng thái (`running`, `stopped`, `warning`, `watch4m`); giá trị sống. Viền khi được chọn; nền đỏ hoặc cam theo `reach`; vòng sáng khi nằm trong `hoverIds`.
- Cạnh lấy từ `/api/plant` (thêm trường `links` giữa các asset), kiểu nét theo `edgeStyle(status)`, kèm `LinkLegend`.
- DeptStrip: 7 chip, badge theo số item chưa đọc của kênh. Lớp "Department flow" vẽ đường chấm SVG từ chip tới node. Click chip → `deptFilter` và tô sáng object của phòng ban đó.
- Toolbar: lớp Machines / Lots in use / Alerts / Department flow, zoom +/−, "Fit to frame" (`fitView`).
- Click node → `twin.selected` và tab object preview ở dock (tiêu đề "Line 1 › M02"); click vùng trống → bỏ chọn và dock về Overview. Double-click node volume hoặc shipment → popover danh sách serial, mỗi serial gọi `openProduct`.

### 4.3 Dock

- PlantOverview: 5 ô KPI; bảng line/máy (state, cycle so với target, output, lot, sparkline SVG); bảng shipment kèm risk.
- DataSources: mỗi source một dòng `{ source, dept, system, events, last_at, delay (offset_s từ time_mappings) }`. Lấy từ `/api/plant/overview`, trường `sources`.
- Tab object của máy: sub-tab "Press cycle" đứng đầu. `CycleChart` nhận thêm `bands` (lô theo thời gian) và `markers` (alert/4M).
- FeedDetail: trái là text tài liệu, các `extracted_codes` được bọc `<mark>` (notice thì hiện tiêu đề, lý do và payload); phải là bảng object/link `{ id, relation, status, score }`, mỗi id gọi `goTo`.

### 4.4 Agent

- Dưới tiêu đề hiện context: tiêu đề main tab đang mở và card hoặc object đang chọn.
- Bong bóng: của người dùng căn phải, nền `#E3F0FB`; của agent căn trái, nền `#F1F2F4`; chữ `var(--ink)`.
- Cite chip gọi `goTo`.
- `claim` gửi lên lấy từ `product[active].claimId`, mặc định CLM-0012.

## 5. Quy tắc và kiểm thử

- Ở 1440×900 không có scroll toàn trang: `.app` cố định `100vh`, mọi vùng có `min-height: 0` và tự scroll.
- pytest: `test_feed.py`, `test_plant_state.py` (state của M02 lúc 14:05 là warning, 42/30; số LOT-B còn lại; overview có 2 line và 3 máy), `test_generate.py` (M01/M03 có cycle, không thêm serial), `test_api.py` (các route mới), search "0457".
- vitest: `store/demo.test.ts` (open/preview/keep/close/move, tab ghim, `goTo` theo bảng, state riêng từng tab, `applyStep` 1–4, dock nhớ theo main tab), `TabBar.test.tsx`, `FeedSidebar.test.tsx`, `twinLayout.test.ts`, và cập nhật các test cũ theo shape store mới.
- `make test`, `npm run lint`, `npm run build` phải xanh ở cuối mỗi đợt.

## 6. Hoàn thành khi

Lấy nguyên mục "Done when" trong yêu cầu. Cách kiểm tra từng mục: test store (mục 1–2, 4), test overview/state (mục 3), test feed + DeptStrip + twin (mục 5), và chạy app thật mở CLM-0012 từ feed (mục 6).
