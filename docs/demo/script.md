# Kịch bản thuyết trình · One Thread (≤ 7 phút)

Màn chuẩn 1440×900 (chạy được ở 1280×800), zoom trình duyệt 100%. Bị lạc ở bước nào thì mở deep link của bước đó (cột phải), trang dựng lại đúng trạng thái.

| # | Thời lượng | Deep link |
|---|---|---|
| 1 | 0:45 | `http://localhost:5173/?step=1` |
| 2 | 1:30 | `?step=2` |
| 3 | 1:45 | `?step=3` |
| 4 | 2:00 | `?step=4` |
| Khám phá tự do | 1:00 | không cần |

Thêm `&mode=normal` để mở bước 2–4 mà không tô màu truy lỗi.

## Bước 1 · Claims inbox (0:45)

**Bấm:** không bấm gì; chỉ vào cột trái, claim `CLM-0012`.

**Nói:**
- "Sáng nay, ngày 12/02/2027, khách C3 báo bơm MH-20 kêu to. Máy này giao từ 3 tháng trước."
- "One Thread nối claim tới serial `MH20-0001` bằng khoá chính xác. Đây là bậc tin cậy cao nhất, không ai phải đoán."

**Nhấn mạnh:** 3 tháng · serial nối tự động.

## Bước 2 · Thread truy vết (1:30)

**Bấm:** `CLM-0012` → tab Thread mở sẵn ở chế độ **Truy lỗi**.

**Nói:**
- "Một hàng ngang là toàn bộ hành trình của chiếc bơm, từ nhà cung cấp S1 tới khách C3. Dữ liệu nằm rải ở 7 hệ thống ERP, WMS, MES, PLC, QMS…"
- "Đỏ là điểm lỗi và mọi thứ thượng nguồn còn hiệu lực lúc ép, 14:05 ngày 03/11. Cam là hạ nguồn: hàng có thể đã nhận linh kiện lỗi."
- "Nét liền là liên kết đã xác nhận, nét đứt là liên kết máy tự suy ra. Số tròn trên góc node là số tài liệu gắn kèm."

**Nhấn mạnh:** một màn thay cho 7 hệ thống · mốc thời gian "tại lúc ép".

## Bước 3 · Bằng chứng (1:45)

**Bấm:** node `Machine 02` → tab **Chu kỳ ép**; rồi node `LOT-B` → tab **IQC · so sánh lô**.

**Nói:**
- "Cycle time Machine 02 nhảy từ 31 lên 42 giây đúng lúc nạp LOT-B vào Hopper 1, lúc 13:52. Lực ép tăng 6%."
- "Bảo trì, người vận hành, nhiệt độ đều không đổi. Ba yếu tố này được loại trừ ngay trên dữ liệu."
- "LOT-B có Cpk 0,92, dưới chuẩn 1,33 trong bản vẽ D-12 trang 7. Lô đối chứng LOT-A cùng nhà cung cấp đạt 1,45. Tháng 9 đã có CLM-0009 cùng triệu chứng."

**Nhấn mạnh:** 31 → 42 s · +6% · Cpk 0,92 vs 1,33 · ca tương tự CLM-0009.

## Bước 4 · Agent RCA + khoanh vùng (2:00)

**Bấm:** `/report` trong khung Agent (hoặc `?step=4`) → chờ câu trả lời → **Xem khoanh vùng** → **Tạo nháp báo cáo**.

**Nói:**
- "Agent chỉ đọc qua 7 công cụ, không ghi gì. Mỗi nhận định đều có chip dẫn nguồn, bấm vào là tới đúng bản ghi."
- "Khoanh vùng: 1.000 part dùng LOT-B, 42 thùng, 3 lô xuất. 640 bơm đã tới khách C3 và C5, 360 còn trong kho cần cách ly."
- "Báo cáo nháp có sẵn chuỗi nguyên nhân và hành động. Con người duyệt, không phải AI."

**Nhấn mạnh:** 1.000 · 42 · 640 đã giao · 360 cách ly.

## Khám phá tự do (1:00, nếu còn giờ)

- **Gắn tài liệu:** "Gắn tài liệu" → tệp mẫu `CoA_S1-6203-B.pdf` → hệ thống nhận mã `S1-6203-B ≡ LOT-B` → "Xem chi tiết & duyệt" → **Duyệt**.
- **Kho dữ liệu:** icon CSDL → Hàng đợi duyệt (D-07 "lô B hơi rơ" đang chờ) → mở bảng `links` để thấy dữ liệu thô.
- **Nhà máy:** icon nhà máy → `LOT-A` → IQC; "cùng màn chi tiết, không cần claim".

## Câu kết

"Không có One Thread, bước 2–4 là email qua lại giữa sản xuất, chất lượng, mua hàng và logistics."

## Ghi chép dry-run

| Lần | Ngày | Người xem ngoài đội | B1 | B2 | B3 | B4 | Tổng | Ghi chú |
|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | |
| 2 | | | | | | | | |
