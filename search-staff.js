import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM Elements
const searchEmployeeId = document.getElementById('searchEmployeeId');
const searchEmployeeName = document.getElementById('searchEmployeeName');
const searchDepartment = document.getElementById('searchDepartment');
const searchBtn = document.getElementById('searchBtn');
const employeeTable = document.getElementById('employeeTable');
const currentTimeDisplay = document.getElementById('currentTime');

// Đồng hồ header
function updateCurrentTime() {
    if (!currentTimeDisplay) return;
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    currentTimeDisplay.textContent = `${hours}:${minutes}:${seconds}`;
}
setInterval(updateCurrentTime, 1000);
updateCurrentTime();

// Cache toàn bộ nhân viên để lọc client-side (Firestore không hỗ trợ search "chứa" chuỗi trực tiếp)
let allEmployees = [];
let hasLoaded = false;

// Bảng viết tắt chức vụ theo mã nhân viên (khớp select "Phân loại đối tượng" của HR)
const POSITION_CODES = {
    'NV': 'Chính thức (NV)',
    'SV': 'Sinh viên thử việc (SV)',
    'TT': 'Thực tập sinh (TT)'
};

// Bảng viết tắt phòng ban theo mã nhân viên (khớp select "Ngành / Khối phòng ban công tác" của HR)
const DEPARTMENT_CODES = {
    'IT': 'Công nghệ thông tin (IT)',
    'HR': 'Quản trị nhân sự (HR)',
    'MKT': 'Marketing (MKT)',
    'ACC': 'Kế toán tài chính (ACC)',
    'SALES': 'Phòng Kinh doanh (SALES)'
};

// Suy ra chức vụ + phòng ban từ cấu trúc mã NV dạng "SV-MKT-000"
function parseEmployeeCode(employeeId) {
    const parts = (employeeId || '').split('-');
    if (parts.length < 2) return { position: null, department: null };

    const positionCode = parts[0].toUpperCase();
    const deptCode = parts[1].toUpperCase();

    return {
        position: POSITION_CODES[positionCode] || null,
        department: DEPARTMENT_CODES[deptCode] || null
    };
}
async function loadAllEmployees() {
    try {
        const snapshot = await getDocs(collection(db, "nhan_vien_chinh_thuc"));
        allEmployees = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        hasLoaded = true;
        console.log('[v0] Đã tải', allEmployees.length, 'nhân viên từ Firestore');
        buildDepartmentOptions();
    } catch (err) {
        console.error('[v0] Lỗi tải danh sách nhân viên:', err);
        employeeTable.innerHTML = `<tr><td colspan="5">Lỗi kết nối Firebase, thử lại sau.</td></tr>`;
    }
}

// Sinh danh sách phòng ban trong select từ dữ liệu Firestore thật, không gõ tay cứng nữa
function buildDepartmentOptions() {
    if (!searchDepartment) return;

    const departments = [...new Set(
        allEmployees
            .map(emp => emp.department || emp.phongBan || parseEmployeeCode(emp.employeeId || emp.id).department)
            .filter(Boolean)
    )].sort();

    const currentValue = searchDepartment.value;
    searchDepartment.innerHTML = `<option value="">Tất cả phòng ban</option>` +
        departments.map(dept => `<option value="${dept}">${dept}</option>`).join('');

    if (departments.includes(currentValue)) {
        searchDepartment.value = currentValue;
    }
}

// Render kết quả ra bảng
function renderResults(list) {
    if (!employeeTable) return;

    if (list.length === 0) {
        employeeTable.innerHTML = `<tr><td colspan="5">Không tìm thấy nhân viên phù hợp.</td></tr>`;
        return;
    }

    employeeTable.innerHTML = list.map(emp => {
        const id = emp.employeeId || emp.id;
        const name = emp.fullName || 'Không rõ tên';
        const parsed = parseEmployeeCode(id);
        const department = emp.department || emp.phongBan || parsed.department || '--';
        const position = emp.position || emp.chucVu || parsed.position || '--';
        const isActive = emp.status ? emp.status === 'active' : true;
        const statusClass = isActive ? 'active' : 'inactive';
        const statusText = isActive ? 'Đang làm việc' : 'Đã nghỉ';

        return `
            <tr>
                <td>${id}</td>
                <td>${name}</td>
                <td>${department}</td>
                <td>${position}</td>
                <td><span class="status ${statusClass}">${statusText}</span></td>
            </tr>
        `;
    }).join('');
}

// Lọc theo mã NV / họ tên / phòng ban (không phân biệt hoa thường, tìm theo "chứa")
function filterEmployees() {
    const idQuery = (searchEmployeeId?.value || '').trim().toLowerCase();
    const nameQuery = (searchEmployeeName?.value || '').trim().toLowerCase();
    const deptQuery = searchDepartment?.value || '';

    return allEmployees.filter(emp => {
        const empId = (emp.employeeId || emp.id || '').toLowerCase();
        const empName = (emp.fullName || '').toLowerCase();
        const parsed = parseEmployeeCode(emp.employeeId || emp.id);
        const empDept = emp.department || emp.phongBan || parsed.department || '';

        const matchId = !idQuery || empId.includes(idQuery);
        const matchName = !nameQuery || empName.includes(nameQuery);
        const matchDept = !deptQuery || empDept === deptQuery;

        return matchId && matchName && matchDept;
    });
}

// Xử lý bấm tìm kiếm
async function handleSearch() {
    if (!hasLoaded) {
        employeeTable.innerHTML = `<tr><td colspan="5">Đang tải dữ liệu...</td></tr>`;
        await loadAllEmployees();
    }
    renderResults(filterEmployees());
}

if (searchBtn) searchBtn.addEventListener('click', handleSearch);

// Cho phép Enter để tìm kiếm ngay trong ô input
[searchEmployeeId, searchEmployeeName].forEach(input => {
    if (!input) return;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
});

if (searchDepartment) {
    searchDepartment.addEventListener('change', handleSearch);
}

// Tải và hiển thị toàn bộ nhân viên ngay khi vào trang
(async function init() {
    employeeTable.innerHTML = `<tr><td colspan="5">Đang tải dữ liệu...</td></tr>`;
    await loadAllEmployees();
    renderResults(allEmployees);
})();