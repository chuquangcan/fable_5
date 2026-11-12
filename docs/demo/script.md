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

## Bước 1 · Nhà máy và thông báo (0:45)

**Bấm:** không bấm gì; màn mở ở tab ghim **Plant** (twin nhà máy), rail trái là **Notifications & changes**. Rê chuột lên card `AL-0001` (P1) rồi chỉ vào card `CLM-0012` trên cùng.

**Nói:**
- "Đồng hồ demo đang ở 14:05 ngày 03/11. Card P1 do Sản xuất gửi: cycle M02 nhảy 31 → 42 s. Cùng một thông báo hiện ở ba nơi khớp nhau: pill `Production` trên card, badge trên chip `Production · MES`, và M02 sáng lên trên twin."
- "Ba tháng sau, 12/02/2027, khách C3 báo bơm MH-20 kêu to: đó là claim `CLM-0012`. One Thread nối claim tới serial `MH20-0001` bằng khoá chính xác."

**Nhấn mạnh:** một feed thay cho nhiều hộp thư · serial nối tự động.

## Bước 2 · Thread truy vết (1:30)

**Bấm:** card `CLM-0012` → mở tab **Thread · MH20-0001** ở chế độ truy lỗi; dock dưới hiện **Details · MH20-0001**.

**Nói:**
- "Một hàng ngang là toàn bộ hành trình của chiếc bơm, từ nhà cung cấp S1 tới khách C3. Dữ liệu nằm rải ở 7 hệ thống ERP, WMS, MES, PLC, QMS…"
- "Đỏ là điểm lỗi và mọi thứ thượng nguồn còn hiệu lực lúc ép, 14:05 ngày 03/11. Cam là hạ nguồn: hàng có thể đã nhận linh kiện lỗi."
- "Nét liền là liên kết đã xác nhận, nét đứt là liên kết máy tự suy ra. Mỗi tab sản phẩm giữ node đang chọn và chế độ của riêng nó."

**Nhấn mạnh:** một màn thay cho 7 hệ thống · mốc thời gian "tại lúc ép".

## Bước 3 · Bằng chứng (1:45)

**Bấm:** node `Machine 02` → dock mở tab **Press cycle**; rồi node `LOT-B` → tab **IQC · lot comparison**.

**Nói:**
- "Cycle time Machine 02 nhảy từ 31 lên 42 giây đúng lúc nạp LOT-B vào Hopper 1, lúc 13:52. Nền biểu đồ đổi màu theo lô đang chạy, hai cờ là thay đổi 4M và cảnh báo P1 từ feed. Lực ép tăng 6%."
- "Bảo trì, người vận hành, nhiệt độ đều không đổi. Ba yếu tố này được loại trừ ngay trên dữ liệu."
- "LOT-B có Cpk 0,92, dưới chuẩn 1,33 trong bản vẽ D-12 trang 7. Lô đối chứng LOT-A cùng nhà cung cấp đạt 1,45. Tháng 9 đã có CLM-0009 cùng triệu chứng."

**Nhấn mạnh:** 31 → 42 s · +6% · Cpk 0,92 vs 1,33 · ca tương tự CLM-0009.

## Bước 4 · Agent RCA + khoanh vùng (2:00)

**Bấm:** `/report` trong khung Agent (hoặc `?step=4`) → chờ câu trả lời → **View impact scope** → **Create report draft** (mở tab **RCA report · CLM-0012**).

**Nói:**
- "Dòng Context dưới tiêu đề Agent cho biết agent đang nhìn gì: Thread · MH20-0001 (CLM-0012). Agent chỉ đọc qua 7 công cụ, không ghi gì. Mỗi nhận định có chip dẫn nguồn, bấm vào là tới đúng node hoặc tài liệu."
- "Khoanh vùng: 1.000 part dùng LOT-B, 42 thùng, 3 lô xuất. 640 bơm đã tới khách C3 và C5, 360 còn trong kho cần cách ly."
- "Báo cáo nháp có sẵn chuỗi nguyên nhân và hành động. Con người duyệt, không phải AI."

**Nhấn mạnh:** 1.000 · 42 · 640 đã giao · 360 cách ly.

## Khám phá tự do (1:00, nếu còn giờ)

- **Twin:** quay về tab **Plant** → dock tự về đúng tab cũ. Click `M02`, `LOT-B`, `Line 2`, `SHP-1112` → dock hiện chi tiết từng object; click vùng trống → **Plant overview**. Double-click `SHP-1112` → danh sách serial → mở một serial.
- **Chip phòng ban:** bấm `Warehouse · WMS` → feed chỉ còn việc của Kho, các object Kho đã báo sáng trên twin. Các lớp **Machines / Lots in use / Alerts / Department flow** bật tắt trên thanh công cụ.
- **Mở serial bằng `Ctrl K`:** gõ `0457` → **Thread · MH20-0457** mở như tab sản phẩm không có claim (không có nút Trace fault).
- **Gắn tài liệu:** **Attach document** → tệp mẫu `CoA_S1-6203-B.pdf` → hệ thống nhận mã `S1-6203-B ≡ LOT-B` → "View details & review" → **Approve**.
- **Kho dữ liệu:** icon CSDL → **Review queue** (D-07 "lô B hơi rơ" đang chờ) → mở bảng `links` để thấy dữ liệu thô; **Data sources** cho thấy độ trễ từng nguồn.

## Câu kết

"Không có One Thread, bước 2–4 là email qua lại giữa sản xuất, chất lượng, mua hàng và logistics."

## Ghi chép dry-run

| Lần | Ngày | Người xem ngoài đội | B1 | B2 | B3 | B4 | Tổng | Ghi chú |
|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | |
| 2 | | | | | | | | |
