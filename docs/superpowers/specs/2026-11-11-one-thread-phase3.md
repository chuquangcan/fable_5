# One Thread · Đợt 3: dọn UI, tài liệu, duyệt, nhà máy, kho dữ liệu

- Ngày: 2026-11-11 · tiếp theo `2026-11-11-one-thread-demo-design.md` (đợt 1–2) và `docs/improve.md`
- Phạm vi: 5 vấn đề còn tồn sau đợt 2

| # | Vấn đề | Kết quả |
|---|---|---|
| 1 | UI rối, sắp xếp bẩn | Tab chi tiết theo loại node; một hàng header cho thread; bỏ nút trùng/giả; status bar dữ liệu thật; Agent ẩn/hiện được; graph "Vừa khung" |
| 2 | Chưa xem được chi tiết tài liệu | Drawer tài liệu: metadata, toàn văn theo trang, liên kết, lịch sử duyệt, mở bản gốc (file upload) |
| 3 | Gắn được tài liệu nhưng chưa duyệt vào node | Duyệt / từ chối từng liên kết, có ghi chú; log `link_reviews`; Reset hoàn tác |
| 4 | Có tách view sản phẩm và nhà máy không | **Có tách**, dùng chung panel chi tiết (mục 2) |
| 5 | Xem DB / kho tài liệu | View "Kho dữ liệu": kho tài liệu có lọc, hàng đợi duyệt, trình duyệt 7 bảng chỉ đọc |

## 1. Điều hướng

Activity bar trái giờ là bộ chuyển view thật:

| Icon | View | Cột trái | Vùng chính |
|---|---|---|---|
| Đồ thị | **Truy vết sản phẩm** | Claims + độ tin cậy + hàng đợi duyệt | Tab claim / thread / báo cáo (như cũ) |
| Nhà máy | **Nhà máy** | Tài sản theo khu: kho NL, sản xuất, chất lượng, kho TP | Panel chi tiết của tài sản đang chọn |
| CSDL | **Kho dữ liệu** | Kho tài liệu, hàng đợi duyệt, 7 bảng + số dòng | Bảng tài liệu / hàng đợi / lưới dữ liệu |
| Báo cáo | Mở tab báo cáo RCA (khi có claim) | | |
| ✦ (dưới) | Ẩn / hiện Agent panel (giữ nguyên câu trả lời đang chạy) | | |

`goTo(id)` là một chỗ điều hướng duy nhất: `D-*` mở drawer tài liệu; node đang có trên thread → focus trên thread; còn lại → view Nhà máy. Tìm kiếm header (`Ctrl K`, `GET /api/search`), cite chip của agent, link trong drawer và bảng tài liệu đều đi qua đây.

## 2. Vì sao tách view sản phẩm và nhà máy

Hai câu hỏi khác nhau:
- **Sản phẩm**: "serial này từ đâu tới, đi đâu?" Câu hỏi bắt đầu từ claim, trục là luồng vật tư, mốc thời gian cố định tại lúc ép.
- **Nhà máy**: "máy / hopper / lô này đã có chuyện gì theo thời gian?" Không cần claim, trục là tài sản và sự kiện.

Nhét cả hai vào thread làm graph rộng thêm và lẫn ngữ cảnh. Tách view nhưng **dùng chung panel chi tiết** (`EvidencePanel nodeId=…`): cùng tab Tổng quan, Sự kiện, tài liệu, duyệt. Như vậy không phải làm hai lần, và chuyển qua lại không mất mạch: từ nhà máy có nút "Xem trên thread", từ tài liệu bấm vào node là tới đúng chỗ.

Tab chi tiết theo loại node (thay bộ tab cứng, improve.md §3):

| Tab | Khi nào có |
|---|---|
| Tổng quan | Luôn có: thông số có nguồn, alias, tài liệu (lọc theo trạng thái, bấm để mở drawer) |
| Sự kiện · n | Node có event: bảng mọi event, lọc theo loại, payload hiển thị nhãn tiếng Việt |
| Chu kỳ ép 11-03 | M02 (dữ liệu câu chuyện) |
| IQC · so sánh lô | LOT-A, LOT-B, IQC-5507/5531 |
| Khoanh vùng | Lô và nút gộp lô |

Nút "Đặt làm điểm lỗi" chỉ hiện trong view sản phẩm khi có claim, vì dò lỗi cần thời điểm của claim.

## 3. Duyệt liên kết

- Liên kết duyệt được: `inferred`, `pending`, `suggested`. Liên kết `confirmed` trả 409.
- **Duyệt**: `status → confirmed`, giữ nguyên `tier`. Tier nói liên kết được tìm ra bằng cách nào, không phải ai đã kiểm.
- **Từ chối**: xoá dòng trong `links`. Nhờ vậy mọi đường đọc (flow, docs, trace, summary, tool của agent) tự nhiên không thấy nó, không phải thêm điều kiện lọc ở hơn 15 câu SQL.
- Mỗi quyết định ghi vào bảng **`link_reviews`** (ngoài 6 bảng lõi; là log của demo): quyết định, trạng thái cũ, người duyệt, ghi chú, thời điểm (đồng hồ demo), `snapshot` của dòng link.
- `POST /api/demo/reset` hoàn tác từ mới nhất về cũ nhất: duyệt → trả trạng thái cũ, từ chối → chèn lại đúng `link_id`. Sau đó mới xoá upload.
- Chỗ duyệt: drawer tài liệu (có ô ghi chú) và Kho dữ liệu → Hàng đợi duyệt. Sidebar claims chỉ liệt kê; bấm vào thì mở drawer hoặc hàng đợi, tránh bấm nhầm khi đang trình bày.

## 4. API mới

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/api/documents?q&type&status&source` | Mọi tài liệu + liên kết + trạng thái tốt nhất (`unlinked` nếu không còn liên kết); upload mới nhất lên đầu |
| GET | `/api/documents/{id}` | Chi tiết: chunk, liên kết dạng review item, lịch sử duyệt |
| GET | `/api/documents/{id}/file` | Bytes của file upload. Chỉ basename trong `uploads_dir`; `nosniff`; pdf/txt/png/jpg `inline`, còn lại `attachment`; không phải PDF thì có CSP `sandbox`. Tài liệu seed trả 404 (bản gốc ở PLM/QMS) |
| GET | `/api/review-queue` | `{pending, decided}` |
| POST | `/api/links/{link_id}/review` | `{decision: approve\|reject, note?}` (ghi chú ≤ 500 ký tự) |
| GET | `/api/plant` | Khu → nhóm loại → tài sản (số event, số tài liệu, số liên kết chờ duyệt); serial/thùng chỉ đếm |
| GET | `/api/db/tables` · `/api/db/tables/{name}?q&limit&offset` | Whitelist 7 bảng, bỏ cột `embedding`, `limit ≤ 200`, `q` lọc `row::text ILIKE` |
| GET | `/api/search?q` | Object + tài liệu, tối đa 20 |

## 5. Còn lại / ngoài phạm vi

- Tài liệu seed (D-03/07/09/12) không có file gốc trong repo; drawer ghi rõ bản gốc ở hệ thống nào.
- Tab "Chu kỳ ép", "IQC", "Khoanh vùng" vẫn viết theo dữ liệu câu chuyện (M02, LOT-A/B), chưa tổng quát cho máy/lô bất kỳ.
- Người duyệt cố định "QA engineer (demo)", chưa có auth.
- Nội dung `.txt` upload vẫn đi thẳng vào agent (rủi ro prompt injection đã chấp nhận ở đợt 2).
