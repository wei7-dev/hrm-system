import { db } from "./firebase.js";
import {
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    collection,
    query,
    where,
    onSnapshot,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Biến toàn cục
let html5QrCode = null;
let isScanning = false;
let isProcessing = false;
let availableCameras = [];

// Liệt kê camera khả dụng trên máy (laptop có thể có nhiều camera: built-in, USB rời...)
async function loadCameraList() {
    if (!cameraSelect) return;
    try {
        availableCameras = await Html5Qrcode.getCameras();
        if (!availableCameras || availableCameras.length === 0) {
            cameraSelect.classList.add('hidden');
            return;
        }

        cameraSelect.innerHTML = availableCameras
            .map((cam, index) => `<option value="${cam.id}">${cam.label || `Camera ${index + 1}`}</option>`)
            .join('');

        // Ưu tiên chọn camera có tên gợi ý là camera sau/rời (thường nét hơn webcam tích hợp)
        const preferred = availableCameras.find(cam =>
            /back|rear|environment/i.test(cam.label)
        );
        if (preferred) cameraSelect.value = preferred.id;

        if (availableCameras.length > 1) {
            cameraSelect.classList.remove('hidden');
        }
    } catch (err) {
        console.warn('[v0] Không lấy được danh sách camera:', err);
        cameraSelect.classList.add('hidden');
    }
}

// DOM Elements
const startCameraBtn = document.getElementById('startCameraBtn');
const stopCameraBtn = document.getElementById('stopCameraBtn');
const cameraSelect = document.getElementById('cameraSelect');
const scannerBox = document.getElementById('scannerBox');
const scannerLine = document.getElementById('scannerLine');
const scannerPlaceholder = document.getElementById('scannerPlaceholder');
const qrReaderDiv = document.getElementById('qrReader');
const resultContainer = document.getElementById('resultContainer');
const resultCard = document.getElementById('resultCard');
const resultIcon = document.getElementById('resultIcon');
const resultTitle = document.getElementById('resultTitle');
const resultEmployeeId = document.getElementById('resultEmployeeId');
const resultEmployeeName = document.getElementById('resultEmployeeName');
const resultTime = document.getElementById('resultTime');
const resultType = document.getElementById('resultType');
const continueBtn = document.getElementById('continueBtn');
const historyTableBody = document.getElementById('historyTableBody');
const currentTimeDisplay = document.getElementById('currentTime');

// Cập nhật thời gian realtime trên đồng hồ màn hình
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

// Format thời gian
function formatTime(date) {
    if (!date) return '--:--:--';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function formatDateTime(date) {
    const time = formatTime(date);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${time} - ${day}/${month}/${year}`;
}

function getTodayId(date = new Date()) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
}

// Xác định trạng thái checkIn (đúng giờ / đi trễ)
function getCheckInStatus(date) {
    const hour = date.getHours();
    const minute = date.getMinutes();
    if (hour < 8 || (hour === 8 && minute <= 15)) {
        return { text: 'Đang làm', class: 'working' };
    }
    return { text: 'Đi trễ', class: 'late' };
}

// Hiển thị kết quả
function showResult({ success, employeeId, employeeName, time, type }) {
    if (!resultContainer) return;
    resultContainer.classList.remove('hidden');

    if (success) {
        resultCard.classList.remove('error');
        resultCard.classList.add('success');
        resultIcon.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
        `;
        resultTitle.textContent = 'Chấm công thành công!';
    } else {
        resultCard.classList.remove('success');
        resultCard.classList.add('error');
        resultIcon.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
        `;
        resultTitle.textContent = 'Không tìm thấy nhân viên!';
    }

    if (resultEmployeeId) resultEmployeeId.textContent = employeeId;
    if (resultEmployeeName) resultEmployeeName.textContent = employeeName;
    if (resultTime) resultTime.textContent = time;
    if (resultType) resultType.textContent = type;

    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Render toàn bộ bảng lịch sử từ dữ liệu Firestore hôm nay
function renderHistory(docsData) {
    if (!historyTableBody) return;

    const rows = docsData
        .slice()
        .sort((a, b) => {
            const aTime = a.checkOut?.toDate?.() || a.checkIn?.toDate?.() || 0;
            const bTime = b.checkOut?.toDate?.() || b.checkIn?.toDate?.() || 0;
            return bTime - aTime;
        })
        .map(data => {
            const checkInTime = data.checkIn?.toDate ? formatTime(data.checkIn.toDate()) : '--:--:--';
            const checkOutTime = data.checkOut?.toDate ? formatTime(data.checkOut.toDate()) : '--:--:--';
            const statusClass = data.statusClass || 'working';
            const statusText = data.status || 'Đang làm';
            return `
                <tr>
                    <td>${data.employeeId}</td>
                    <td>${data.employeeName}</td>
                    <td>${checkInTime}</td>
                    <td>${checkOutTime}</td>
                    <td><span class="status ${statusClass}">${statusText}</span></td>
                </tr>
            `;
        })
        .join('');

    historyTableBody.innerHTML = rows;
}

// Lắng nghe realtime dữ liệu chấm công hôm nay
function listenTodayAttendance() {
    const todayId = getTodayId();
    const attendanceRef = collection(db, "attendance");
    const todayQuery = query(attendanceRef, where("date", "==", todayId));

    onSnapshot(todayQuery, (snapshot) => {
        const docsData = snapshot.docs.map(d => d.data());
        renderHistory(docsData);
    }, (err) => {
        console.error('[v0] Lỗi lắng nghe attendance:', err);
    });
}

// Tra cứu nhân viên: thử nhiều biến thể ID làm doc ID, nếu vẫn không thấy
// thì tải toàn bộ collection để log ra console giúp đối chiếu lệch ID.
async function findEmployeeDoc(rawText) {
    console.log('[v0] Raw QR text:', JSON.stringify(rawText));

    const trimmed = rawText.trim();
    const candidates = [trimmed, trimmed.toUpperCase(), trimmed.toLowerCase()];

    for (const candidateId of candidates) {
        const snap = await getDoc(doc(db, "nhan_vien_chinh_thuc", candidateId));
        if (snap.exists()) {
            console.log('[v0] Match found with doc ID:', candidateId);
            return { id: candidateId, data: snap.data() };
        }
    }

    console.warn('[v0] Không tìm thấy doc ID nào khớp. Đang tải toàn bộ collection "nhan_vien_chinh_thuc" để đối chiếu...');
    const allSnap = await getDocs(collection(db, "nhan_vien_chinh_thuc"));
    const allIds = allSnap.docs.map(d => d.id);
    console.warn('[v0] Danh sách doc ID hiện có trong "nhan_vien_chinh_thuc":', allIds);
    console.warn('[v0] So sánh với giá trị QR đã quét ở trên để tìm chỗ lệch (khoảng trắng, hoa/thường, ký tự ẩn).');

    return null;
}

// Xử lý khi quét được QR: tra cứu nhân viên trong Firestore rồi ghi chấm công
async function onScanSuccess(decodedText) {
    if (isProcessing) return;
    isProcessing = true;

    console.log('[v0] QR Code detected:', decodedText);
    await stopCamera();

    const now = new Date();

    try {
        const found = await findEmployeeDoc(decodedText);

        if (!found) {
            showResult({
                success: false,
                employeeId: decodedText.trim(),
                employeeName: 'Không xác định',
                time: formatDateTime(now),
                type: 'Lỗi'
            });
            isProcessing = false;
            return;
        }

        const employeeId = found.id;
        const employee = found.data;
        const employeeName = employee.fullName || 'Không rõ tên';
        const todayId = getTodayId(now);
        const attendanceDocRef = doc(db, "attendance", `${employeeId}_${todayId}`);
        const attendanceSnap = await getDoc(attendanceDocRef);

        if (!attendanceSnap.exists() || !attendanceSnap.data().checkIn) {
            // Chưa chấm công vào -> ghi giờ vào
            const status = getCheckInStatus(now);
            await setDoc(attendanceDocRef, {
                employeeId,
                employeeName,
                date: todayId,
                checkIn: Timestamp.fromDate(now),
                checkOut: null,
                status: status.text,
                statusClass: status.class
            });

            showResult({
                success: true,
                employeeId,
                employeeName,
                time: formatDateTime(now),
                type: 'Vào làm'
            });
        } else if (!attendanceSnap.data().checkOut) {
            // Đã có giờ vào, chưa có giờ ra -> ghi giờ ra
            await updateDoc(attendanceDocRef, {
                checkOut: Timestamp.fromDate(now),
                status: 'Đã về',
                statusClass: 'done'
            });

            showResult({
                success: true,
                employeeId,
                employeeName,
                time: formatDateTime(now),
                type: 'Ra về'
            });
        } else {
            // Đã chấm công đủ vào/ra hôm nay
            showResult({
                success: true,
                employeeId,
                employeeName,
                time: formatDateTime(now),
                type: 'Đã chấm công đủ hôm nay'
            });
        }
    } catch (err) {
        console.error('[v0] Lỗi khi xử lý chấm công:', err);
        showResult({
            success: false,
            employeeId,
            employeeName: 'Lỗi hệ thống',
            time: formatDateTime(now),
            type: 'Lỗi'
        });
    }

    isProcessing = false;
}

function onScanError(errorMessage) {
    // Không làm gì khi lỗi quét - đây là bình thường khi chưa có QR trong khung hình
}

// Bật camera
async function startCamera() {
    console.log('[v0] Starting camera...');
    if (!scannerPlaceholder || !qrReaderDiv || !scannerLine || !scannerBox) return;

    try {
        scannerPlaceholder.style.display = 'none';
        qrReaderDiv.style.display = 'block';
        scannerLine.style.display = 'block';
        scannerBox.classList.add('scanning');

        html5QrCode = new Html5Qrcode("qrReader");

        const config = {
            fps: 15,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1.0,
            disableFlip: false
        };

        const selectedCameraId = cameraSelect && cameraSelect.value ? cameraSelect.value : null;
        const cameraSource = selectedCameraId ? selectedCameraId : { facingMode: "environment" };

        await html5QrCode.start(
            cameraSource,
            config,
            onScanSuccess,
            onScanError
        );

        console.log('[v0] Camera started successfully');
        isScanning = true;

        startCameraBtn.classList.add('hidden');
        stopCameraBtn.classList.remove('hidden');

    } catch (err) {
        console.error('[v0] Error starting camera:', err);

        try {
            console.log('[v0] Trying front camera...');
            await html5QrCode.start(
                { facingMode: "user" },
                {
                    fps: 15,
                    qrbox: { width: 260, height: 260 }
                },
                onScanSuccess,
                onScanError
            );

            console.log('[v0] Front camera started successfully');
            isScanning = true;
            startCameraBtn.classList.add('hidden');
            stopCameraBtn.classList.remove('hidden');

        } catch (err2) {
            console.error('[v0] Error starting front camera:', err2);
            alert('Không thể truy cập camera. Vui lòng kiểm tra lại quyền thiết bị.');

            scannerPlaceholder.style.display = 'flex';
            qrReaderDiv.style.display = 'none';
            scannerLine.style.display = 'none';
            scannerBox.classList.remove('scanning');
        }
    }
}

// Tắt camera
async function stopCamera() {
    console.log('[v0] Stopping camera...');

    if (html5QrCode && isScanning) {
        try {
            await html5QrCode.stop();
            console.log('[v0] Camera stopped');
        } catch (err) {
            console.error('[v0] Error stopping camera:', err);
        }
    }

    isScanning = false;

    if (startCameraBtn) startCameraBtn.classList.remove('hidden');
    if (stopCameraBtn) stopCameraBtn.classList.add('hidden');
    if (scannerPlaceholder) scannerPlaceholder.style.display = 'flex';
    if (qrReaderDiv) qrReaderDiv.style.display = 'none';
    if (scannerLine) scannerLine.style.display = 'none';
    if (scannerBox) scannerBox.classList.remove('scanning');
}

// Ẩn kết quả và tiếp tục quét
function hideResultAndContinue() {
    if (resultContainer) resultContainer.classList.add('hidden');
    startCamera();
}

// Event Listeners
if (startCameraBtn) startCameraBtn.addEventListener('click', startCamera);
if (stopCameraBtn) stopCameraBtn.addEventListener('click', stopCamera);
if (continueBtn) continueBtn.addEventListener('click', hideResultAndContinue);

window.addEventListener('beforeunload', () => {
    if (html5QrCode && isScanning) {
        html5QrCode.stop();
    }
});

// Khởi động lắng nghe lịch sử chấm công hôm nay ngay khi vào trang
listenTodayAttendance();
loadCameraList();