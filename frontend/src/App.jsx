import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ShieldCheck, LayoutDashboard, MessageSquare, Users, LogOut, Key,
  MessageCircle, Calendar, Users2, Search, RefreshCw,
  Download, Inbox, ChevronLeft, ChevronRight, Eye, X
} from 'lucide-react';
import Flatpickr from 'react-flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import './index.css';

// ── Date Helpers ──────────────────────────────────────────────
function formatDate(date) {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

function getToday() {
  const d = new Date();
  return { start: formatDate(d), end: formatDate(d) };
}

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return { start: formatDate(d), end: formatDate(d) };
}

function getLast7Days() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  return { start: formatDate(start), end: formatDate(end) };
}

function getThisMonth() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: formatDate(start), end: formatDate(now) };
}

function getLastMonth() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
  return { start: formatDate(start), end: formatDate(end) };
}

const DATE_PRESETS = [
  { label: 'Today', fn: getToday },
  { label: 'Yesterday', fn: getYesterday },
  { label: 'Last 7 Days', fn: getLast7Days },
  { label: 'This Month', fn: getThisMonth },
  { label: 'Last Month', fn: getLastMonth },
  { label: 'Custom', fn: null },
];

function getMessageContent(msg) {
  const type = msg.raw_payload?.messageType || msg.raw_payload?.contentType;
  if (type === 'button') {
    try {
      const btnRaw = msg.raw_payload.button;
      const btnData = typeof btnRaw === 'string' ? JSON.parse(btnRaw) : btnRaw;
      return btnData?.text || btnData?.payload || msg.message_body || 'Button Response';
    } catch (e) {
      return msg.raw_payload.button || msg.message_body || 'Button Response';
    }
  }
  if (type === 'image') {
    return '[Image] ' + (msg.raw_payload?.caption || msg.raw_payload?.text || '');
  }
  if (type === 'audio') {
    return '[Audio] ' + (msg.raw_payload?.caption || msg.raw_payload?.text || '');
  }
  if (type === 'video') {
    return '[Video] ' + (msg.raw_payload?.caption || msg.raw_payload?.text || '');
  }
  return msg.message_body || msg.raw_payload?.text || '';
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [secret, setSecret] = useState(localStorage.getItem('msg91_secret') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('msg91_logged_in') === 'true');
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [emailInput, setEmailInput] = useState('admin@gmail.com');
  const [passwordInput, setPasswordInput] = useState('admin@123');
  const [secretInput, setSecretInput] = useState(secret || '');
  const [authError, setAuthError] = useState('');

  const [messages, setMessages] = useState([]);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);

  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    mobile: '',
    template: ''
  });

  const [datePreset, setDatePreset] = useState('Today');
  const [showCustomDate, setShowCustomDate] = useState(false);

  // Message Details Modal
  const [selectedMessage, setSelectedMessage] = useState(null);

  // Pagination
  const ROWS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(messages.length / ROWS_PER_PAGE);
  const paginatedMessages = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return messages.slice(start, start + ROWS_PER_PAGE);
  }, [messages, currentPage]);

  // Track if initial reports fetch has happened
  const reportsFetchedRef = useRef(false);

  // ── Derived state ──
  const templates = useMemo(() => [...new Set(messages.map(m => m.template_name).filter(Boolean))], [messages]);

  const uniqueCustomers = useMemo(() => {
    const customerMap = new Map();
    messages.forEach(m => {
      if (!customerMap.has(m.mobile)) {
        customerMap.set(m.mobile, m.name || 'Unknown');
      }
    });
    return Array.from(customerMap, ([mobile, name]) => ({ mobile, name }));
  }, [messages]);

  const todayCount = useMemo(() => {
    const todayDate = new Date().toISOString().split('T')[0];
    return messages.filter(m => m.date1 === todayDate).length;
  }, [messages]);

  // ── Auth ──
  const handleAuth = (e) => {
    if (e) e.preventDefault();
    if (emailInput === 'admin@gmail.com' && passwordInput === 'admin@123') {
      localStorage.setItem('msg91_logged_in', 'true');
      setIsAuthenticated(true);
      setAuthError('');
      // If no webhook secret stored, show modal
      if (!localStorage.getItem('msg91_secret')) {
        setShowSecretModal(true);
      }
    } else {
      setAuthError('Invalid email or password.');
    }
  };

  const handleSecretSubmit = (e) => {
    if (e) e.preventDefault();
    const val = secretInput.trim();
    if (val) {
      setSecret(val);
      localStorage.setItem('msg91_secret', val);
      setShowSecretModal(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('msg91_secret');
    localStorage.removeItem('msg91_logged_in');
    setSecret('');
    setIsAuthenticated(false);
    setMessages([]);
    reportsFetchedRef.current = false;
  };

  // ── Fetch (accepts explicit overrides) ──
  const fetchData = useCallback(async (overrideFilters) => {
    if (!secret) return;
    setIsLoading(true);

    const f = overrideFilters || filters;
    const params = new URLSearchParams();
    if (f.start_date) params.append('start_date', f.start_date);
    if (f.end_date) params.append('end_date', f.end_date);
    if (f.mobile) params.append('mobile', f.mobile);
    if (f.template) params.append('template_name', f.template);

    try {
      const response = await fetch(`/api/get-messages?${params.toString()}`, {
        headers: { 'msg91-webhook-secret': secret }
      });

      if (response.status === 401) {
        alert('Invalid Secret Key. Please try again.');
        handleLogout();
        return;
      }

      const result = await response.json();
      if (result.success) {
        setMessages(result.data);
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('Fetch Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [secret, filters]);

  // Fetch dashboard data on auth (no date filter)
  useEffect(() => {
    if (isAuthenticated && secret) {
      fetchData({ start_date: '', end_date: '', mobile: '', template: '' });
    }
    // Show secret modal if logged in but no secret stored
    if (isAuthenticated && !secret) {
      setShowSecretModal(true);
    }
  }, [isAuthenticated, secret]);

  // Auto-load today's data when switching to Reports view
  useEffect(() => {
    if (currentView === 'reports' && isAuthenticated && !reportsFetchedRef.current) {
      reportsFetchedRef.current = true;
      const today = getToday();
      setDatePreset('Today');
      setShowCustomDate(false);
      const newFilters = { start_date: today.start, end_date: today.end, mobile: '', template: '' };
      setFilters(newFilters);
      fetchData(newFilters);
    }
  }, [currentView, isAuthenticated]);

  // ── Date Preset Handler ──
  const handlePresetClick = (preset) => {
    setDatePreset(preset.label);
    if (preset.fn) {
      setShowCustomDate(false);
      const range = preset.fn();
      const newFilters = { ...filters, start_date: range.start, end_date: range.end };
      setFilters(newFilters);
      fetchData(newFilters);
    } else {
      setShowCustomDate(true);
    }
  };

  const handleApplyFilters = () => {
    fetchData(filters);
  };

  const handleResetFilters = () => {
    const today = getToday();
    const newFilters = { start_date: today.start, end_date: today.end, mobile: '', template: '' };
    setFilters(newFilters);
    setDatePreset('Today');
    setShowCustomDate(false);
    fetchData(newFilters);
  };

  const exportCSV = () => {
    if (messages.length === 0) return;
    const headers = ['Name', 'Mobile', 'Message', 'Template', 'Date', 'Time'];
    const rows = messages.map(m => [
      `"${m.name || 'Unknown'}"`,
      `"${m.mobile}"`,
      `"${(getMessageContent(m)).replace(/"/g, '""')}"`,
      `"${m.template_name || 'N/A'}"`,
      m.date2,
      m.time
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `msg91_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Auth Screen ──
  if (!isAuthenticated) {
    return (
      <div className="auth-overlay">
        <div className="auth-card">
          <div className="auth-header">
            <div className="icon-circle"><ShieldCheck /></div>
            <h1>Admin Login</h1>
            <p>Sign in to access your dashboard</p>
          </div>
          <form className="auth-body" onSubmit={handleAuth}>
            {authError && <div style={{ color: '#ef4444', fontSize: '14px', marginBottom: '16px', fontWeight: '500' }}>{authError}</div>}
            <input
              type="email"
              placeholder="Email address"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              required
            />
            <button type="submit">Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  // ── Dashboard ──
  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon"></div>
          <span>MSG91 Admin</span>
        </div>
        <nav id="sidebar-nav">
          <a href="#" className={currentView === 'dashboard' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setCurrentView('dashboard'); }}><LayoutDashboard /> Dashboard</a>
          <a href="#" className={currentView === 'reports' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setCurrentView('reports'); }}><MessageSquare /> WhatsApp Replies</a>
          <a href="#" className={currentView === 'customers' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setCurrentView('customers'); }}><Users /> Customers</a>
        </nav>
        <div className="sidebar-footer">
          <button onClick={handleLogout}><LogOut /> Sign Out</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-bar">
          <div className="page-title">
            <h2>
              {currentView === 'dashboard' && 'Overview Metrics'}
              {currentView === 'reports' && 'WhatsApp Replies'}
              {currentView === 'customers' && 'Customer Directory'}
            </h2>
            <p>
              {currentView === 'dashboard' && 'Real-time performance overview'}
              {currentView === 'reports' && 'Detailed communication logs and filters'}
              {currentView === 'customers' && 'List of active subscribers and contacts'}
            </p>
          </div>
          <div className="user-profile">
            <span className="status-badge pulse">
              <span className="dot"></span> Connected
            </span>
            <div className="avatar">AD</div>
          </div>
        </header>

        {/* ── Dashboard View ── */}
        {currentView === 'dashboard' && (
          <section className="view-section">
            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon purple"><MessageCircle /></div>
                <div className="stat-info"><h3>Total Replies</h3><p>{messages.length}</p></div>
              </div>
              <div className="stat-card">
                <div className="stat-icon blue"><Calendar /></div>
                <div className="stat-info"><h3>Today's Messages</h3><p>{todayCount}</p></div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green"><Users2 /></div>
                <div className="stat-info"><h3>Unique Customers</h3><p>{uniqueCustomers.length}</p></div>
              </div>
            </section>
          </section>
        )}

        {/* ── Reports / Customers Filters ── */}
        {currentView !== 'dashboard' && (
          <section className="filters-section">
            {/* Date Presets (only on reports) */}
            {currentView === 'reports' && (
              <div className="filter-group date-presets-group">
                <label>Date Range</label>
                <div className="date-presets">
                  {DATE_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      className={`preset-btn ${datePreset === preset.label ? 'active' : ''}`}
                      onClick={() => handlePresetClick(preset)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {/* Custom Date Picker (shown when "Custom" is selected) */}
                {showCustomDate && (
                  <div className="date-inputs" style={{ marginTop: 10 }}>
                    <Flatpickr
                      placeholder="Start Date"
                      value={filters.start_date}
                      onChange={([date]) => {
                        if (date) setFilters(f => ({ ...f, start_date: formatDate(date) }));
                        else setFilters(f => ({ ...f, start_date: '' }));
                      }}
                      options={{ dateFormat: 'Y-m-d', allowInput: true }}
                    />
                    <span>to</span>
                    <Flatpickr
                      placeholder="End Date"
                      value={filters.end_date}
                      onChange={([date]) => {
                        if (date) setFilters(f => ({ ...f, end_date: formatDate(date) }));
                        else setFilters(f => ({ ...f, end_date: '' }));
                      }}
                      options={{ dateFormat: 'Y-m-d', allowInput: true }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Customers view: simple date range */}
            {currentView === 'customers' && (
              <div className="filter-group">
                <label>Date Range</label>
                <div className="date-inputs">
                  <Flatpickr
                    placeholder="Start Date"
                    value={filters.start_date}
                    onChange={([date]) => {
                      if (date) setFilters(f => ({ ...f, start_date: formatDate(date) }));
                      else setFilters(f => ({ ...f, start_date: '' }));
                    }}
                    options={{ dateFormat: 'Y-m-d', allowInput: true }}
                  />
                  <span>to</span>
                  <Flatpickr
                    placeholder="End Date"
                    value={filters.end_date}
                    onChange={([date]) => {
                      if (date) setFilters(f => ({ ...f, end_date: formatDate(date) }));
                      else setFilters(f => ({ ...f, end_date: '' }));
                    }}
                    options={{ dateFormat: 'Y-m-d', allowInput: true }}
                  />
                </div>
              </div>
            )}

            <div className="filter-group">
              <label>Search Mobile</label>
              <input
                type="text"
                placeholder="91XXXXXXXXXX"
                value={filters.mobile}
                onChange={e => setFilters(f => ({ ...f, mobile: e.target.value }))}
              />
            </div>

            {currentView === 'reports' && (
              <div className="filter-group">
                <label>Template</label>
                <select value={filters.template} onChange={e => setFilters(f => ({ ...f, template: e.target.value }))}>
                  <option value="">All Templates</option>
                  {templates.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}

            <button className="primary-btn" onClick={handleApplyFilters}>
              <Search /> Run Report
            </button>
            <button className="secondary-btn" onClick={handleResetFilters}>
              <RefreshCw />
            </button>
          </section>
        )}

        {/* ── Content Area ── */}
        {isLoading ? (
          <div className="loader-container">
            <div className="spinner"></div>
            <p>Loading analytics...</p>
          </div>
        ) : messages.length === 0 && currentView !== 'dashboard' ? (
          <div className="empty-state">
            <Inbox />
            <p>No data found for the selected view</p>
          </div>
        ) : (
          <>
            {currentView === 'reports' && (
              <section className="view-section">
                <div className="content-grid">
                  <div className="table-container card">
                    <div className="card-header">
                      <h3>Communication Logs</h3>
                      <div className="actions">
                        <button onClick={exportCSV}><Download /> Export</button>
                      </div>
                    </div>
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Customer</th>
                            <th>Mobile</th>
                            <th>Message Body</th>
                            <th>Template</th>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedMessages.map((msg, idx) => (
                            <tr key={idx}>
                              <td><div style={{ fontWeight: 600 }}>{msg.name || 'Unknown'}</div></td>
                              <td><code>{msg.mobile}</code></td>
                              <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {getMessageContent(msg) || <span style={{ color: 'grey', fontStyle: 'italic' }}>No content</span>}
                              </td>
                              <td><span className="badge purple">{msg.template_name || 'N/A'}</span></td>
                              <td>{msg.date2 || 'N/A'}</td>
                              <td>{msg.time || 'N/A'}</td>
                              <td>
                                <button
                                  className="secondary-btn"
                                  style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                                  onClick={() => setSelectedMessage(msg)}
                                >
                                  <Eye size={14} /> View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="pagination">
                        <span className="pagination-info">
                          Showing {((currentPage - 1) * ROWS_PER_PAGE) + 1}–{Math.min(currentPage * ROWS_PER_PAGE, messages.length)} of {messages.length}
                        </span>
                        <div className="pagination-controls">
                          <button
                            className="page-btn"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                          >
                            <ChevronLeft size={16} /> Prev
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                              key={page}
                              className={`page-btn ${page === currentPage ? 'active' : ''}`}
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </button>
                          ))}
                          <button
                            className="page-btn"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                          >
                            Next <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {currentView === 'customers' && (
              <section className="view-section">
                <div className="content-grid">
                  <div className="table-container card">
                    <div className="card-header">
                      <h3>Customer Directory</h3>
                    </div>
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Customer Name</th>
                            <th>Mobile Number</th>
                          </tr>
                        </thead>
                        <tbody>
                          {uniqueCustomers.map((cust, idx) => (
                            <tr key={idx}>
                              <td><div style={{ fontWeight: 600 }}>{cust.name}</div></td>
                              <td><code>{cust.mobile}</code></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Webhook Secret Modal */}
      {showSecretModal && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content">
            <div className="modal-header">
              <h3><Key size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} /> Webhook Secret</h3>
            </div>
            <form className="modal-body" onSubmit={handleSecretSubmit} style={{ padding: '24px' }}>
              <p style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                Enter your MSG91 Webhook Secret to connect to the API.
              </p>
              <input
                type="password"
                placeholder="Enter Webhook Secret..."
                value={secretInput}
                onChange={e => setSecretInput(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  marginBottom: '16px'
                }}
              />
              <button
                type="submit"
                className="primary-btn"
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              >
                Save & Connect
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Message Details Modal */}
      {selectedMessage && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3><Eye size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} /> Message Details</h3>
              <button className="close-modal" onClick={() => setSelectedMessage(null)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ padding: '24px', textAlign: 'left' }}>
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>Customer: </span>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>{selectedMessage.name || 'Unknown'} ({selectedMessage.mobile})</span>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600', display: 'block', marginBottom: '8px' }}>Content: </span>
                <div style={{ background: 'var(--input-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '14px', lineHeight: '1.5' }}>
                  {selectedMessage.raw_payload?.messageType === 'image' || selectedMessage.raw_payload?.contentType === 'image' ? (
                    <div>
                      <img
                        src={selectedMessage.raw_payload?.url}
                        alt="WhatsApp Media"
                        style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '8px' }}
                      />
                      {selectedMessage.raw_payload?.text && <p>{selectedMessage.raw_payload.text}</p>}
                      {selectedMessage.raw_payload?.caption && <p>{selectedMessage.raw_payload.caption}</p>}
                    </div>
                  ) : selectedMessage.raw_payload?.messageType === 'audio' || selectedMessage.raw_payload?.contentType === 'audio' ? (
                    <div>
                      <audio controls style={{ width: '100%', marginBottom: '8px' }}>
                        <source src={selectedMessage.raw_payload?.url} />
                        Your browser does not support the audio element.
                      </audio>
                      {selectedMessage.raw_payload?.text && <p>{selectedMessage.raw_payload.text}</p>}
                      {selectedMessage.raw_payload?.caption && <p>{selectedMessage.raw_payload.caption}</p>}
                    </div>
                  ) : selectedMessage.raw_payload?.messageType === 'video' || selectedMessage.raw_payload?.contentType === 'video' ? (
                    <div>
                      <video controls style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '8px' }}>
                        <source src={selectedMessage.raw_payload?.url} />
                        Your browser does not support the video element.
                      </video>
                      {selectedMessage.raw_payload?.text && <p>{selectedMessage.raw_payload.text}</p>}
                      {selectedMessage.raw_payload?.caption && <p>{selectedMessage.raw_payload.caption}</p>}
                    </div>
                  ) : selectedMessage.raw_payload?.messageType === 'button' || selectedMessage.raw_payload?.contentType === 'button' ? (
                    <div>
                      <p style={{ marginBottom: '8px', color: 'var(--text-secondary)' }}>Button Selection:</p>
                      <div style={{ display: 'inline-block', background: 'var(--accent-purple)', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: '500' }}>
                        {getMessageContent(selectedMessage)}
                      </div>
                    </div>
                  ) : (
                    <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {getMessageContent(selectedMessage) || <span style={{ color: 'grey', fontStyle: 'italic' }}>No content</span>}
                    </p>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600', display: 'block' }}>Date & Time: </span>
                  <span style={{ fontSize: '14px' }}>{selectedMessage.date2} at {selectedMessage.time}</span>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600', display: 'block' }}>Template: </span>
                  <span style={{ fontSize: '14px' }} className="badge purple">{selectedMessage.template_name || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
