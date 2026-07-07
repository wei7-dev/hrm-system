// bao-cao-tai-chinh.js
// Dữ liệu MÔ PHỎNG (giả lập) để minh hoạ xu hướng tài chính cho Nhà đầu tư.
// Không phải số liệu kế toán thật — chỉ dùng để trực quan hoá quỹ đạo tăng trưởng.

document.addEventListener("DOMContentLoaded", () => {

    // Đồng hồ header
    const currentTimeDisplay = document.getElementById("currentTime");
    function updateClock() {
        if (!currentTimeDisplay) return;
        const now = new Date();
        currentTimeDisplay.textContent = now.toLocaleTimeString("vi-VN", { hour12: false });
    }
    updateClock();
    setInterval(updateClock, 1000);

    // ============================================================
    // 1. DỮ LIỆU MÔ PHỎNG DOANH THU / CHI PHÍ 12 THÁNG
    // ============================================================
    const months = ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"];
    const revenue = [420, 445, 480, 470, 520, 560, 540, 610, 650, 690, 720, 780]; // triệu VNĐ (mô phỏng)
    const cost    = [310, 320, 330, 335, 350, 360, 365, 380, 390, 400, 410, 425];

    function drawRevenueChart() {
        const svg = document.getElementById("revenueChart");
        if (!svg) return;

        const W = 900, H = 340;
        const padL = 50, padR = 20, padT = 20, padB = 40;
        const chartW = W - padL - padR;
        const chartH = H - padT - padB;

        const maxVal = Math.max(...revenue, ...cost) * 1.1;
        const stepX = chartW / (months.length - 1);

        function toXY(value, index) {
            const x = padL + index * stepX;
            const y = padT + chartH - (value / maxVal) * chartH;
            return [x, y];
        }

        function buildPath(data) {
            return data.map((v, i) => {
                const [x, y] = toXY(v, i);
                return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
            }).join(' ');
        }

        function buildAreaPath(data) {
            const line = buildPath(data);
            const [lastX] = toXY(data[data.length - 1], data.length - 1);
            const [firstX] = toXY(data[0], 0);
            const baseY = padT + chartH;
            return `${line} L ${lastX.toFixed(1)} ${baseY} L ${firstX.toFixed(1)} ${baseY} Z`;
        }

        let svgContent = `
            <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#22c55e" stop-opacity="0.35"/>
                    <stop offset="100%" stop-color="#22c55e" stop-opacity="0"/>
                </linearGradient>
            </defs>
        `;

        // Grid lines ngang
        const gridLines = 4;
        for (let g = 0; g <= gridLines; g++) {
            const y = padT + (chartH / gridLines) * g;
            svgContent += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
            const val = Math.round(maxVal - (maxVal / gridLines) * g);
            svgContent += `<text x="${padL - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#5f7a6d">${val}</text>`;
        }

        // Trục X labels
        months.forEach((m, i) => {
            const [x] = toXY(0, i);
            svgContent += `<text x="${x}" y="${H - 12}" text-anchor="middle" font-size="11" fill="#5f7a6d">${m}</text>`;
        });

        // Vùng tô doanh thu
        svgContent += `<path d="${buildAreaPath(revenue)}" fill="url(#revFill)"/>`;

        // Đường chi phí (nét đứt, màu cam)
        svgContent += `<path d="${buildPath(cost)}" fill="none" stroke="#ffb454" stroke-width="2" stroke-dasharray="5,5"/>`;

        // Đường doanh thu (nét liền, màu xanh lá)
        svgContent += `<path d="${buildPath(revenue)}" fill="none" stroke="#22c55e" stroke-width="2.5"/>`;

        // Điểm tròn trên đường doanh thu
        revenue.forEach((v, i) => {
            const [x, y] = toXY(v, i);
            svgContent += `<circle cx="${x}" cy="${y}" r="3.5" fill="#04070c" stroke="#22c55e" stroke-width="2"/>`;
        });

        svg.innerHTML = svgContent;
    }

    function renderStatRow() {
        const statRow = document.getElementById("statRow");
        if (!statRow) return;

        const totalRevenue = revenue.reduce((a, b) => a + b, 0);
        const totalCost = cost.reduce((a, b) => a + b, 0);
        const profit = totalRevenue - totalCost;
        const growthYoY = (((revenue[11] - revenue[0]) / revenue[0]) * 100).toFixed(1);
        const marginPct = ((profit / totalRevenue) * 100).toFixed(1);

        const stats = [
            { label: "Tổng doanh thu 12 tháng", value: `${totalRevenue.toLocaleString('vi-VN')} triệu`, cls: "" },
            { label: "Lợi nhuận gộp ước tính", value: `${profit.toLocaleString('vi-VN')} triệu`, cls: "up" },
            { label: "Tăng trưởng đầu → cuối năm", value: `+${growthYoY}%`, cls: "up" },
            { label: "Biên lợi nhuận trung bình", value: `${marginPct}%`, cls: "" }
        ];

        statRow.innerHTML = stats.map(s => `
            <div class="stat-box">
                <span class="stat-label">${s.label}</span>
                <span class="stat-value ${s.cls}">${s.value}</span>
            </div>
        `).join('');
    }

    function renderHero() {
        const heroValuation = document.getElementById("heroValuation");
        const heroDelta = document.getElementById("heroDelta");
        if (!heroValuation || !heroDelta) return;

        // Vốn hoá mô phỏng = tổng doanh thu năm x hệ số 4.2 (giả lập, không phải công thức thật)
        const totalRevenue = revenue.reduce((a, b) => a + b, 0);
        const valuation = Math.round(totalRevenue * 4.2);
        const growthYoY = (((revenue[11] - revenue[0]) / revenue[0]) * 100).toFixed(1);

        heroValuation.textContent = `${valuation.toLocaleString('vi-VN')} triệu`;
        heroDelta.textContent = `▲ +${growthYoY}% so với đầu năm`;
    }

    // ============================================================
    // 2. DỰ ÁN TƯƠNG LAI (mô phỏng lộ trình sản phẩm)
    // ============================================================
    const projects = [
        {
            quarter: "Đã hoàn thành · Q2 2026",
            title: "Hệ thống chấm công QR nội bộ",
            desc: "Triển khai chấm công bằng mã QR, đồng bộ Firebase thời gian thực cho toàn bộ nhân sự.",
            status: "done",
            statusLabel: "Hoàn thành"
        },
        {
            quarter: "Đang triển khai · Q3 2026",
            title: "Phân hệ phân quyền đa vai trò",
            desc: "Tách biệt HR, Nhân viên, Nhà đầu tư với dữ liệu và giao diện riêng biệt theo từng vai trò.",
            status: "progress",
            statusLabel: "Đang thực hiện"
        },
        {
            quarter: "Kế hoạch · Q4 2026",
            title: "Cổng thông tin đối tác chiến lược",
            desc: "Xây dựng không gian làm việc chung cho các đối tác đầu tư, chia sẻ báo cáo theo thời gian thực.",
            status: "planned",
            statusLabel: "Lên kế hoạch"
        },
        {
            quarter: "Định hướng · 2027",
            title: "Mở rộng sang thị trường khu vực",
            desc: "Bản địa hoá hệ thống HRM cho các thị trường lân cận, dựa trên nền tảng đã kiểm chứng tại Việt Nam.",
            status: "planned",
            statusLabel: "Định hướng"
        }
    ];

    function renderProjects() {
        const timeline = document.getElementById("projectTimeline");
        if (!timeline) return;

        timeline.innerHTML = projects.map(p => `
            <div class="timeline-item ${p.status === 'done' ? 'done' : ''}">
                <span class="timeline-quarter">${p.quarter}</span>
                <h3>${p.title}</h3>
                <p>${p.desc}</p>
                <span class="timeline-status ${p.status}">${p.statusLabel}</span>
            </div>
        `).join('');
    }

    // ============================================================
    // 3. TIỀM NĂNG HỢP TÁC DÀI HẠN (mô phỏng mốc thời gian)
    // ============================================================
    const horizonPoints = [
        { year: "Năm 1", pct: 15, desc: "Ổn định vận hành, chứng minh mô hình." },
        { year: "Năm 3", pct: 45, desc: "Mở rộng đội ngũ, tăng gấp đôi khách hàng." },
        { year: "Năm 5", pct: 75, desc: "Dẫn đầu thị trường ngách, mở chi nhánh mới." },
        { year: "Năm 7+", pct: 100, desc: "Tiềm năng mở rộng khu vực hoặc gọi vốn vòng lớn." }
    ];

    function renderHorizon() {
        const fill = document.getElementById("horizonFill");
        const marks = document.getElementById("horizonMarks");
        const labels = document.getElementById("horizonLabels");
        if (!fill || !marks || !labels) return;

        // Animate fill tới mốc xa nhất (100%) sau khi trang tải xong
        requestAnimationFrame(() => {
            setTimeout(() => { fill.style.width = "100%"; }, 150);
        });

        marks.innerHTML = horizonPoints.map(p => `
            <div class="horizon-mark" style="left:${p.pct}%;"></div>
        `).join('');

        labels.innerHTML = horizonPoints.map(p => `
            <div class="horizon-label">
                <span class="h-year">${p.year}</span>
                <span class="h-desc">${p.desc}</span>
            </div>
        `).join('');
    }

    // Render tất cả
    drawRevenueChart();
    renderStatRow();
    renderHero();
    renderProjects();
    renderHorizon();
});
