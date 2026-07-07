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

// Mảng chứa nhật ký tìm kiếm trong phiên làm việc
let searchLogs = [];
let allEmployees = [];

// DOM Elements
const monthFilter = document.getElementById("monthFilter");
const employeeFilter = document.getElementById("employeeFilter");
const scheduleTable = document.getElementById("scheduleTable");
const recordCountText = document.getElementById("recordCountText") || document.querySelector(".record-count");
const searchHistoryList = document.getElementById("searchHistoryList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const currentTimeDisplay = document.getElementById("currentTime");

function startRealTimeClock() {
    if (!currentTimeDisplay) return;
    const updateClock = () => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        currentTimeDisplay.textContent = `${hours}:${minutes}:${seconds}`;
    };
    updateClock();
    setInterval(updateClock, 1000);
}
startRealTimeClock();

// Điền sẵn ngày hôm nay vào ô lọc, mask an toàn: chỉ tự chèn "/" khi gõ thêm, không rebuild khi xóa/sửa giữa chừng
function setupDateInputMask() {
    if (!monthFilter) return;

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const todayStr = `${dd}/${mm}/${yyyy}`;

    monthFilter.value = todayStr;

    monthFilter.addEventListener("keydown", (e) => {
        const isDigit = /^[0-9]$/.test(e.key);
        if (!isDigit) return;

        const cursorPos = monthFilter.selectionStart;
        const digitsBeforeCursor = monthFilter.value.slice(0, cursorPos).replace(/\D/g, "").length;

        if ((digitsBeforeCursor === 2 || digitsBeforeCursor === 4) && monthFilter.value[cursorPos] !== '/') {
            e.preventDefault();
            const newValue = monthFilter.value.slice(0, cursorPos) + e.key + '/' + monthFilter.value.slice(cursorPos + (monthFilter.value[cursorPos] === '/' ? 1 : 0));
            monthFilter.value = newValue.slice(0, 10);
            monthFilter.setSelectionRange(cursorPos + 2, cursorPos + 2);
        }
    });

    monthFilter.addEventListener("input", (e) => {
        e.target.value = e.target.value.replace(/[^\d/]/g, "").slice(0, 10);
    });
}
setupDateInputMask();

// Đổ danh sách nhân viên từ Firestore vào select
async function loadEmployeeOptions() {
    if (!employeeFilter) return;
    try {
        const snapshot = await getDocs(collection(db, "nhan_vien_chinh_thuc"));
        allEmployees = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        const options = allEmployees.map(emp => {
            const id = emp.employeeId || emp.id;
            const name = emp.fullName || id;
            return `<option value="${id}">${id} - ${name}</option>`;
        }).join('');

        employeeFilter.innerHTML = `<option value="">Tất cả nhân viên</option>${options}`;
    } catch (err) {
        console.error('[v0] Lỗi tải danh sách nhân viên:', err);
    }
}

// Chuyển "d/m/yyyy" hoặc "dd/mm/yyyy" người dùng nhập thành "yyyy-mm-dd" để so khớp field "date" trong Firestore
function parseDateInput(value) {
    const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Lấy lịch làm từ collection "attendance", lọc theo ngày và/hoặc mã nhân viên
async function fetchSchedule(dateInput, employeeId) {
    const attendanceRef = collection(db, "attendance");
    const conditions = [];

    if (dateInput) {
        const dateId = parseDateInput(dateInput);
        if (!dateId) return [];
        conditions.push(where("date", "==", dateId));
    }
    if (employeeId) conditions.push(where("employeeId", "==", employeeId));

    const q = conditions.length > 0 ? query(attendanceRef, ...conditions) : query(attendanceRef);
    const snapshot = await getDocs(q);

    return snapshot.docs.map(d => {
        const data = d.data();
        const parsed = parseEmployeeCode(data.employeeId);
        const checkInDate = data.checkIn?.toDate ? data.checkIn.toDate() : null;
        const checkOutDate = data.checkOut?.toDate ? data.checkOut.toDate() : null;

        let totalHours = '0';
        if (checkInDate && checkOutDate) {
            totalHours = ((checkOutDate - checkInDate) / 3600000).toFixed(1);
        }

        return {
            date: data.date || '---',
            department: data.department || parsed.department || '---',
            employee: data.employeeName || data.employeeId || '---',
            shift: checkInDate && checkInDate.getHours() < 12 ? 'Ca sáng' : 'Ca chiều',
            checkIn: checkInDate ? formatTime(checkInDate) : '--:--:--',
            checkOut: checkOutDate ? formatTime(checkOutDate) : '--:--:--',
            totalHours,
            status: data.status || 'Đang làm'
        };
    });
}

function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function renderTable(data) {
    if (!scheduleTable) return;
    scheduleTable.innerHTML = "";

    if (!data || data.length === 0) {
        scheduleTable.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #94a3b8;">Không tìm thấy lịch làm việc phù hợp.</td></tr>`;
        if (recordCountText) recordCountText.textContent = "0 ca làm";
        return;
    }

    data.forEach(item => {
        let statusClass = "working";
        if (item.status === "Đi trễ") statusClass = "late";
        if (item.status === "Đã về") statusClass = "done";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${item.date || '---'}</td>
            <td>${item.department || '---'}</td>
            <td>${item.employee || '---'}</td>
            <td>${item.shift || '---'}</td>
            <td>${item.checkIn || '--:--:--'}</td>
            <td>${item.checkOut || '--:--:--'}</td>
            <td>${item.totalHours || '0'}h</td>
            <td><span class="status ${statusClass}">${item.status || 'Đang làm'}</span></td>
        `;
        scheduleTable.appendChild(row);
    });

    if (recordCountText) {
        recordCountText.textContent = `${data.length} ca làm`;
    }
}

function updateHistoryUI() {
    if (!searchHistoryList) return;
    searchHistoryList.innerHTML = "";

    if (searchLogs.length === 0) {
        searchHistoryList.innerHTML = `<li class="history-empty" id="history-empty">Chưa có lượt tra cứu nào trong phiên này.</li>`;
        return;
    }

    searchLogs.forEach(log => {
        const li = document.createElement("li");
        li.className = "history-item";
        li.innerHTML = `
            <div class="log-info">
                <strong>${log.employeeName}</strong>
                <span style="display:block; font-size:0.8rem; color:#94a3b8;">Ngày lọc: ${log.dateQuery}</span>
            </div>
            <span class="time-stamp">${log.timestamp}</span>
        `;
        searchHistoryList.appendChild(li);
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    if (recordCountText) recordCountText.textContent = "0 ca làm";
    if (scheduleTable) {
        scheduleTable.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #94a3b8;">Đang tải dữ liệu...</td></tr>`;
    }

    await loadEmployeeOptions();
    updateHistoryUI();
});

document.getElementById("searchBtn").addEventListener("click", async () => {
    const dateInput = monthFilter ? monthFilter.value.trim() : "";
    const selectedEmployeeId = employeeFilter ? employeeFilter.value : "";

    scheduleTable.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #94a3b8;">Đang tìm...</td></tr>`;

    let results = [];
    try {
        results = await fetchSchedule(dateInput, selectedEmployeeId);
    } catch (err) {
        console.error('[v0] Lỗi tra cứu lịch làm:', err);
        scheduleTable.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #ff5252;">Lỗi kết nối Firebase.</td></tr>`;
        return;
    }

    renderTable(results);

    const now = new Date();
    const timeStr = formatTime(now);

    const selectedOption = employeeFilter.options[employeeFilter.selectedIndex];
    const employeeText = selectedEmployeeId === "" ? "Tất cả nhân viên" : selectedOption.textContent;

    searchLogs.unshift({
        employeeName: employeeText,
        dateQuery: dateInput || "Tất cả",
        timestamp: timeStr
    });

    if (searchLogs.length > 5) {
        searchLogs.pop();
    }

    updateHistoryUI();
});

if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
        searchLogs = [];
        updateHistoryUI();
    });
}