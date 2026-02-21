// Initialize Lucide icons
lucide.createIcons();

// State Management
const state = {
    secret: localStorage.getItem('msg91_secret') || '',
    messages: [],
    currentView: 'dashboard',
    filters: {
        start_date: '',
        end_date: '',
        mobile: '',
        template: ''
    }
};

// DOM Elements
const body = document.body;
const themeToggle = document.getElementById('theme-toggle');
const sunIcon = document.getElementById('sun-icon');
const moonIcon = document.getElementById('moon-icon');
const flatpickrDarkTheme = document.getElementById('flatpickr-dark-theme');

const authOverlay = document.getElementById('auth-overlay');
const secretInput = document.getElementById('secret-input');
const authBtn = document.getElementById('auth-btn');
const applyFiltersBtn = document.getElementById('apply-filters');
const resetFiltersBtn = document.getElementById('reset-filters');
const logoutBtn = document.getElementById('logout-btn');
const messagesTableBody = document.querySelector('#messages-table tbody');
const customersTableBody = document.querySelector('#customers-table tbody');
const loader = document.getElementById('loader');
const emptyState = document.getElementById('empty-state');
const templateFilter = document.getElementById('template-filter');
const filtersContainer = document.getElementById('filters-container');
const templateFilterGroup = document.getElementById('template-filter-group');

// Navigation Elements
const navLinks = document.querySelectorAll('#sidebar-nav a[data-view]');
const views = document.querySelectorAll('.view-section');
const viewTitle = document.getElementById('view-title');
const viewSubtitle = document.getElementById('view-subtitle');

// Initialize Date Pickers
const datePickerConfig = {
    dateFormat: "Y-m-d",
    allowInput: true,
};

const startPicker = flatpickr("#start-date-filter", datePickerConfig);
const endPicker = flatpickr("#end-date-filter", datePickerConfig);

// Theme Management
const savedTheme = localStorage.getItem('theme') || 'dark-mode';
body.className = savedTheme;
updateThemeIcons(savedTheme);

function updateThemeIcons(theme) {
    if (theme === 'light-mode') {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
        if (flatpickrDarkTheme) flatpickrDarkTheme.disabled = true;
    } else {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
        if (flatpickrDarkTheme) flatpickrDarkTheme.disabled = false;
    }
}

themeToggle.addEventListener('click', () => {
    const isDark = body.classList.contains('dark-mode');
    const newTheme = isDark ? 'light-mode' : 'dark-mode';
    body.className = newTheme;
    localStorage.setItem('theme', newTheme);
    updateThemeIcons(newTheme);
});

// Auth Logic
function checkAuth() {
    if (state.secret) {
        authOverlay.classList.add('hidden');
        fetchData();
    } else {
        authOverlay.classList.remove('hidden');
    }
}

authBtn.addEventListener('click', () => {
    const value = secretInput.value.trim();
    if (value) {
        state.secret = value;
        localStorage.setItem('msg91_secret', value);
        checkAuth();
    }
});

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('msg91_secret');
    state.secret = '';
    window.location.reload();
});

// View Management
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = link.getAttribute('data-view');
        switchView(targetView);
    });
});

function switchView(viewName) {
    state.currentView = viewName;

    // Update Nav UI
    navLinks.forEach(l => l.classList.remove('active'));
    document.querySelector(`#sidebar-nav a[data-view="${viewName}"]`).classList.add('active');

    // Update Section Visibility
    views.forEach(v => v.classList.add('hidden'));
    document.getElementById(`${viewName}-view`).classList.remove('hidden');

    // Update Header and Filters
    if (viewName === 'dashboard') {
        viewTitle.innerText = 'Overview Metrics';
        viewSubtitle.innerText = 'Real-time performance overview';
        filtersContainer.classList.add('hidden');
    } else if (viewName === 'reports') {
        viewTitle.innerText = 'WhatsApp Replies';
        viewSubtitle.innerText = 'Detailed communication logs and filters';
        filtersContainer.classList.remove('hidden');
        templateFilterGroup.classList.remove('hidden');
    } else if (viewName === 'customers') {
        viewTitle.innerText = 'Customer Directory';
        viewSubtitle.innerText = 'List of active subscribers and contacts';
        filtersContainer.classList.remove('hidden');
        templateFilterGroup.classList.add('hidden'); // No template filter for customers
    }

    updateUI();
}

// Fetch Data
async function fetchData() {
    showLoader(true);

    const params = new URLSearchParams();
    if (state.filters.start_date) params.append('start_date', state.filters.start_date);
    if (state.filters.end_date) params.append('end_date', state.filters.end_date);
    if (state.filters.mobile) params.append('mobile', state.filters.mobile);
    if (state.filters.template) params.append('template_name', state.filters.template);

    try {
        const response = await fetch(`https://msg91-webhook.vercel.app/api/get-messages?${params.toString()}`, {
            headers: {
                'msg91-webhook-secret': state.secret
            }
        });

        if (response.status === 401) {
            alert('Invalid Secret Key. Please try again.');
            localStorage.removeItem('msg91_secret');
            window.location.reload();
            return;
        }

        const result = await response.json();

        if (result.success) {
            state.messages = result.data;
            updateUI();
        }
    } catch (error) {
        console.error('Fetch Error:', error);
    } finally {
        showLoader(false);
    }
}

function showLoader(show) {
    if (show) {
        loader.classList.remove('hidden');
        if (messagesTableBody) messagesTableBody.innerHTML = '';
        if (customersTableBody) customersTableBody.innerHTML = '';
        emptyState.classList.add('hidden');
    } else {
        loader.classList.add('hidden');
    }
}

function updateUI() {
    // 1. Update Stats (Always visible in state)
    document.getElementById('total-replies').innerText = state.messages.length;

    const customers = getUniqueCustomers();
    document.getElementById('unique-customers').innerText = customers.length;

    const todayDate = new Date().toISOString().split('T')[0];
    const todayCount = state.messages.filter(m => m.date1 === todayDate).length;
    document.getElementById('today-messages').innerText = todayCount;

    // 2. Render Active View
    if (state.messages.length === 0) {
        if (state.currentView !== 'dashboard') emptyState.classList.remove('hidden');
        return;
    } else {
        emptyState.classList.add('hidden');
    }

    if (state.currentView === 'reports') {
        renderReports();
    } else if (state.currentView === 'customers') {
        renderCustomers(customers);
    }

    // 3. Update Template Filter if first load
    if (templateFilter.options.length <= 1) {
        const templates = [...new Set(state.messages.map(m => m.template_name).filter(Boolean))];
        templates.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.innerText = t;
            templateFilter.appendChild(opt);
        });
    }
}

function getUniqueCustomers() {
    const customerMap = new Map();
    state.messages.forEach(m => {
        if (!customerMap.has(m.mobile)) {
            customerMap.set(m.mobile, m.name || 'Unknown');
        }
    });
    return Array.from(customerMap, ([mobile, name]) => ({ mobile, name }));
}

function renderReports() {
    if (!messagesTableBody) return;
    messagesTableBody.innerHTML = state.messages.map(msg => `
        <tr>
            <td><div style="font-weight: 600;">${msg.name || 'Unknown'}</div></td>
            <td><code>${msg.mobile}</code></td>
            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${msg.message_body || '<span style="color: grey; font-style: italic;">No content</span>'}
            </td>
            <td><span class="badge purple">${msg.template_name || 'N/A'}</span></td>
            <td>${msg.date2 || 'N/A'}</td>
            <td>${msg.time || 'N/A'}</td>
        </tr>
    `).join('');
}

function renderCustomers(customers) {
    if (!customersTableBody) return;
    customersTableBody.innerHTML = customers.map(cust => `
        <tr>
            <td><div style="font-weight: 600;">${cust.name}</div></td>
            <td><code>${cust.mobile}</code></td>
        </tr>
    `).join('');
}

// Filter Actions
applyFiltersBtn.addEventListener('click', () => {
    state.filters.start_date = document.getElementById('start-date-filter').value;
    state.filters.end_date = document.getElementById('end-date-filter').value;
    state.filters.mobile = document.getElementById('mobile-filter').value.trim();
    state.filters.template = templateFilter.value;
    fetchData();
});

resetFiltersBtn.addEventListener('click', () => {
    document.getElementById('start-date-filter').value = '';
    document.getElementById('end-date-filter').value = '';
    startPicker.clear();
    endPicker.clear();
    document.getElementById('mobile-filter').value = '';
    templateFilter.value = '';
    state.filters = { start_date: '', end_date: '', mobile: '', template: '' };
    fetchData();
});

// CSV Export
document.getElementById('export-csv').addEventListener('click', () => {
    if (state.messages.length === 0) return;

    const headers = ['Name', 'Mobile', 'Message', 'Template', 'Date', 'Time'];
    const rows = state.messages.map(m => [
        `"${m.name || 'Unknown'}"`,
        `"${m.mobile}"`,
        `"${(m.message_body || '').replace(/"/g, '""')}"`,
        `"${m.template_name || 'N/A'}"`,
        m.date2,
        m.time
    ]);

    let csvContent = "data:text/csv;charset=utf-8,"
        + headers.join(",") + "\n"
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `msg91_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Init
checkAuth();
