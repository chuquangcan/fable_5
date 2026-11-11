# Checklist trình diễn · One Thread

## T-30 phút

- [ ] `git pull` đúng nhánh trình diễn; `make demo` (DB → seed → API + web), mở http://localhost:5173
- [ ] `make test` xanh (pytest + vitest)
- [ ] `curl localhost:8000/api/agent/provider` → đúng provider; `DEMO_MODE=auto` (mặc định)
- [ ] Chạy một lượt live: `?step=4`, câu trả lời có dẫn nguồn, không có dòng "Lỗi agent"
- [ ] Bấm **Reset demo**; đi trọn kịch bản bước 1→4 một lần, DevTools console không có lỗi đỏ
- [ ] Độ phân giải 1440×900 (hoặc 1280×800), zoom trình duyệt 100%, ẩn bookmark bar
- [ ] Tắt thông báo hệ điều hành, chat, email; bật chế độ không làm phiền
- [ ] Mở sẵn video backup ở tab/ứng dụng khác (đường dẫn: _ghi vào đây sau khi quay_)
- [ ] Mở sẵn `docs/demo/script.md` trên máy phụ hoặc giấy

## Ngay trước giờ

- [ ] **Reset demo** (header) → URL sạch, Agent trống, hàng đợi duyệt = 3
- [ ] Agent đang hiện (✦ ở dưới activity bar sáng)

## Khi sự cố

| Sự cố | Xử lý |
|---|---|
| Mạng chập chờn / agent live chậm | `Alt+Shift+D` → chấm vàng cạnh "Agent" = ép phát lại bản đã ghi; hỏi lại |
| Lạc bước, màn sai trạng thái | Mở `?step=N` (N = 1..4) |
| Lỡ duyệt / gắn tài liệu sai | **Reset demo** rồi `?step=N` |
| API chết (màn báo "Không tải được…") | Bấm **Thử lại**; vẫn lỗi thì `make api` ở terminal dự phòng |
| Hỏng hẳn | Chuyển sang video backup |

## Sau buổi

- [ ] Ghi thời gian từng bước vào bảng dry-run trong `script.md`
- [ ] **Reset demo** để trả dữ liệu về như cũ
