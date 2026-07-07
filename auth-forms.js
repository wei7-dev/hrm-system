// auth-forms.js
// Nối 3 form có sẵn trong index.html (đăng nhập / đăng ký / quên mật khẩu)
// với Firebase Authentication thật, và tự động gán role vào Firestore
// collection "accounts" ngay khi tạo tài khoản.
//
// PHÂN QUYỀN: người tự đăng ký ở trang chủ CHỈ được chọn "employee" hoặc
// "investor" (xem select #register-role trong index.html) — không ai có
// thể tự cấp cho mình quyền "admin" hay "hr" qua form public này.
// Muốn nâng quyền lên admin/hr, phải làm thủ công trong Firestore Console,
// hoặc qua form "Tạo tài khoản nhân viên" riêng trong admin.html (chỉ
// admin/hr đã đăng nhập mới thấy được, xem thêm ở admin-create-account.js).

import { auth, db } from "./firebase.js";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Vai trò hợp lệ mà người dùng được TỰ chọn khi đăng ký công khai.
// "admin" và "hr" CỐ TÌNH không có trong danh sách này.
const SELF_REGISTER_ALLOWED_ROLES = ["employee", "investor"];

function redirectByRole(role) {
    // Mọi role sau khi đăng nhập đều vào thẳng index.html như nhau, không tự
    // động nhảy sang admin.html nữa. HR chỉ vào trang quản trị khi họ chủ động
    // bấm vào mục "Quản trị hệ thống" trong dropdown hồ sơ (do profile-menu.js
    // hiển thị đúng theo role), tương tự cách Investor tự bấm "Báo cáo tài chính".
    window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const forgotForm = document.getElementById("forgotForm");

    const loginError = document.getElementById("loginError");
    const registerError = document.getElementById("registerError");
    const forgotError = document.getElementById("forgotError");

    function setLoading(button, isLoading, normalText) {
        if (!button) return;
        button.disabled = isLoading;
        button.textContent = isLoading ? "Đang xử lý..." : normalText;
    }

    // ============================================================
    // ĐĂNG NHẬP
    // ============================================================
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            loginError.textContent = "";

            const email = document.getElementById("login-username").value.trim();
            const password = document.getElementById("login-password").value;
            const submitBtn = loginForm.querySelector(".submit-btn");

            setLoading(submitBtn, true, "Đăng nhập");

            try {
                const cred = await signInWithEmailAndPassword(auth, email, password);
                const accountSnap = await getDoc(doc(db, "accounts", cred.user.uid));

                if (!accountSnap.exists()) {
                    loginError.textContent = "Tài khoản chưa được cấp quyền truy cập hệ thống.";
                    setLoading(submitBtn, false, "Đăng nhập");
                    return;
                }

                redirectByRole(accountSnap.data().role);
            } catch (err) {
                console.error('[v0] Lỗi đăng nhập:', err);
                loginError.textContent = "Sai email hoặc mật khẩu.";
                setLoading(submitBtn, false, "Đăng nhập");
            }
        });
    }

    // ============================================================
    // ĐĂNG KÝ (tự phục vụ - chỉ được employee/investor, không được admin/hr)
    // ============================================================
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            registerError.textContent = "";

            const name = document.getElementById("register-name").value.trim();
            const email = document.getElementById("register-email").value.trim();
            const password = document.getElementById("register-password").value;
            const confirmPassword = document.getElementById("register-confirm").value;
            const requestedRole = document.getElementById("register-role").value;
            const submitBtn = registerForm.querySelector(".submit-btn");

            if (password !== confirmPassword) {
                registerError.textContent = "Mật khẩu xác nhận không khớp.";
                return;
            }

            if (password.length < 6) {
                registerError.textContent = "Mật khẩu phải từ 6 ký tự trở lên.";
                return;
            }

            // Chặn cứng ở phía client: dù ai đó sửa DOM để đổi value của select,
            // dòng dưới vẫn ép role về danh sách cho phép trước khi ghi Firestore.
            const safeRole = SELF_REGISTER_ALLOWED_ROLES.includes(requestedRole)
                ? requestedRole
                : "employee";

            setLoading(submitBtn, true, "Đăng ký");

            try {
                const cred = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(cred.user, { displayName: name });

                await setDoc(doc(db, "accounts", cred.user.uid), {
                    fullName: name,
                    email: email,
                    role: safeRole,
                    createdAt: new Date().toISOString()
                });

                alert("Tạo tài khoản thành công! Đang chuyển hướng...");
                redirectByRole(safeRole);
            } catch (err) {
                console.error('[v0] Lỗi đăng ký:', err);
                if (err.code === "auth/email-already-in-use") {
                    registerError.textContent = "Email này đã được đăng ký.";
                } else if (err.code === "auth/invalid-email") {
                    registerError.textContent = "Email không hợp lệ.";
                } else {
                    registerError.textContent = "Lỗi đăng ký: " + err.message;
                }
                setLoading(submitBtn, false, "Đăng ký");
            }
        });
    }

    // ============================================================
    // QUÊN MẬT KHẨU
    // ============================================================
    if (forgotForm) {
        forgotForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            forgotError.textContent = "";

            const email = document.getElementById("forgot-email").value.trim();
            const submitBtn = forgotForm.querySelector(".submit-btn");

            setLoading(submitBtn, true, "Gửi yêu cầu khôi phục");

            try {
                await sendPasswordResetEmail(auth, email);
                forgotError.style.color = "#22c55e";
                forgotError.textContent = "Đã gửi email khôi phục mật khẩu, vui lòng kiểm tra hộp thư.";
            } catch (err) {
                console.error('[v0] Lỗi gửi email khôi phục:', err);
                forgotError.style.color = "#ff5252";
                forgotError.textContent = "Không gửi được email khôi phục. Kiểm tra lại địa chỉ email.";
            } finally {
                setLoading(submitBtn, false, "Gửi yêu cầu khôi phục");
            }
        });
    }
});