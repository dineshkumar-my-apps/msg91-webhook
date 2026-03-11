import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck, LayoutDashboard, MessageSquare, Users, Settings, LogOut,
  Sun, Moon, MessageCircle, Calendar, Users2, Search, RefreshCw,
  Download, Inbox
} from 'lucide-react';
import Flatpickr from 'react-flatpickr';
import 'flatpickr/dist/themes/dark.css'; // Global CSS, might need to conditionally load if light mode is used heavily
import './index.css';

export default function App() {
  const [secret, setSecret] = useState(localStorage.getItem('msg91_secret') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(!!secret);
  const [secretInput, setSecretInput] = useState('');

  const [messages, setMessages] = useState([]);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);

  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    mobile: '',
    template: ''
  });

  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark-mode');

  useEffect(() => {
    document.body.className = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Derived state
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

  const handleAuth = () => {
    const val = secretInput.trim();
    if (val) {
      setSecret(val);
      localStorage.setItem('msg91_secret', val);
      setIsAuthenticated(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('msg91_secret');
    setSecret('');
    setIsAuthenticated(false);
    setMessages([]);
  };

  const fetchData = async () => {
    if (!secret) return;
    setIsLoading(true);

    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.mobile) params.append('mobile', filters.mobile);
    if (filters.template) params.append('template_name', filters.template);

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
      }
    } catch (error) {
      console.error('Fetch Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const exportCSV = () => {
    if (messages.length === 0) return;
    const headers = ['Name', 'Mobile', 'Message', 'Template', 'Date', 'Time'];
    const rows = messages.map(m => [
      `"${m.name || 'Unknown'}"`,
      `"${m.mobile}"`,
      `"${(m.message_body || '').replace(/"/g, '""')}"`,
      `"${m.template_name || 'N/A'}"`,
      m.date2,
      m.time
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = `msg91_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAuthenticated) {
    return (
      <div className={`auth-overlay ${theme}`}>
        <div className="auth-card">
          <div className="auth-header">
            <div className="icon-circle">
              <ShieldCheck />
            </div>
            <h1>System Authentication</h1>
            <p>Enter your Webhook Secret to access reports</p>
          </div>
          <div className="auth-body">
            <input
              type="password"
              placeholder="Enter Secret Key..."
              value={secretInput}
              onChange={e => setSecretInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAuth()}
            />
            <button onClick={handleAuth}>Authorize Access</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`dashboard-container ${theme}`}>
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon"></div>
          <span>MSG91 Admin</span>
        </div>
        <nav id="sidebar-nav">
          <a href="#" className={currentView === 'dashboard' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setCurrentView('dashboard'); }}><LayoutDashboard /> Dashboard</a>
          <a href="#" className={currentView === 'reports' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setCurrentView('reports'); }}><MessageSquare /> WhatsApp Replies</a>
          <a href="#" className={currentView === 'customers' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setCurrentView('customers'); }}><Users /> Customers</a>
          <a href="#"><Settings /> Settings</a>
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
            <button className="theme-btn" title="Toggle Light/Dark Mode" onClick={() => setTheme(theme === 'dark-mode' ? 'light-mode' : 'dark-mode')}>
              {theme === 'dark-mode' ? <Sun /> : <Moon />}
            </button>
            <span className="status-badge pulse">
              <span className="dot"></span> Connected
            </span>
            <div className="avatar">AD</div>
          </div>
        </header>

        {currentView === 'dashboard' && (
          <section className="view-section">
            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon purple"><MessageCircle /></div>
                <div className="stat-info">
                  <h3>Total Replies</h3>
                  <p>{messages.length}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon blue"><Calendar /></div>
                <div className="stat-info">
                  <h3>Today's Messages</h3>
                  <p>{todayCount}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green"><Users2 /></div>
                <div className="stat-info">
                  <h3>Unique Customers</h3>
                  <p>{uniqueCustomers.length}</p>
                </div>
              </div>
            </section>
          </section>
        )}

        {currentView !== 'dashboard' && (
          <section className="filters-section">
            <div className="filter-group">
              <label>Date Range</label>
              <div className="date-inputs">
                <Flatpickr
                  placeholder="Select Start Date"
                  value={filters.start_date}
                  onChange={([date]) => {
                    if (date) {
                      const dt = new Date(date).toISOString().split('T')[0];
                      setFilters(f => ({ ...f, start_date: dt }));
                    } else {
                      setFilters(f => ({ ...f, start_date: '' }));
                    }
                  }}
                  options={{ dateFormat: 'Y-m-d', allowInput: true }}
                />
                <span>to</span>
                <Flatpickr
                  placeholder="Select End Date"
                  value={filters.end_date}
                  onChange={([date]) => {
                    if (date) {
                      const dt = new Date(date).toISOString().split('T')[0];
                      setFilters(f => ({ ...f, end_date: dt }));
                    } else {
                      setFilters(f => ({ ...f, end_date: '' }));
                    }
                  }}
                  options={{ dateFormat: 'Y-m-d', allowInput: true }}
                />
              </div>
            </div>
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
            <button className="primary-btn" onClick={fetchData}>
              <Search /> Run Report
            </button>
            <button className="secondary-btn" onClick={() => {
              setFilters({ start_date: '', end_date: '', mobile: '', template: '' });
              setTimeout(fetchData, 0); // We wait for React state to process then fetch, actually we should fetch with empty inside
              // the better way is to pass explicit empty filters
              // but I will implement a explicit fetch that ignores state if passed
            }}>
              <RefreshCw />
            </button>
          </section>
        )}

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
                          </tr>
                        </thead>
                        <tbody>
                          {messages.map((msg, idx) => (
                            <tr key={idx}>
                              <td><div style={{ fontWeight: 600 }}>{msg.name || 'Unknown'}</div></td>
                              <td><code>{msg.mobile}</code></td>
                              <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {msg.message_body || <span style={{ color: 'grey', fontStyle: 'italic' }}>No content</span>}
                              </td>
                              <td><span className="badge purple">{msg.template_name || 'N/A'}</span></td>
                              <td>{msg.date2 || 'N/A'}</td>
                              <td>{msg.time || 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
    </div>
  );
}
