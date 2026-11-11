# Cải tiến cần làm — One Thread demo

> **Cập nhật đợt 3 (2026-11-11):** mục 1, 2, 3 đã làm, xem `docs/superpowers/specs/2026-11-11-one-thread-phase3.md`. Mục 4 (review UI với team) vẫn cần làm. Phần payload thô (`changed: False`) đã có nhãn tiếng Việt; badge che cạnh graph và a11y hộp "Gắn tài liệu" (focus trap, trạng thái bận) đã sửa ở đợt 3b.

Ghi nhận ngày 2026-11-11, sau khi xong đợt 2 (DEMO-16 → 24, branch `feat/one-thread-demo`).

## 1. Xem chi tiết tài liệu gắn với node

**Hiện trạng:**
- Tổng hợp node (`NodeSummary`, `GET /api/objects/{id}/summary`) chỉ trả **số lượng** tài liệu đính kèm. Trường `attachments` mà spec DEMO-18 yêu cầu đã bị plan bỏ.
- Badge trên node chỉ là con số, không bấm vào được.

**Cần có:**
- Bấm vào một tài liệu để xem chi tiết: loại tài liệu, nguồn, bậc, trạng thái, điểm, lý do phân loại, nội dung hoặc trích đoạn.
- Mở được file gốc (PDF/TXT). Upload trong `backend/var/uploads/` hiện chưa có endpoint phục vụ; khi thêm cần chặn XSS, ví dụ trả về với `Content-Disposition` và `Content-Type` an toàn.

## 2. Tương tác với danh sách tài liệu

**Hiện trạng:** danh sách tài liệu trong Overview là thẻ tĩnh. Không cuộn riêng được, không mở rộng, không lọc.

**Cần có:**
- Vùng danh sách tự cuộn được khi node có nhiều tài liệu.
- Mở rộng hoặc thu gọn từng tài liệu.
- Lọc hoặc sắp xếp theo loại, bậc, trạng thái (confirmed / inferred / pending / suggested).
- Tài liệu vừa gắn (nhãn "mới") nổi lên đầu danh sách.

## 3. Thiết kế lại panel theo loại node

**Hiện trạng:**
- Panel bên phải có bộ tab cố định: Overview / Lô / Máy / Ảnh hưởng / Agent.
- Bấm node nào cũng thấy cùng bộ tab, kể cả tab không liên quan. Ví dụ: node nhập kho (RCV-…) vẫn có tab thông số máy.

**Cần có:** mỗi loại node chỉ hiện tab tài liệu và các chức năng của chính nó. Gợi ý:

| Loại node | Tab / nội dung |
|---|---|
| Nhà cung cấp (SUP) | Tài liệu, danh sách PO/lô đã cấp |
| PO, phiếu nhập (PO, RCV) | Tài liệu, dòng hàng, kết quả IQC |
| Lô (LOT, AGG-LOT) | Tài liệu, phân bổ lô (đi vào hopper/máy nào, bao nhiêu part) |
| Hopper, máy (HOP, M) | Tài liệu, **thông số máy**, biểu đồ chu kỳ, bảo trì |
| Serial, thùng (MH20-…, BOX) | Tài liệu, lịch sử ép, thùng/lô giao |
| Giao hàng, đơn hàng, khách (SHP, SO, CUS) | Tài liệu, số lượng giao, xác nhận khách hàng |
| Claim (CLM) | Tài liệu, truy lỗi, Agent |

**Cách làm:**
- Định nghĩa cấu hình tab theo loại node ở một chỗ, thay cho bộ tab cứng trong `frontend/src/evidence/EvidencePanel.tsx`.
- Backend có thể trả thêm danh sách khối khả dụng trong `NodeSummary`, để frontend không phải đoán.

## 4. Review lại UI với team

- Giao diện tổng thể vẫn chưa ổn. Các thành viên trong team cần review kỹ trước khi demo, gồm bố cục, mật độ thông tin, màu, chữ và luồng thao tác.
- Hạng mục cần xem:
  - bố cục ở 1440×900 và 1280×800;
  - thanh công cụ trên màn hình hẹp;
  - badge che cạnh của đồ thị;
  - nhãn tiếng Việt cho payload sự kiện (hiện là key thô như `changed: False`);
  - a11y của hộp "Gắn tài liệu" (focus trap, trạng thái bận).
- Ghi kết quả review thành ticket riêng trước khi sửa.

## Liên quan

- Spec: `docs/superpowers/specs/2026-11-11-one-thread-demo-design.md` (DEMO-18, DEMO-21, DEMO-22).
- Còn tồn từ plan cũ: DEMO-14 (deep link có `mode`, nút Reset demo), DEMO-15 (kịch bản trình bày, checklist).
- Rủi ro đã chấp nhận: nội dung `.txt` upload đi thẳng vào agent, có thể bị prompt injection nếu khán giả được nộp file.
