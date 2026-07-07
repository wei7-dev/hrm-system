// mobile-guard.js
// Chặn truy cập trên thiết bị di động đối với tài khoản HR/Investor.
// Áp dụng cho TOÀN BỘ trang (index, admin, bao-cao-tai-chinh, chamcong, history,
// search-staff, search-date) bằng cách nhúng chung 1 file duy nhất, tránh lặp code.
//
// Logic: Staff luôn được dùng cả PC lẫn Mobile (để chấm công khi đi công tác).
// HR và Investor CHỈ được dùng trên PC — nếu quét thấy họ đang ở màn hình mobile,
// chặn toàn bộ tương tác bằng overlay phủ kín trang, không có cách nào tắt được
// ngoài việc chuyển sang máy tính.

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const HR_LIKE = ["admin", "hr"];
const RESTRICTED_ROLES = HR_LIKE.concat(["investor"]);

// Ngưỡng coi là "thiết bị di động": dựa theo độ rộng màn hình, đồng bộ với
// breakpoint @media (max-width: 768px) đang dùng trong toàn bộ CSS của dự án.
const MOBILE_BREAKPOINT = 768;

function isMobileViewport() {
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
}

function normalizeRole(rawRole) {
    if (typeof rawRole !== "string") return null;
    const normalized = rawRole.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
}

function buildOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "mobileGuardOverlay";
    overlay.innerHTML = `
        <button type="button" id="mobileGuardCloseBtn" aria-label="Đóng thông báo">&times;</button>
        <div class="mobile-guard-box">
            <svg viewBox="0 0 24 24" class="mobile-guard-icon">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <p>Xin lỗi, website này trên thiết bị di động chỉ hỗ trợ tài khoản Nhân viên (Staff). Vui lòng HR/Investor truy cập bằng máy tính (PC) để sử dụng đầy đủ tính năng.</p>
        </div>
    `;
    return overlay;
}

function injectOverlayStyles() {
    if (document.getElementById("mobileGuardStyles")) return;
    const style = document.createElement("style");
    style.id = "mobileGuardStyles";
    style.textContent = `
        #mobileGuardOverlay {
            position: fixed;
            inset: 0;
            z-index: 999999;
            background: rgba(5, 11, 20, 0.98);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 32px;
        }
        /* Chỉ khối chứa nút đăng nhập/avatar/đăng xuất nổi lên trên overlay,
           để HR/Investor luôn có đường đăng nhập lại hoặc đăng xuất. Không nổi
           toàn bộ header lên, tránh lộ luôn hamburger/menu điều hướng. */
        body.mobile-guard-locked .header-utilities {
            position: relative;
            z-index: 1000000;
        }
        #mobileGuardCloseBtn {
            position: absolute;
            top: 16px;
            left: 16px;
            width: 36px;
            height: 36px;
            border: none;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.08);
            color: #e2e8f0;
            font-size: 1.4rem;
            line-height: 1;
            cursor: pointer;
        }
        #mobileGuardOverlay .mobile-guard-box {
            max-width: 340px;
            text-align: center;
            color: #e2e8f0;
        }
        #mobileGuardOverlay .mobile-guard-icon {
            width: 56px;
            height: 56px;
            fill: #ff5252;
            margin-bottom: 20px;
        }
        #mobileGuardOverlay p {
            font-size: 0.95rem;
            line-height: 1.6;
        }
        /* Khi overlay đang hiện, khoá cuộn trang phía sau */
        body.mobile-guard-locked {
            overflow: hidden;
        }
    `;
    document.head.appendChild(style);
}

function showGuard() {
    injectOverlayStyles();
    if (document.getElementById("mobileGuardOverlay")) return; // đã hiện rồi, không tạo trùng
    const overlay = buildOverlay();
    document.body.appendChild(overlay);
    document.body.classList.add("mobile-guard-locked");

    // Nút X chỉ đóng tạm overlay để họ đọc được nội dung trang phía sau nếu cần
    // xem qua, KHÔNG tắt hẳn việc chặn. Ngay khi họ chạm/bấm vào bất kỳ đâu khác
    // trên trang, overlay sẽ hiện lại lập tức để nhắc lại giới hạn tài khoản.
    const closeBtn = overlay.querySelector("#mobileGuardCloseBtn");
    if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            hideGuard();
        });
    }
}

function hideGuard() {
    const overlay = document.getElementById("mobileGuardOverlay");
    if (overlay) overlay.remove();
    document.body.classList.remove("mobile-guard-locked");
}

function evaluateGuard(role) {
    const shouldBlock = isMobileViewport() && RESTRICTED_ROLES.includes(role);
    if (shouldBlock) {
        showGuard();
    } else {
        hideGuard();
    }
}

let currentRole = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        currentRole = null;
        hideGuard();
        return;
    }

    try {
        const accountSnap = await getDoc(doc(db, "accounts", user.uid));
        if (!accountSnap.exists()) {
            currentRole = null;
            hideGuard();
            return;
        }

        currentRole = normalizeRole(accountSnap.data().role);
        evaluateGuard(currentRole);
    } catch (err) {
        console.error('[mobile-guard] Lỗi kiểm tra role:', err);
    }
});

// Quét lại khi người dùng xoay ngang/dọc màn hình hoặc thay đổi kích thước cửa sổ
// (ví dụ kéo cửa sổ trình duyệt trên PC nhỏ lại dưới ngưỡng mobile).
window.addEventListener("resize", () => {
    if (currentRole) evaluateGuard(currentRole);
});

// Các khu vực KHÔNG bị chặn dù đang hiện overlay: nút đăng nhập, avatar/dropdown
// hồ sơ (bao gồm nút "Đăng xuất"), và modal đăng nhập. Để HR/Investor luôn có
// đường thoát (đăng xuất) hoặc đăng nhập lại, chỉ các tính năng nghiệp vụ khác
// (menu điều hướng, tra cứu, báo cáo...) mới bị chặn và nhắc lên PC.
const ALLOWED_SELECTORS = [
    "#openLoginBtn",
    "#profileTrigger",
    "#profileDropdown",
    "#loginModal",
    "#mobileGuardOverlay"
];

function isInsideAllowedArea(target) {
    return ALLOWED_SELECTORS.some(selector => target.closest(selector));
}

// Nếu HR/Investor đã đóng thông báo (nút X) rồi cố thao tác tiếp với trang
// (chạm menu, bấm nút, cuộn...), hiện lại overlay ngay để nhắc họ tài khoản
// không được dùng trên mobile. Dùng capture phase để bắt được sự kiện sớm
// nhất, trước khi các listener khác trong trang kịp xử lý.
["click", "touchstart"].forEach(evtName => {
    document.addEventListener(evtName, (e) => {
        if (!currentRole || !RESTRICTED_ROLES.includes(currentRole)) return;
        if (!isMobileViewport()) return;
        // Bỏ qua nút đăng nhập/hồ sơ/đăng xuất và chính overlay/nút X
        if (isInsideAllowedArea(e.target)) return;
        showGuard();
    }, true);
});