// profile-menu.js
// Sau khi đăng nhập thành công: ẩn nút "Đăng nhập", hiện profile dropdown
// (họ tên, email, chức vụ) với các mục menu ẩn/hiện theo role, và modal
// "Lịch sử hoạt động" hiển thị dạng hoá đơn (receipt).

import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ROLE_INFO = {
    admin: { label: "HR", full: "Quản trị viên (HR)", cssClass: "role-hr" },
    hr:    { label: "HR", full: "Nhân sự (HR)", cssClass: "role-hr" },
    employee: { label: "Staff", full: "Nhân viên chính thức", cssClass: "role-staff" },
    staff:    { label: "Staff", full: "Nhân viên", cssClass: "role-staff" },
    nv:       { label: "Staff", full: "Nhân viên chính thức", cssClass: "role-staff" },
    sv:       { label: "Staff", full: "Sinh viên thực tập", cssClass: "role-staff" },
    tt:       { label: "Staff", full: "Thực tập sinh", cssClass: "role-staff" },
    investor: { label: "INV", full: "Nhà đầu tư", cssClass: "role-investor" }
};

const STAFF_LIKE = ["employee", "staff", "nv", "sv", "tt"];
const HR_LIKE = ["admin", "hr"];
const ALL_KNOWN_ROLES = [...STAFF_LIKE, ...HR_LIKE, "investor"];

// Chuẩn hoá role lấy từ Firestore: cắt khoảng trắng thừa, đưa về chữ thường,
// tránh trường hợp role lưu sai định dạng (" Staff", "STAFF"...) khiến so sánh sai
// và menu nhạy cảm bị hiện nhầm cho role không đủ quyền.
function normalizeRole(rawRole) {
    if (typeof rawRole !== "string") return null;
    const normalized = rawRole.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
}

function getInitial(name, email) {
    const source = (name || email || "U").trim();
    return source.charAt(0).toUpperCase();
}

document.addEventListener("DOMContentLoaded", () => {
    const openLoginBtn = document.getElementById("openLoginBtn");
    const profileMenu = document.getElementById("profileMenu");
    const profileTrigger = document.getElementById("profileTrigger");
    const profileAvatar = document.getElementById("profileAvatar");
    const profileAvatarLarge = document.getElementById("profileAvatarLarge");
    const profileRoleBadge = document.getElementById("profileRoleBadge");
    const profileName = document.getElementById("profileName");
    const profileEmail = document.getElementById("profileEmail");
    const profileRoleFull = document.getElementById("profileRoleFull");
    const profileMenuHistory = document.getElementById("profileMenuHistory");
    const profileMenuAdmin = document.getElementById("profileMenuAdmin");
    const profileMenuReport = document.getElementById("profileMenuReport");
    const logoutBtn = document.getElementById("logoutBtn");

    const openHistoryBtn = document.getElementById("openHistoryBtn");
    const historyModal = document.getElementById("historyModal");
    const historyModalOverlay = document.getElementById("historyModalOverlay");
    const closeHistoryBtn = document.getElementById("closeHistoryBtn");
    const closeHistoryBtnBottom = document.getElementById("closeHistoryBtnBottom");
    const receiptContent = document.getElementById("receiptContent");

    let currentUserData = null;

    // Toggle mở/đóng dropdown
    if (profileTrigger) {
        profileTrigger.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            profileMenu.classList.toggle("open");
        });
    }

    document.addEventListener("click", (e) => {
        if (profileMenu && !profileMenu.contains(e.target)) {
            profileMenu.classList.remove("open");
        }
    });

    // Đăng xuất
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            await signOut(auth);
            window.location.href = "index.html";
        });
    }

    // Mở/đóng modal lịch sử
    function openHistoryModal() {
        profileMenu.classList.remove("open");
        historyModal.classList.add("open");
        renderReceipt();
    }
    function closeHistoryModal() {
        historyModal.classList.remove("open");
    }

    if (openHistoryBtn) {
        openHistoryBtn.addEventListener("click", (e) => {
            e.preventDefault();
            openHistoryModal();
        });
    }
    if (closeHistoryBtn) closeHistoryBtn.addEventListener("click", closeHistoryModal);
    if (closeHistoryBtnBottom) closeHistoryBtnBottom.addEventListener("click", closeHistoryModal);
    if (historyModalOverlay) historyModalOverlay.addEventListener("click", closeHistoryModal);

    // ============================================================
    // Render "hoá đơn" lịch sử — nội dung khác nhau tuỳ role
    // ============================================================
    async function renderReceipt() {
        if (!currentUserData) return;
        const { role, fullName, email } = currentUserData;
        const roleInfo = ROLE_INFO[role] || { full: role };
        const now = new Date();
        const dateStr = now.toLocaleDateString("vi-VN");
        const timeStr = now.toLocaleTimeString("vi-VN", { hour12: false });

        receiptContent.innerHTML = `
            <div class="receipt-header">
                <span class="receipt-title">HRM SYSTEM</span>
                <span class="receipt-sub">Phiếu lịch sử hoạt động</span>
            </div>
            <div class="receipt-row"><span class="r-label">Họ tên</span><span class="r-value">${fullName || '--'}</span></div>
            <div class="receipt-row"><span class="r-label">Email</span><span class="r-value">${email || '--'}</span></div>
            <div class="receipt-row"><span class="r-label">Chức vụ</span><span class="r-value">${roleInfo.full}</span></div>
            <div class="receipt-row"><span class="r-label">Xuất phiếu lúc</span><span class="r-value">${timeStr} ${dateStr}</span></div>
            <hr class="receipt-divider">
            <div id="receiptEntries"><div class="receipt-empty">Đang tải...</div></div>
            <div class="receipt-footer">— Hết phiếu —</div>
        `;

        const entriesBox = document.getElementById("receiptEntries");

        try {
            if (HR_LIKE.includes(role) || STAFF_LIKE.includes(role)) {
                // HR + Staff: lịch sử chấm công gần nhất của chính user đó
                await renderAttendanceReceipt(entriesBox, currentUserData);
            } else if (role === "investor") {
                // Nhà đầu tư: lịch sử xem báo cáo (mô phỏng, vì không có hành vi ghi log thật)
                renderInvestorReceipt(entriesBox);
            } else {
                entriesBox.innerHTML = `<div class="receipt-empty">Không có lịch sử để hiển thị.</div>`;
            }
        } catch (err) {
            console.error('[v0] Lỗi tải lịch sử:', err);
            entriesBox.innerHTML = `<div class="receipt-empty">Không tải được lịch sử, thử lại sau.</div>`;
        }
    }

    async function renderAttendanceReceipt(container, userData) {
        // Cần userData.employeeId để đối chiếu attendance — nếu tài khoản
        // chưa gắn với mã nhân viên (employeeId) trong accounts/{uid} thì báo rỗng.
        if (!userData.employeeId) {
            container.innerHTML = `<div class="receipt-empty">Tài khoản chưa liên kết mã nhân viên, không có lịch sử chấm công.</div>`;
            return;
        }

        const attendanceRef = collection(db, "attendance");
        const q = query(
            attendanceRef,
            where("employeeId", "==", userData.employeeId),
            orderBy("date", "desc"),
            limit(10)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = `<div class="receipt-empty">Chưa có lượt chấm công nào.</div>`;
            return;
        }

        container.innerHTML = snapshot.docs.map(d => {
            const data = d.data();
            const checkIn = data.checkIn?.toDate ? data.checkIn.toDate().toLocaleTimeString("vi-VN", { hour12: false }) : "--:--:--";
            const checkOut = data.checkOut?.toDate ? data.checkOut.toDate().toLocaleTimeString("vi-VN", { hour12: false }) : "--:--:--";
            return `
                <div class="receipt-entry">
                    <div class="r-title">Chấm công ${data.date || ''}</div>
                    <div class="r-meta">Vào: ${checkIn} · Ra: ${checkOut} · ${data.status || 'Đang làm'}</div>
                </div>
            `;
        }).join('');
    }

    function renderInvestorReceipt(container) {
        // Không có log thật cho hành vi "xem báo cáo", nên hiển thị mô phỏng có gắn nhãn rõ ràng.
        const mockViews = [
            { title: "Xem báo cáo tài chính Q2 2026", meta: "Truy cập gần nhất" },
            { title: "Xem dự phóng tăng trưởng 24 tháng", meta: "3 ngày trước" },
            { title: "Xem lộ trình dự án tương lai", meta: "1 tuần trước" }
        ];

        container.innerHTML = `<div class="receipt-empty" style="padding:6px 0 14px;font-size:0.72rem;">* Dữ liệu mô phỏng minh hoạ, chưa nối log truy cập thật</div>` +
            mockViews.map(v => `
                <div class="receipt-entry">
                    <div class="r-title">${v.title}</div>
                    <div class="r-meta">${v.meta}</div>
                </div>
            `).join('');
    }

    // Ẩn hết menu "Tra cứu" trên nav chính — dùng khi chưa đăng nhập, tài khoản
    // không tồn tại trong Firestore, hoặc role không hợp lệ.
    function hideNavTraCuu() {
        ["menuChamCong", "menuSearchStaff", "menuSearchDate", "menuSearchHistory", "navTraCuuParent"]
            .forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = "none";
            });
    }

    // ============================================================
    // Cập nhật giao diện profile theo trạng thái đăng nhập
    // ============================================================
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            if (openLoginBtn) openLoginBtn.style.display = "";
            if (profileMenu) profileMenu.style.display = "none";
            hideNavTraCuu();
            currentUserData = null;
            return;
        }

        try {
            const accountSnap = await getDoc(doc(db, "accounts", user.uid));
            if (!accountSnap.exists()) {
                if (openLoginBtn) openLoginBtn.style.display = "";
                if (profileMenu) profileMenu.style.display = "none";
                hideNavTraCuu();
                return;
            }

            const data = accountSnap.data();
            const role = normalizeRole(data.role);

            // An toàn theo mặc định: nếu role thiếu/sai định dạng/không nằm trong danh
            // sách đã biết -> coi như không đăng nhập hợp lệ, ẩn hết thay vì để lộ menu
            // theo trạng thái mặc định lỡ bị đổi trước đó.
            if (!role || !ALL_KNOWN_ROLES.includes(role)) {
                console.warn('[profile-menu] Role không hợp lệ hoặc không xác định:', data.role);
                if (openLoginBtn) openLoginBtn.style.display = "";
                if (profileMenu) profileMenu.style.display = "none";
                hideNavTraCuu();
                currentUserData = null;
                return;
            }

            const roleInfo = ROLE_INFO[role] || { label: role, full: role, cssClass: "" };

            currentUserData = {
                role,
                fullName: data.fullName || user.displayName || "Người dùng",
                email: data.email || user.email || "--",
                employeeId: data.employeeId || null
            };

            // Ẩn nút đăng nhập, hiện profile
            if (openLoginBtn) openLoginBtn.style.display = "none";
            if (profileMenu) profileMenu.style.display = "";

            // Reset class role cũ rồi gán class role mới
            profileMenu.classList.remove("role-hr", "role-staff", "role-investor");
            if (roleInfo.cssClass) profileMenu.classList.add(roleInfo.cssClass);

            const initial = getInitial(currentUserData.fullName, currentUserData.email);
            if (profileAvatar) profileAvatar.textContent = initial;
            if (profileAvatarLarge) profileAvatarLarge.textContent = initial;
            if (profileRoleBadge) profileRoleBadge.textContent = roleInfo.label;
            if (profileName) profileName.textContent = currentUserData.fullName;
            if (profileEmail) profileEmail.textContent = currentUserData.email;
            if (profileRoleFull) profileRoleFull.textContent = roleInfo.full;

            // Ẩn/hiện các mục menu theo role
            const isHR = HR_LIKE.includes(role);
            const isStaff = STAFF_LIKE.includes(role);
            const isInvestor = role === "investor";

            if (profileMenuHistory) profileMenuHistory.style.display = (isHR || isStaff || isInvestor) ? "" : "none";
            if (profileMenuAdmin) profileMenuAdmin.style.display = isHR ? "" : "none";
            if (profileMenuReport) profileMenuReport.style.display = isInvestor ? "" : "none";

            // Menu "Tra cứu" trên thanh nav chính (Chấm công / Tra cứu nhân viên /
            // Tra cứu lịch làm / Lịch sử tra cứu): CHỈ dành cho Staff, dùng khi họ
            // cần chấm công/tra cứu từ điện thoại lúc không có PC (đi công tác, quên
            // chấm công...). HR không cần vì làm việc trực tiếp trên web/hệ thống quản
            // trị, tuyển dụng qua thẻ QR riêng. Investor không cần vì họ chỉ quan tâm
            // báo cáo tài chính/định hướng công ty, không liên quan nghiệp vụ nội bộ.
            const navMenuChamCong = document.getElementById("menuChamCong");
            const navMenuSearchStaff = document.getElementById("menuSearchStaff");
            const navMenuSearchDate = document.getElementById("menuSearchDate");
            const navMenuSearchHistory = document.getElementById("menuSearchHistory");
            const navTraCuuParent = document.getElementById("navTraCuuParent");

            if (navMenuChamCong) navMenuChamCong.style.display = isStaff ? "" : "none";
            if (navMenuSearchStaff) navMenuSearchStaff.style.display = isStaff ? "" : "none";
            if (navMenuSearchDate) navMenuSearchDate.style.display = isStaff ? "" : "none";
            if (navMenuSearchHistory) navMenuSearchHistory.style.display = isStaff ? "" : "none";

            // Nếu không còn mục con nào hiển thị (HR, Investor), ẩn luôn nút cha
            // "Tra cứu" trên nav để không hiện một dropdown rỗng.
            if (navTraCuuParent) {
                navTraCuuParent.style.display = isStaff ? "" : "none";
            }

        } catch (err) {
            console.error('[v0] Lỗi tải profile:', err);
            if (openLoginBtn) openLoginBtn.style.display = "";
            if (profileMenu) profileMenu.style.display = "none";
        }
    });
});
