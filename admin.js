// admin.js
import { db } from "./firebase.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    const addEmployeeForm = document.getElementById("addEmployeeForm");
    const qrcodeCanvas = document.getElementById("qrcode-canvas");
    const downloadQrBtn = document.getElementById("downloadQrBtn");

    const qrPlaceholderText = document.getElementById("qrPlaceholderText");
    const generatedCodeDisplay = document.getElementById("generatedCodeDisplay");
    const empCodeText = document.getElementById("empCodeText");

    // Sinh mã nhân viên duy nhất: thử tối đa 20 lần nếu trùng ngẫu nhiên trong Firestore
    async function generateUniqueEmployeeId(typeValue, deptCode) {
        const MAX_ATTEMPTS = 20;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const candidateId = `${typeValue}-${deptCode}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
            const existing = await getDoc(doc(db, "nhan_vien_chinh_thuc", candidateId));
            if (!existing.exists()) return candidateId;
        }
        throw new Error("Không thể sinh mã nhân viên duy nhất, vui lòng thử lại.");
    }

    addEmployeeForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = addEmployeeForm.querySelector("button[type='submit']");
        submitBtn.disabled = true;
        submitBtn.textContent = "Đang xử lý...";

        try {
            const name = document.getElementById("newEmpName").value.trim();
            const typeValue = document.getElementById("newEmpType").value;
            const deptCode = document.getElementById("newEmpDept").value;

            if (!name) {
                alert("Vui lòng nhập họ tên.");
                return;
            }

            const finalId = await generateUniqueEmployeeId(typeValue, deptCode);

            empCodeText.textContent = finalId;
            qrPlaceholderText.style.display = "none";
            generatedCodeDisplay.style.display = "block";
            downloadQrBtn.style.display = "inline-block";

            qrcodeCanvas.innerHTML = "";
            new QRCode(qrcodeCanvas, {
                text: finalId,
                width: 200,
                height: 200
            });

            await new Promise(resolve => setTimeout(resolve, 500));

            const canvas = qrcodeCanvas.querySelector("canvas");
            if (!canvas) {
                throw new Error("Không tạo được ảnh QR.");
            }

            const base64QrData = canvas.toDataURL("image/png");

            await setDoc(doc(db, "nhan_vien_chinh_thuc", finalId), {
                employeeId: finalId,
                fullName: name,
                qrCodeData: base64QrData,
                createdAt: new Date().toISOString()
            });

            downloadQrBtn.onclick = () => {
                const link = document.createElement("a");
                link.href = base64QrData;
                link.download = `${finalId}.png`;
                link.click();
            };

            alert("Đã thêm thành công! Mã nhân viên: " + finalId);
            addEmployeeForm.reset();
        } catch (err) {
            console.error('[v0] Lỗi tạo nhân viên:', err);
            alert("Lỗi: " + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Kích Hoạt, Cấp Mã Khóa & Tạo QR";
        }
    });
});