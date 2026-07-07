# HRM System — Ghi chú sau khi fix bảo mật + phân quyền menu

## Phân quyền menu theo 3 role

| Menu | HR | Staff (NV chính thức/thực tập/SV) | Nhà đầu tư |
|---|---|---|---|
| Chấm công, Tra cứu NV, Tra cứu lịch, Lịch sử tra cứu | ✅ | ✅ | ❌ ẩn |
| Quản Trị Hệ Thống (admin.html) | ✅ | ❌ ẩn | ❌ ẩn |
| Báo cáo tài chính - Dự án tương lai | ❌ ẩn | ❌ ẩn | ✅ |

Việc ẩn/hiện nằm ở `menu-permissions.js` (đọc field `role` trong `accounts/{uid}`), nhưng **đây chỉ là lớp giao diện**. Lớp chặn dữ liệu thật nằm ở `firestore.rules` — đã cấu hình đúng ma trận trên: Staff/HR đọc được `nhan_vien_chinh_thuc` + `attendance`, Nhà đầu tư thì không; ngược lại `bao_cao_tai_chinh` chỉ Nhà đầu tư (và HR/Admin) đọc được.

### Giá trị role hợp lệ trong Firestore (`accounts/{uid}.role`)
- HR: `"hr"` hoặc `"admin"`
- Staff: `"employee"`, `"staff"`, `"nv"`, `"sv"`, hoặc `"tt"` (tùy bạn đặt tên khi tạo tài khoản, `menu-permissions.js` và `firestore.rules` đã liệt kê đủ các biến thể này)
- Nhà đầu tư: `"investor"`

## Việc bạn cần làm thêm

1. **Tạo trang `bao-cao-tai-chinh.html`** — hiện link menu đã trỏ tới file này nhưng file chưa tồn tại, cần tạo nếu muốn Nhà đầu tư bấm vào không bị lỗi 404.
2. **Gán role thật cho từng tài khoản trong Firestore Console** — người tự đăng ký qua form ở trang chủ chỉ được chọn `employee` hoặc `investor` (không tự phong `hr`/`admin` được, đã chặn cả ở client lẫn ở `firestore.rules`). Muốn tạo tài khoản HR, bạn cần vào Firestore Console sửa tay field `role` của doc đó thành `"hr"`.
3. Với nhân viên là "thực tập" / "sinh viên thực tập" cụ thể (role `sv`/`tt`), hiện form đăng ký công khai chỉ có 2 lựa chọn (`employee`/`investor`) — nếu muốn phân biệt rõ NV chính thức vs SV/TT ngay từ lúc đăng ký, cần bổ sung thêm lựa chọn trong `register-role` và cập nhật `SELF_REGISTER_ALLOWED_ROLES` trong `auth-forms.js`.

## Những gì đã sửa (các lần trước)

1. **admin.js**: chống trùng mã nhân viên — kiểm tra Firestore trước khi ghi (`generateUniqueEmployeeId`, thử tối đa 20 lần), disable nút submit khi đang xử lý, validate tên trống.
2. **admin.html + admin-auth.js**: bỏ cơ chế `prompt("123456")` hardcode, thay bằng Firebase Authentication thật + kiểm tra role.
3. **firebase.js**: export thêm `auth`.
4. **firestore.rules**: lớp bảo vệ dữ liệu theo role, khớp ma trận phân quyền ở trên.
5. **auth-forms.js**: nối 3 form có sẵn trong `index.html` (đăng nhập / đăng ký / quên mật khẩu) với Firebase Auth thật, tự tạo `accounts/{uid}` khi đăng ký.
6. **menu-permissions.js (mới)**: ẩn/hiện menu theo role sau khi đăng nhập.

## Cần làm thủ công trên Firebase Console

1. Authentication → Sign-in method → bật Email/Password.
2. Firestore Database → Rules → dán nội dung `firestore.rules`, Publish.
3. Với tài khoản cần quyền HR: vào Firestore Console, mở `accounts/{uid}` (uid lấy từ tab Authentication → Users), sửa `role` thành `"hr"`.

