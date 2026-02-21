// Initialize Lucide icons
lucide.createIcons();

// State Management
const state = {
    secret: localStorage.getItem('msg91_secret') || '',
    messages: [],
    filters: {
        start_date: '',
        end_date: '',
        mobile: '',
        template: ''
    }
};

// DOM Elements
const authOverlay = document.getElementById('auth-overlay');
const secretInput = document.getElementById('secret-input');
const authBtn = document.getElementById('auth-btn');
const applyFiltersBtn = document.getElementById('apply-filters');
const resetFiltersBtn = document.getElementById('reset-filters');
const logoutBtn = document.getElementById('logout-btn');
const tableBody = document.querySelector('#messages-table tbody');
const loader = document.getElementById('loader');
const emptyState = document.getElementById('empty-state');
const templateFilter = document.getElementById('template-filter');

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
        } else {
            console.error('API Error:', result.message);
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
        tableBody.innerHTML = '';
        emptyState.classList.add('hidden');
    } else {
        loader.classList.add('hidden');
    }
}

function updateUI() {
    // Update Stats
    document.getElementById('total-replies').innerText = state.messages.length;

    const uniqueMobiles = new Set(state.messages.map(m => m.mobile)).size;
    document.getElementById('unique-customers').innerText = uniqueMobiles;

    const todayDate = new Date().toISOString().split('T')[0];
    const todayCount = state.messages.filter(m => m.date1 === todayDate).length;
    document.getElementById('today-messages').innerText = todayCount;

    // Render Table
    if (state.messages.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    tableBody.innerHTML = state.messages.map(msg => `
        <tr>
            <td>
                <div style="font-weight: 600;">${msg.name || 'Unknown'}</div>
            </td>
            <td><code>${msg.mobile}</code></td>
            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${msg.message_body || '<span style="color: grey; font-style: italic;">No content</span>'}
            </td>
            <td><span class="badge purple">${msg.template_name || 'N/A'}</span></td>
            <td>${msg.date2 || 'N/A'}</td>
            <td>${msg.time || 'N/A'}</td>
        </tr>
    `).join('');

    // Update Template Filter if first load
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
        m.name, m.mobile, m.message_body, m.template_name, m.date2, m.time
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
