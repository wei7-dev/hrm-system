// admin-auth.js
// Thay thế cơ chế "prompt mã khóa hardcode" cũ (không an toàn, ai xem source cũng thấy)
// bằng Firebase Authentication thật + kiểm tra role trong Firestore.
//
// YÊU CẦU: cần có collection "accounts" trong Firestore, mỗi doc:
//   - ID doc = uid của Firebase Auth user đó
//   - field "role": "admin" | "hr" | "employee" | "investor" ...
//
// LƯU Ý QUAN TRỌNG: việc kiểm tra ở đây chỉ chặn được GIAO DIỆN.
// Phải cấu hình thêm Firestore Security Rules (xem file firestore.rules đính kèm)
// để chặn luôn ở tầng dữ liệu — nếu không, ai đó vẫn có thể gọi thẳng Firestore SDK
// qua console trình duyệt để đọc/ghi dữ liệu bất chấp giao diện có ẩn hay không.

import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const AUTHORIZED_ROLES = ["admin", "hr"];

const authGate = document.getElementById("authGate");
const adminHeader = document.getElementById("adminHeader");
const adminMain = document.getElementById("adminMain");

function showGateMessage(message) {
    if (!authGate) return;
    authGate.innerHTML = `<div><p style="font-size:1.1rem;margin-bottom:12px;">${message}</p></div>`;
}

function redirectToHome(delayMs = 1500) {
    setTimeout(() => {
        window.location.href = "index.html";
    }, delayMs);
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        showGateMessage("🔒 Bạn cần đăng nhập để truy cập trang này. Đang chuyển về trang chủ...");
        redirectToHome();
        return;
    }

    try {
        const accountSnap = await getDoc(doc(db, "accounts", user.uid));

        if (!accountSnap.exists()) {
            showGateMessage("⛔ Tài khoản chưa được cấp quyền truy cập hệ thống. Đang chuyển về trang chủ...");
            redirectToHome();
            return;
        }

        const role = accountSnap.data().role;

        if (!AUTHORIZED_ROLES.includes(role)) {
            showGateMessage("⛔ Bạn không có quyền truy cập trang Quản Trị Hệ Thống. Đang chuyển về trang chủ...");
            redirectToHome();
            return;
        }

        // Xác thực + phân quyền hợp lệ -> hiện giao diện thật
        authGate.style.display = "none";
        if (adminHeader) adminHeader.style.display = "";
        if (adminMain) adminMain.style.display = "";

    } catch (err) {
        console.error('[v0] Lỗi kiểm tra quyền admin:', err);
        showGateMessage("⚠️ Lỗi kết nối hệ thống phân quyền. Đang chuyển về trang chủ...");
        redirectToHome();
    }
});

// Tiện ích đăng xuất, có thể gọi từ nút "Đăng xuất" nếu bạn thêm vào giao diện sau này
window.adminSignOut = () => signOut(auth).then(() => window.location.href = "index.html");
