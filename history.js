import { db } from "./firebase.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Bảng viết tắt chức vụ / phòng ban theo mã nhân viên (khớp form HR)
const POSITION_CODES = {
    'NV': 'Chính thức (NV)',
    'SV': 'Sinh viên thử việc (SV)',
    'TT': 'Thực tập sinh (TT)'
};

const DEPARTMENT_CODES = {
    'IT': 'Công nghệ thông tin (IT)',
    'HR': 'Quản trị nhân sự (HR)',
    'MKT': 'Marketing (MKT)',
    'ACC': 'Kế toán tài chính (ACC)',
    'SALES': 'Phòng Kinh doanh (SALES)'
};

function parseEmployeeCode(employeeId) {
    const parts = (employeeId || '').split('-');
    if (parts.length < 2) return { position: null, department: null };
    return {
        position: POSITION_CODES[parts[0].toUpperCase()] || null,
        department: DEPARTMENT_CODES[parts[1].toUpperCase()] || null
    };
}

function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

// Chuyển "dd/mm/yyyy" thành "yyyy-mm-dd" để so khớp field "date" trong Firestore
function parseDateInput(value) {
    const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

document.addEventListener("DOMContentLoaded", () => {

    // 1. ĐỒNG HỒ REALTIME HEADER
    const currentTimeDisplay = document.getElementById("currentTime");
    function updateClock() {
        const now = new Date();
        currentTimeDisplay.textContent = now.toLocaleTimeString("vi-VN", { hour12: false });
    }
    updateClock();
    setInterval(updateClock, 1000);

    // 2. Ô NHẬP KHOẢNG NGÀY (dd/mm/yyyy), tự chèn dấu "/" khi gõ
    const fromDateFilter = document.getElementById("fromDateFilter");
    const toDateFilter = document.getElementById("toDateFilter");

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const todayStr = `${dd}/${mm}/${yyyy}`;

    fromDateFilter.value = todayStr;
    toDateFilter.value = todayStr;

    // Mask an toàn: chỉ tự chèn "/" khi người dùng GÕ THÊM (không đụng vào khi xóa/sửa giữa chừng)
    function attachDateMask(input) {
        input.addEventListener("keydown", (e) => {
            const isDigit = /^[0-9]$/.test(e.key);
            if (!isDigit) return;

            const cursorPos = input.selectionStart;
            const digitsBeforeCursor = input.value.slice(0, cursorPos).replace(/\D/g, "").length;

            // Sau khi gõ số thứ 2 (ngày) hoặc số thứ 4 (tháng), tự chèn "/" ngay sau con trỏ
            if (digitsBeforeCursor === 2 && input.value[cursorPos] !== '/') {
                e.preventDefault();
                const newValue = input.value.slice(0, cursorPos) + e.key + '/' + input.value.slice(cursorPos + (input.value[cursorPos] === '/' ? 1 : 0));
                input.value = newValue.slice(0, 10);
                input.setSelectionRange(cursorPos + 2, cursorPos + 2);
            } else if (digitsBeforeCursor === 4 && input.value[cursorPos] !== '/') {
                e.preventDefault();
                const newValue = input.value.slice(0, cursorPos) + e.key + '/' + input.value.slice(cursorPos + (input.value[cursorPos] === '/' ? 1 : 0));
                input.value = newValue.slice(0, 10);
                input.setSelectionRange(cursorPos + 2, cursorPos + 2);
            }
        });

        input.addEventListener("input", (e) => {
            // Chặn ký tự không phải số hoặc "/", không rebuild lại toàn bộ chuỗi
            e.target.value = e.target.value.replace(/[^\d/]/g, "").slice(0, 10);
        });
    }

    attachDateMask(fromDateFilter);
    attachDateMask(toDateFilter);

    // 3. ĐỔ DANH SÁCH NHÂN VIÊN THẬT TỪ FIRESTORE VÀO SELECT
    const employeeFilter = document.getElementById("employeeFilter");

    async function loadEmployeeOptions() {
        try {
            const snapshot = await getDocs(collection(db, "nhan_vien_chinh_thuc"));
            const employees = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            const options = employees.map(emp => {
                const id = emp.employeeId || emp.id;
                const name = emp.fullName || id;
                return `<option value="${id}">${id} - ${name}</option>`;
            }).join('');

            employeeFilter.innerHTML = `<option value="">Tất cả nhân viên</option>${options}`;
        } catch (err) {
            console.error('[v0] Lỗi tải danh sách nhân viên:', err);
        }
    }

    // 4. TRUY VẤN LỊCH LÀM VIỆC TỪ COLLECTION "attendance"
    const tableBody = document.getElementById("scheduleTable");
    const recordCountText = document.getElementById("recordCountText");

    function renderTable(data) {
        tableBody.innerHTML = "";
        recordCountText.textContent = `${data.length} ca làm`;

        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #94a3b8;">Không tìm thấy lịch làm việc phù hợp.</td></tr>`;
            return;
        }

        data.forEach(item => {
            let statusClass = "working";
            if (item.status === "Đi trễ") statusClass = "late";
            if (item.status === "Đã về") statusClass = "done";

            tableBody.innerHTML += `
                <tr>
                    <td><strong>${item.date}</strong></td>
                    <td>${item.department}</td>
                    <td>${item.employee}</td>
                    <td>${item.shift}</td>
                    <td>${item.checkin}</td>
                    <td>${item.checkout}</td>
                    <td>${item.hours}</td>
                    <td><span class="status ${statusClass}">${item.status}</span></td>
                </tr>
            `;
        });
    }

    async function fetchSchedule(fromDateId, toDateId, employeeId) {
        const attendanceRef = collection(db, "attendance");
        const conditions = [];

        if (fromDateId) conditions.push(where("date", ">=", fromDateId));
        if (toDateId) conditions.push(where("date", "<=", toDateId));
        if (employeeId) conditions.push(where("employeeId", "==", employeeId));

        const q = conditions.length > 0 ? query(attendanceRef, ...conditions) : query(attendanceRef);
        const snapshot = await getDocs(q);

        return snapshot.docs.map(d => {
            const data = d.data();
            const parsed = parseEmployeeCode(data.employeeId);
            const checkInDate = data.checkIn?.toDate ? data.checkIn.toDate() : null;
            const checkOutDate = data.checkOut?.toDate ? data.checkOut.toDate() : null;

            let hours = '0h';
            if (checkInDate && checkOutDate) {
                hours = `${((checkOutDate - checkInDate) / 3600000).toFixed(1)}h`;
            }

            return {
                date: data.date || '---',
                department: data.department || parsed.department || '---',
                employee: data.employeeName || data.employeeId || '---',
                shift: checkInDate && checkInDate.getHours() < 12 ? 'Ca sáng' : 'Ca chiều',
                checkin: checkInDate ? formatTime(checkInDate) : '--:--:--',
                checkout: checkOutDate ? formatTime(checkOutDate) : '--:--:--',
                hours,
                status: data.status || 'Đang làm'
            };
        }).sort((a, b) => (a.date < b.date ? 1 : -1));
    }

    // 5. NHẬT KÝ TRA CỨU
    let searchLogs = [];
    const historyListContainer = document.getElementById("searchHistoryList");
    const clearHistoryBtn = document.getElementById("clearHistoryBtn");

    function updateHistoryUI() {
        if (searchLogs.length === 0) {
            historyListContainer.innerHTML = `<li class="history-empty">Chưa có lượt tra cứu nào trong phiên này.</li>`;
            return;
        }

        historyListContainer.innerHTML = "";
        searchLogs.forEach(log => {
            historyListContainer.innerHTML += `
                <li class="history-item">
                    <span class="search-query">
                        Tra cứu: <text-highlight>${log.employeeName}</text-highlight> từ <text-highlight>${log.fromDate}</text-highlight> đến <text-highlight>${log.toDate}</text-highlight>
                    </span>
                    <span class="time-stamp">${log.timestamp}</span>
                </li>
            `;
        });
    }

    // 6. SỰ KIỆN BẤM "XEM LỊCH"
    document.getElementById("searchBtn").addEventListener("click", async () => {
        const fromInput = fromDateFilter.value.trim();
        const toInput = toDateFilter.value.trim();
        const selectedEmployeeId = employeeFilter.value;

        const fromDateId = fromInput ? parseDateInput(fromInput) : null;
        const toDateId = toInput ? parseDateInput(toInput) : null;

        if ((fromInput && !fromDateId) || (toInput && !toDateId)) {
            renderTable([]);
            return;
        }

        tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #94a3b8;">Đang tìm...</td></tr>`;

        let results = [];
        try {
            results = await fetchSchedule(fromDateId, toDateId, selectedEmployeeId);
        } catch (err) {
            console.error('[v0] Lỗi tra cứu lịch sử:', err);
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #ff5252;">Lỗi kết nối Firebase.</td></tr>`;
            return;
        }

        renderTable(results);

        const now = new Date();
        const timeStr = now.toLocaleTimeString("vi-VN", { hour12: false });
        const selectedOption = employeeFilter.options[employeeFilter.selectedIndex];
        const employeeText = selectedEmployeeId === "" ? "Tất cả nhân viên" : selectedOption.textContent;

        searchLogs.unshift({
            employeeName: employeeText,
            fromDate: fromInput || "Không giới hạn",
            toDate: toInput || "Không giới hạn",
            timestamp: timeStr
        });

        if (searchLogs.length > 5) {
            searchLogs.pop();
        }

        updateHistoryUI();
    });

    clearHistoryBtn.addEventListener("click", () => {
        searchLogs = [];
        updateHistoryUI();
    });

    // Khởi tạo: tải danh sách nhân viên rồi hiển thị lịch làm hôm nay
    (async function init() {
        recordCountText.textContent = "Đang tải ca làm...";
        await loadEmployeeOptions();

        const fromDateId = parseDateInput(fromDateFilter.value);
        const toDateId = parseDateInput(toDateFilter.value);

        try {
            const initialData = await fetchSchedule(fromDateId, toDateId, "");
            renderTable(initialData);
        } catch (err) {
            console.error('[v0] Lỗi tải lịch làm ban đầu:', err);
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #ff5252;">Lỗi kết nối Firebase.</td></tr>`;
        }
    })();
});