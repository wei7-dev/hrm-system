// FILE 1: XỬ LÝ MENU, CHUÔNG & GẠCH CHÂN TRƯỢT THEO CHUỘT
document.addEventListener('DOMContentLoaded', () => {
    const notiBell = document.getElementById('notiBell');
    const notiDropdown = document.getElementById('notiDropdown');
    const menuToggle = document.getElementById('menu-toggle');
    const navbar = document.querySelector('.navbar');
    const hamburgerBtn = document.querySelector('.hamburger-btn');

    // Các phần tử phục vụ đường gạch chân trượt
    const navLinksList = document.getElementById('navLinksList');
    const magicLine = document.getElementById('magicLine');
    const navLinks = document.querySelectorAll('.nav-links a');

    // Xử lý dropdown "Tra cứu" trên mobile: vì mobile không có hover thật,
    // dùng click để bật/tắt class .dropdown-open thay vì dựa vào :hover
    // (dựa vào :hover khiến dropdown chỉ hiện chớp nhoáng rồi tắt ngay khi
    // nhấc tay ra, gây cảm giác giật/nhấp nháy).
    document.querySelectorAll('.has-dropdown > .dropdown-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            if (window.innerWidth > 768) return; // Desktop vẫn dùng hover như cũ
            e.preventDefault();
            e.stopPropagation();
            const parentLi = toggle.closest('.has-dropdown');
            const wasOpen = parentLi.classList.contains('dropdown-open');
            // Đóng mọi dropdown khác trước khi mở dropdown vừa chạm
            document.querySelectorAll('.has-dropdown.dropdown-open').forEach(el => el.classList.remove('dropdown-open'));
            if (!wasOpen) parentLi.classList.add('dropdown-open');
        });
    });

    // Hàm cập nhật vị trí đường gạch ngang theo một thẻ <a> cụ thể
    const moveLineTo = (element) => {
        if (!magicLine || !element || window.innerWidth <= 768) return;

        // Lấy thông số kích thước và vị trí của thẻ a so với thẻ cha ul
        const parentRect = navLinksList.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();

        const relativeLeft = elementRect.left - parentRect.left;
        const width = elementRect.width;

        // Cập nhật tọa độ và kích thước cho đường gạch chân phát sáng
        magicLine.style.width = `${width}px`;
        magicLine.style.transform = `translateX(${relativeLeft}px)`;
        magicLine.style.opacity = '1';
    };

    // Hàm đưa đường gạch chân về mục đang được chọn (Active) hoặc ẩn đi nếu không có mục nào active
    const resetLineToActive = () => {
        const activeLink = document.querySelector('.nav-links a.active');
        if (activeLink) {
            moveLineTo(activeLink);
        } else if (magicLine) {
            magicLine.style.opacity = '0';
            magicLine.style.width = '0';
        }
    };

    // Lắng nghe sự kiện rê chuột (Hover) cho từng mục menu
    navLinks.forEach(link => {
        // Khi chuột rà vào mục nào, đường gạch chân lập tức trượt qua mục đó
        link.addEventListener('mouseenter', function () {
            moveLineTo(this);
        });

        // Khi bấm click chuột: Cập nhật trạng thái Active phát sáng cố định
        link.addEventListener('click', function (e) {
            // "Tra cứu" chỉ là nút mở dropdown con, không phải link điều hướng
            // thật -> không đóng menu mobile hay đổi active khi bấm vào nó.
            if (this.classList.contains('dropdown-toggle')) return;

            navLinks.forEach(item => item.classList.remove('active'));
            this.classList.add('active');
            if (menuToggle) { menuToggle.checked = false; syncMenuOpenClass(); } // Đóng menu mobile
        });
    });

    // Khi di chuột ra hẳn ngoài thanh Menu, đường gạch chân tự trượt về mục đang Active ban đầu
    navLinksList?.addEventListener('mouseleave', resetLineToActive);

    // Tự động căn chỉnh lại đường gạch chân nếu người dùng thay đổi kích thước cửa sổ trình duyệt
    window.addEventListener('resize', resetLineToActive);

    const mainHeader = document.querySelector('.main-header');

    // Đồng bộ class "menu-open" trên <header> theo trạng thái checkbox hamburger.
    // Cần làm việc này bằng JS vì sau khi di chuyển nút hamburger vào trong
    // .logo-area (cạnh logo) để tăng tính thẩm mỹ, input#menu-toggle không còn
    // là anh em cùng cấp (sibling) với .navbar nữa, nên CSS thuần
    // ".menu-toggle:checked ~ .navbar" không còn tác dụng.
    const syncMenuOpenClass = () => {
        if (!mainHeader || !menuToggle) return;
        mainHeader.classList.toggle('menu-open', menuToggle.checked);
        // Khi đóng menu mobile, luôn reset dropdown "Tra cứu" về trạng thái đóng
        // để lần mở tiếp theo không bị kẹt ở trạng thái mở từ trước.
        if (!menuToggle.checked) {
            document.querySelectorAll('.has-dropdown.dropdown-open').forEach(el => el.classList.remove('dropdown-open'));
        }
    };

    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    if (menuToggle) menuToggle.addEventListener('change', syncMenuOpenClass);


    // ================= XỬ LÝ CHUÔNG THÔNG BÁO & CLICK RA NGOÀI =================
    if (notiBell && notiDropdown) {
        notiBell.addEventListener('click', (e) => {
            e.stopPropagation();
            notiDropdown.classList.toggle('show');
            if (menuToggle) { menuToggle.checked = false; syncMenuOpenClass(); }
        });
    }

    document.addEventListener('click', (e) => {
        if (notiBell && notiDropdown && !notiBell.contains(e.target) && !notiDropdown.contains(e.target)) {
            notiDropdown.classList.remove('show');
        }
        if (menuToggle && menuToggle.checked && navbar && hamburgerBtn) {
            const clickedInsideToggleArea = navbar.contains(e.target)
                || hamburgerBtn.contains(e.target)
                || e.target === menuToggle
                || e.target.closest('.has-dropdown');
            if (!clickedInsideToggleArea) {
                menuToggle.checked = false;
                syncMenuOpenClass();
            }
        }
    });
});


// FILE 2: XỬ LÝ POPUP MODAL FORM ĐĂNG NHẬP
document.addEventListener('DOMContentLoaded', () => {
    const openLoginBtn = document.getElementById('openLoginBtn');
    const loginModal = document.getElementById('loginModal');
    const modalOverlay = document.getElementById('modalOverlay');
    const menuToggle = document.getElementById('menu-toggle');
    const notiDropdown = document.getElementById('notiDropdown');

    // Các khối form con bên trong popup (chỉ còn login và forgot)
    const formBoxes = {
        login: document.getElementById('loginBox'),
        forgot: document.getElementById('forgotBox'),
        register: document.getElementById('registerBox')
    };

    // Hàm tiện ích ẩn/hiển thị chính xác form được yêu cầu
    const switchForm = (targetKey) => {
        Object.keys(formBoxes).forEach(key => {
            if (formBoxes[key]) {
                formBoxes[key].classList.toggle('hidden', key !== targetKey);
            }
        });
    };

    // Hàm đóng toàn bộ popup modal tài khoản
    const closeModal = () => {
        if (loginModal) loginModal.classList.remove('open');
    };

    // 1. Kích hoạt mở Popup từ nút Đăng nhập trên thanh công cụ
    if (openLoginBtn && loginModal) {
        openLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loginModal.classList.add('open');
            switchForm('login'); // Luôn ưu tiên mở bảng Đăng nhập đầu tiên

            // Đóng các thành phần khác khi mở popup
            if (menuToggle) {
                menuToggle.checked = false;
                document.querySelector('.main-header')?.classList.remove('menu-open');
            }
            if (notiDropdown) notiDropdown.classList.remove('show');
        });
    }

    // 2. Đóng popup khi click nút X hoặc bấm vào lớp Overlay mờ
    document.querySelectorAll('.closeLoginBtn').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeModal);
    }

    // 3. Đóng popup khi bấm phím ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // 4. Xử lý chuyển đổi giữa các form bên trong popup
    const bindSwitchClick = (buttonId, targetFormKey) => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                switchForm(targetFormKey);
            });
        }
    };
    bindSwitchClick('loginToRegister', 'register');
    bindSwitchClick('registerToLogin', 'login');
});


// FILE 3: SMOOTH SCROLL CHO CÁC ANCHOR LINKS
document.addEventListener('DOMContentLoaded', () => {
    // Smooth scroll khi click vào các link anchor
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const headerOffset = 100;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
});


// FILE 4: XỬ LÝ CHẤM CÔNG QR CODE
document.addEventListener('DOMContentLoaded', () => {
    const startScanBtn = document.getElementById('startScanBtn');
    const stopScanBtn = document.getElementById('stopScanBtn');
    const qrVideo = document.getElementById('qrVideo');
    const scannerFrame = document.querySelector('.scanner-frame');
    const attendanceForm = document.getElementById('attendanceForm');
    const employeeIdInput = document.getElementById('employeeId');
    const attendanceResult = document.getElementById('attendanceResult');
    const attendanceTableBody = document.getElementById('attendanceTableBody');

    let videoStream = null;
    let scanInterval = null;

    // Hàm format thời gian
    const formatTime = (date) => {
        return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Hàm hiển thị kết quả chấm công
    const showAttendanceResult = (employeeId, success = true) => {
        if (!attendanceResult) return;

        const now = new Date();
        const resultTitle = attendanceResult.querySelector('#resultTitle');
        const resultEmployeeId = attendanceResult.querySelector('#resultEmployeeId');
        const resultTime = attendanceResult.querySelector('#resultTime');
        const resultType = attendanceResult.querySelector('#resultType');
        const resultIcon = attendanceResult.querySelector('.result-icon');

        if (success) {
            resultIcon.className = 'result-icon success';
            resultTitle.textContent = 'Chấm công thành công!';
            resultTitle.style.color = '#22c55e';
        } else {
            resultIcon.className = 'result-icon error';
            resultTitle.textContent = 'Chấm công thất bại!';
            resultTitle.style.color = '#ff5252';
        }

        resultEmployeeId.innerHTML = `Mã NV: <strong>${employeeId}</strong>`;
        resultTime.innerHTML = `Thời gian: <strong>${formatTime(now)} - ${formatDate(now)}</strong>`;
        resultType.innerHTML = `Loại: <strong>Vào làm</strong>`;

        attendanceResult.classList.remove('hidden');

        // Thêm vào bảng lịch sử
        if (success && attendanceTableBody) {
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <td>${employeeId}</td>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <td>Nhân viên mới</td>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <td>${formatTime(now)}</td>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <td>--:--:--</td>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <td><span class="status-badge working">Đang làm</span></td>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        `;
            attendanceTableBody.insertBefore(newRow, attendanceTableBody.firstChild);
        }

        // Ẩn kết quả sau 5 giây
        setTimeout(() => {
            attendanceResult.classList.add('hidden');
        }, 5000);
    };

    // Hàm xử lý khi quét được mã QR
    const handleQRCode = (qrData) => {
        // Dừng quét
        stopScanning();

        // Xử lý dữ liệu QR (giả định format: NV001234 hoặc JSON có trường id)
        let employeeId = qrData;

        try {
            const parsed = JSON.parse(qrData);
            if (parsed.id) employeeId = parsed.id;
        } catch (e) {
            // Không phải JSON, sử dụng trực tiếp
        }

        // Hiển thị kết quả
        showAttendanceResult(employeeId, true);
    };

    // Hàm bắt đầu quét QR
    const startScanning = async () => {
        if (!qrVideo || !scannerFrame) return;

        try {
            // Yêu cầu quyền truy cập camera
            videoStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });

            qrVideo.srcObject = videoStream;
            qrVideo.play();

            // Thêm class scanning để hiển thị video và animation
            scannerFrame.classList.add('scanning');

            // Cập nhật UI nút
            if (startScanBtn) startScanBtn.classList.add('hidden');
            if (stopScanBtn) stopScanBtn.classList.remove('hidden');

            // Bắt đầu quét QR (sử dụng canvas để đọc frame)
            scanInterval = setInterval(() => {
                if (qrVideo.readyState === qrVideo.HAVE_ENOUGH_DATA) {
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.width = qrVideo.videoWidth;
                    canvas.height = qrVideo.videoHeight;
                    context.drawImage(qrVideo, 0, 0, canvas.width, canvas.height);

                    // Giả lập quét QR - trong thực tế sẽ sử dụng thư viện như jsQR
                    // Ở đây demo bằng cách kiểm tra pixel pattern
                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

                    // Demo: Random chance để giả lập quét thành công sau 3-5 giây
                    // Trong thực tế, bạn sẽ sử dụng thư viện jsQR để decode
                    // const code = jsQR(imageData.data, canvas.width, canvas.height);
                    // if (code) handleQRCode(code.data);
                }
            }, 500);

        } catch (error) {
            console.error('Không thể truy cập camera:', error);
            alert('Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập camera của trình duyệt.');
        }
    };

    // Hàm dừng quét QR
    const stopScanning = () => {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
        }

        if (scanInterval) {
            clearInterval(scanInterval);
            scanInterval = null;
        }

        if (qrVideo) {
            qrVideo.srcObject = null;
        }

        if (scannerFrame) {
            scannerFrame.classList.remove('scanning');
        }

        // Cập nhật UI nút
        if (startScanBtn) startScanBtn.classList.remove('hidden');
        if (stopScanBtn) stopScanBtn.classList.add('hidden');
    };

    // Event listeners
    if (startScanBtn) {
        startScanBtn.addEventListener('click', startScanning);
    }

    if (stopScanBtn) {
        stopScanBtn.addEventListener('click', stopScanning);
    }

    // Xử lý form nhập ID thủ công
    if (attendanceForm) {
        attendanceForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const employeeId = employeeIdInput?.value.trim();

            if (!employeeId) {
                alert('Vui lòng nhập mã nhân viên!');
                return;
            }

            // Validate format mã nhân viên (VD: NV001234)
            const isValidFormat = /^[A-Za-z]{2}\d{4,8}$/.test(employeeId);

            if (isValidFormat) {
                showAttendanceResult(employeeId.toUpperCase(), true);
                employeeIdInput.value = '';
            } else {
                showAttendanceResult(employeeId, false);
            }
        });
    }

    // Cleanup khi rời trang
    window.addEventListener('beforeunload', stopScanning);
});

// =========================================================================
// 1. KÍCH HOẠT ĐỒNG HỒ REALTIME ƯU TIÊN 1 TRÊN TRANG CHỦ
// =========================================================================
function startHomeClock() {
    const clockDisplay = document.getElementById("currentTime");
    if (!clockDisplay) return;

    const update = () => {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        clockDisplay.textContent = `${h}:${m}:${s}`;
    };
    update();
    setInterval(update, 1000); // Lặp liên tục mỗi 1 giây
}
// Chạy đồng hồ ngay lập tức
startHomeClock();


// =========================================================================
// 2. [ĐÃ GỠ BỎ] PHÂN QUYỀN VÀO "QUẢN TRỊ HỆ THỐNG" BẰNG PIN Ở CLIENT
// =========================================================================
// Mã PIN hard-code + sessionStorage tự set là lỗ hổng bảo mật nghiêm trọng
// (bất kỳ ai mở DevTools cũng bypass được). Menu "Quản Trị Hệ Thống" giờ
// CHỈ hiển thị qua #profileMenuAdmin trong profile-dropdown, do profile-menu.js
// điều khiển dựa trên role thật lấy từ Firebase/Firestore.
// =========================================================================