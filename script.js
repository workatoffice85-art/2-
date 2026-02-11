// Configuration
// REPLACE THIS URL AFTER DEPLOYING THE APPS SCRIPT
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwvHbBujllbjOnHFkaRIZhwbRQeDzxcpnUPDWfqPj_wxv_SnIi9oKddFcvpZQzGoPXdeQ/exec';

// Global Data
let inventoryData = [];
let monthlyContext, itemsContext;
let monthlyChart, itemsChart;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    setupEventListeners();
    refreshData(); // If URL is set, this will fetch data

    // Simulate Loading for first run (if no data)
    if (SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
        Swal.fire({
            title: 'تنبيه',
            text: 'يرجى وضع رابط Apps Script في ملف script.js',
            icon: 'warning',
            confirmButtonText: 'حسناً'
        });
        // Mock Data for Display Purposes
        mockDataDisplay();
    }
});

// --- Navigation ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    document.getElementById(`btn-${tabId}`).classList.add('active');
}

// --- Event Listeners ---
function setupEventListeners() {
    // OCR Upload
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('ocrImageInput');

    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) processOCR(e.target.files[0]);
    });

    // Drag and Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.background = '#eef2ff';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.background = '';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.background = '';
        if (e.dataTransfer.files.length > 0) processOCR(e.dataTransfer.files[0]);
    });

    // Form Submit
    document.getElementById('dataForm').addEventListener('submit', handleFormSubmit);
}

// --- Data Fetching ---
async function refreshData() {
    if (SCRIPT_URL.includes('YOUR_')) return;

    try {
        document.querySelector('.loading-text').parentElement.style.display = 'table-row';
        const response = await fetch(`${SCRIPT_URL}?action=getData`);
        const result = await response.json();

        if (result.status === 'success') {
            inventoryData = result.data;
            updateDashboard(result);
        } else {
            console.error('Error fetching data:', result);
        }
    } catch (error) {
        console.error('Network Error:', error);
    }
}

function updateDashboard(data) {
    // 1. Update Cards
    document.getElementById('totalQuantity').innerText = data.stats.totalQuantity.toLocaleString();
    document.getElementById('todayEntries').innerText = data.stats.todayCount;
    document.getElementById('topItem').innerText = data.stats.topItem;

    // 2. Update Table
    const tbody = document.getElementById('dataTableBody');
    tbody.innerHTML = '';

    data.recentEntries.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(row.date).toLocaleDateString('ar-EG')}</td>
            <td>${row.port}</td>
            <td>${row.name}</td>
            <td>${row.quantity}</td>
        `;
        tbody.appendChild(tr);
    });

    // 3. Update Charts
    updateCharts(data.charts);

    // 4. Update Inventory Status Table
    const statusBody = document.getElementById('inventoryStatusBody');
    if (data.inventoryStatus) {
        statusBody.innerHTML = '';
        data.inventoryStatus.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.name}</td>
                <td><span class="badge">${item.totalQty.toLocaleString()}</span></td>
            `;
            statusBody.appendChild(tr);
        });

        // 5. Update Report Options
        renderReportOptions(data.inventoryStatus);
    } else {
        statusBody.innerHTML = '<tr><td colspan="2" class="text-center">يرجى تحديث كود Apps Script لظهور هذه البيانات</td></tr>';
    }
}

// --- Report Options ---
function renderReportOptions(items) {
    const container = document.getElementById('itemsFilterList');
    container.innerHTML = '';

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'checkbox-wrapper item-check';
        div.innerHTML = `
            <input type="checkbox" name="reportItem" value="${item.name}" checked>
            <label>${item.name}</label>
        `;
        container.appendChild(div);
    });
}

function toggleAllItems() {
    const mainCheck = document.getElementById('selectAllItems');
    const checks = document.querySelectorAll('input[name="reportItem"]');
    checks.forEach(c => c.checked = mainCheck.checked);
}

// --- PDF Generation ---
async function requestPDF() {
    const btn = document.getElementById('generatePdfBtn');
    const loading = document.getElementById('pdfLoading');
    const resultDiv = document.getElementById('pdfResult');

    // Get Selected Items
    const selectedItems = Array.from(document.querySelectorAll('input[name="reportItem"]:checked'))
        .map(cb => cb.value);

    if (selectedItems.length === 0) {
        Swal.fire('تنبيه', 'يرجى اختيار صنف واحد على الأقل', 'warning');
        return;
    }

    // Get Logo
    const logoInput = document.getElementById('logoInput');
    let logoBase64 = null;
    if (logoInput.files.length > 0) {
        try {
            logoBase64 = await toBase64(logoInput.files[0]);
        } catch (e) {
            console.error("Logo Error", e);
            Swal.fire('خطأ', 'فشل قراءة ملف الشعار', 'error');
            return;
        }
    }

    if (SCRIPT_URL.includes('YOUR_')) {
        Swal.fire('تنبيه', 'يجب ربط السكريبت الحقيقي لتوليد PDF', 'info');
        return;
    }

    btn.classList.add('hidden');
    loading.classList.remove('hidden');
    resultDiv.classList.add('hidden');

    try {
        // Send POST request instead of GET to handle large payload (Base64 Logo)
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'generatePDF',
                items: selectedItems,
                logo: logoBase64
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            document.getElementById('pdfDownloadLink').href = result.url;
            resultDiv.classList.remove('hidden');
        } else {
            Swal.fire('خطأ', 'فشل إنشاء الملف: ' + result.message, 'error');
            btn.classList.remove('hidden');
        }
    } catch (e) {
        console.error(e);
        Swal.fire('خطأ', 'خطأ في الشبكة', 'error');
        btn.classList.remove('hidden');
    } finally {
        loading.classList.add('hidden');
    }
}

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]); // Remove "data:image/..."
    reader.onerror = error => reject(error);
});
async function processOCR(file) {
    // Show Preview
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('previewImg').src = e.target.result;
        document.getElementById('ocrPreview').classList.remove('hidden');
    };
    reader.readAsDataURL(file);

    // Show Loader
    document.getElementById('ocrStatus').classList.remove('hidden');

    try {
        // Use both English and Arabic for better recognition in ACUD forms
        const result = await Tesseract.recognize(
            file,
            'eng+ara',
            { logger: m => console.log(m) }
        );

        const text = result.data.text;
        console.log("OCR Raw Text:", text);

        // --- Specialized Table Parsing Logic ---
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        let extractedPort = "", extractedQty = "", extractedName = "";

        // Target Keywords for ACUD form
        // Headers: رقم الصنف (Part No), الكمية المنصرفة (Qty)
        const partKeywords = /رقم\s*الصنف|Part\s*No|Ref|JL\d+|J\d+[A-Z]/i;

        // Look for common Aruba/HP hardware patterns: JL704C, J9281D, R8Q70A, J9151E
        const hardwareRegex = /([A-Z]{1,2}[0-9]{3,4}[A-Z]{0,1})/i;

        for (let line of lines) {
            const pMatch = line.match(hardwareRegex);
            if (pMatch && !extractedPort) {
                extractedPort = pMatch[1];

                // In ACUD table, qty is usually on the same line or immediate next/prev.
                const nums = line.match(/\b(\d{1,4})\b/g);
                if (nums) {
                    // Extract the number that is NOT part of the hardware ID
                    const likelyQty = nums.find(n => !extractedPort.includes(n) && n.length <= 3);
                    if (likelyQty) extractedQty = likelyQty;
                }
            }
        }

        // Fallback for Qty if not found in port line
        if (!extractedQty) {
            const qMatch = text.match(/(?:الكمية|المنصرفة|Qty|Quantity|PCS|Units)\s*[:.-]?\s*(\d+)/i);
            if (qMatch) extractedQty = qMatch[1];
        }

        // Name Heuristic: Look for Aruba/HP descriptions (Switch, Cable, Cord, etc.)
        const nameKeywords = /Aruba|Switch|Cable|Power|Cord|Transceiver|SFP|6200M|8360|X372/i;
        const nameLine = lines.find(l => nameKeywords.test(l));
        if (nameLine) {
            extractedName = nameLine.split(/[#:]/)[0].replace(/[0-9]+\./, '').trim();
        } else {
            // General Fallback
            const forbidden = /Invoice|Date|Total|Port|Qty|Quantity|Page|Tax|Amount|#|:|--|==|شركة|العاصمة|إذن|صرف|تاريخ/i;
            const nameCandidates = lines.filter(l => l.length > 8 && !forbidden.test(l));
            extractedName = nameCandidates.length > 0 ? nameCandidates[0] : "";
        }

        // --- Fill Inputs ---
        let foundAny = false;
        if (extractedPort) {
            document.getElementById('portInput').value = extractedPort;
            foundAny = true;
        }
        if (extractedQty) {
            document.getElementById('qtyInput').value = extractedQty;
            foundAny = true;
        }
        if (extractedName) {
            document.getElementById('nameInput').value = extractedName;
            foundAny = true;
        }

        document.getElementById('ocrStatus').classList.add('hidden');

        if (foundAny) {
            Swal.fire({
                icon: 'success',
                title: 'تم استخراج البيانات',
                text: 'تم التعرف على صنف: ' + (extractedPort || "غير معروف"),
                timer: 4000,
                showConfirmButton: false
            });
        } else {
            Swal.fire({
                icon: 'info',
                title: 'تنبيه',
                text: 'لم نتمكن من استخراج بيانات واضحة تلقائياً. يرجى إدخالها يدوياً.',
            });
        }

    } catch (error) {
        console.error(error);
        document.getElementById('ocrStatus').classList.add('hidden');
        Swal.fire('خطأ', 'حدث خطأ أثناء قراءة الصورة. تأكد من جودة الصورة.', 'error');
    }
}

// --- Form Submission ---
async function handleFormSubmit(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...';
    submitBtn.disabled = true;

    const formData = new FormData(e.target);
    const data = {
        port: formData.get('port'),
        name: formData.get('name'),
        quantity: formData.get('quantity')
    };

    if (SCRIPT_URL.includes('YOUR_')) {
        // Mock Success
        setTimeout(() => {
            Swal.fire('تم الحفظ', 'تم حفظ البيانات بنجاح (تجريبي)', 'success');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            clearForm();
        }, 1500);
        return;
    }

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'addEntry', data: data })
        });

        const result = await response.json();

        if (result.status === 'success') {
            Swal.fire('تم الحفظ', 'تم إضافة البيانات بنجاح', 'success');
            clearForm();
            refreshData(); // Refresh dashboard
        } else {
            Swal.fire('خطأ', 'فشل الحفظ: ' + result.message, 'error');
        }

    } catch (error) {
        Swal.fire('خطأ', 'حدث خطأ في الاتصال', 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function clearForm() {
    document.getElementById('dataForm').reset();
    document.getElementById('previewImg').src = '';
    document.getElementById('ocrPreview').classList.add('hidden');
}

// --- Charts ---
function initCharts() {
    const ctx1 = document.getElementById('monthlyChart').getContext('2d');
    const ctx2 = document.getElementById('itemsChart').getContext('2d');

    monthlyChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'الكميات',
                data: [],
                backgroundColor: '#4e73df',
                borderRadius: 5
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    itemsChart = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function updateCharts(chartData) {
    // 1. Monthly Chart
    monthlyChart.data.labels = chartData.monthly.labels;
    monthlyChart.data.datasets[0].data = chartData.monthly.data;
    monthlyChart.update();

    // 2. Items Chart
    itemsChart.data.labels = chartData.items.labels;
    itemsChart.data.datasets[0].data = chartData.items.data;
    itemsChart.update();
}

// --- PDF Generation ---
async function requestPDF() {
    const btn = document.getElementById('generatePdfBtn');
    const loading = document.getElementById('pdfLoading');
    const resultDiv = document.getElementById('pdfResult');

    if (SCRIPT_URL.includes('YOUR_')) {
        Swal.fire('تنبيه', 'يجب ربط السكريبت الحقيقي لتوليد PDF', 'info');
        return;
    }

    btn.classList.add('hidden');
    loading.classList.remove('hidden');
    resultDiv.classList.add('hidden');

    try {
        const response = await fetch(`${SCRIPT_URL}?action=generatePDF`);
        const result = await response.json();

        if (result.status === 'success') {
            document.getElementById('pdfDownloadLink').href = result.url;
            resultDiv.classList.remove('hidden');
        } else {
            Swal.fire('خطأ', 'فشل إنشاء الملف', 'error');
            btn.classList.remove('hidden'); // Show button again on error
        }
    } catch (e) {
        Swal.fire('خطأ', 'خطأ في الشبكة', 'error');
        btn.classList.remove('hidden');
    } finally {
        loading.classList.add('hidden');
    }
}

// --- Mock Data (For Demo) ---
function mockDataDisplay() {
    updateDashboard({
        stats: {
            totalQuantity: 1250,
            todayCount: 5,
            topItem: "ماتور ديزل"
        },
        recentEntries: [
            { date: new Date(), port: "A-1", name: "فلتر زيت", quantity: 50 },
            { date: new Date(), port: "B-2", name: "مسمار صلب", quantity: 200 },
        ],
        charts: {
            monthly: {
                labels: ['يناير', 'فبراير'],
                data: [500, 750]
            },
            items: {
                labels: ['فلتر', 'مسمار', 'زيت'],
                data: [30, 50, 20]
            }
        }
    });
}
