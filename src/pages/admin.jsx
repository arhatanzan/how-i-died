import React, { useState, useEffect } from 'react';
import { APP_REQUEST_ID } from '../config.js';

/**
 * Admin Panel - Structured database management
 * Focuses on notes management with relational schema awareness
 */
export function AdminPanel() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [notes, setNotes] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = localStorage.getItem('theme');
    return saved === 'light' ? 'light' : 'dark';
  });
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [selectedNote, setSelectedNote] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('json');
  const [exportFormats] = useState([
    { id: 'json', label: 'JSON (Default)' },
    { id: 'csv', label: 'CSV (Excel/Spreadsheet)' },
    { id: 'mongodb', label: 'MongoDB Export' },
    { id: 'postgres', label: 'PostgreSQL Export' },
    { id: 'mysql', label: 'MySQL Export' },
    { id: 'dynamodb', label: 'AWS DynamoDB Export' },
    { id: 'firestore', label: 'Google Firestore Export' },
    { id: 'rds-postgres', label: 'AWS RDS (PostgreSQL)' },
    { id: 'rds-mysql', label: 'AWS RDS (MySQL)' },
  ]);

  const moods = ['terrible', 'sad', 'meh', 'ok', 'good', 'great'];

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/tables');
      if (response.ok) {
        setAuthenticated(true);
        loadData();
      } else if (response.status === 401) {
        setAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setApiError('Cannot connect to API. Make sure the server is running.');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');
    setApiError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-requested-with': APP_REQUEST_ID,
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setAuthenticated(true);
        loadData();
      } else {
        setLoginError(data.error || 'Invalid credentials');
      }
    } catch (error) {
      setLoginError('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setApiError('');
    try {
      const [notesRes, statsRes] = await Promise.all([
        fetch('/api/admin/table/notes'),
        fetch('/api/admin/stats'),
      ]);

      if (notesRes.ok) {
        const data = await notesRes.json();
        setNotes(data.records || []);
      } else if (notesRes.status === 401) {
        setAuthenticated(false);
        setApiError('Session expired. Please login again.');
      } else {
        setApiError('Failed to load notes');
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats || {});
      }
    } catch (error) {
      setApiError('Network error: ' + error.message);
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: { 'x-requested-with': APP_REQUEST_ID },
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAuthenticated(false);
      setNotes([]);
      setSelectedNote(null);
      setStats({});
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    setApiError('');
    try {
      const response = await fetch(`/api/admin/record/notes/${noteId}`, {
        method: 'DELETE',
        headers: { 'x-requested-with': APP_REQUEST_ID },
      });

      if (response.ok) {
        setNotes(notes.filter(n => n._id !== noteId));
        setSelectedNote(null);
      } else if (response.status === 401) {
        setAuthenticated(false);
      } else {
        const data = await response.json();
        setApiError(data.error || 'Failed to delete note');
      }
    } catch (error) {
      setApiError('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditNote = (note) => {
    setEditingNote({ ...note });
    setSelectedNote(null);
  };

  const handleExportDatabase = async () => {
    setLoading(true);
    setApiError('');
    try {
      const response = await fetch(`/api/admin/export-db/notes/${exportFormat}`);
      if (response.ok) {
        const data = await response.json();
        
        // Create downloadable file
        const content = exportFormat === 'csv' ? data.data : JSON.stringify(data, null, 2);
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `journal-export-${new Date().toISOString().split('T')[0]}.${exportFormat === 'csv' ? 'csv' : 'json'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setShowExportModal(false);
      } else if (response.status === 401) {
        setAuthenticated(false);
      } else {
        const data = await response.json();
        setApiError(data.error || 'Export failed');
      }
    } catch (error) {
      setApiError('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="admin-panel admin-login-container">
        <div className="admin-login-box">
          <h1 className="admin-title">Admin Panel</h1>
          <p className="admin-subtitle">Database Management</p>
          
          <form onSubmit={handleLogin}>
            <div className="admin-form-group">
              <label className="admin-label">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="admin-input"
                placeholder="Enter username"
                disabled={loading}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="admin-input"
                placeholder="Enter password"
                disabled={loading}
              />
            </div>

            {loginError && (
              <div className="admin-error-box">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="admin-btn admin-btn-primary"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
            </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header-content">
          <div>
            <h1 className="admin-title">Admin Panel</h1>
            <p className="admin-subtitle">Journal Database Management</p>
          </div>
          <div className="admin-header-actions">
            <button
              onClick={toggleTheme}
              className="admin-btn admin-btn-outline"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              title={`${theme === 'light' ? 'Dark' : 'Light'} mode`}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button
              onClick={handleLogout}
              className="admin-btn admin-btn-danger"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="admin-content">
        {/* Stats Cards */}
        <div className="admin-stats">
          <div className="admin-stat-card">
            <h3 className="admin-stat-label">Total Notes</h3>
            <p className="admin-stat-value">{notes.length}</p>
            {stats.notes && (
              <p className="admin-stat-subtext">
                {(stats.notes.size / 1024).toFixed(2)} KB
              </p>
            )}
          </div>

          <div className="admin-stat-card">
            <h3 className="admin-stat-label">Attachments</h3>
            <p className="admin-stat-value">
              {stats.attachments?.count || 0}
            </p>
            {stats.images && (
              <p className="admin-stat-subtext">
                {(stats.images.size / 1024).toFixed(2)} KB stored
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="admin-actions">
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="admin-btn admin-btn-primary"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="admin-btn admin-btn-success"
          >
            Export Database
          </button>
        </div>

        {apiError && (
          <div className="admin-error-box">
            {apiError}
          </div>
        )}

        {/* Notes List */}
        <div className="admin-table-container">
          <div className="admin-table-header">
            <h2 className="admin-table-title">Notes</h2>
          </div>
          
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Content</th>
                  <th>Mood</th>
                  <th>Public</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {notes.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="admin-table-empty">
                      No notes found
                    </td>
                  </tr>
                ) : (
                  notes.map((note) => (
                    <tr key={note._id}>
                      <td>
                        {new Date(note.createdAt).toLocaleDateString()}
                      </td>
                      <td className="admin-table-text-truncate">
                        {note.text?.substring(0, 50) || 'No text'}
                      </td>
                      <td>
                        <span className="admin-badge admin-badge-mood">
                          {note.mood}
                        </span>
                      </td>
                      <td>
                        <span className={note.isPublic ? 'admin-badge admin-badge-public' : 'admin-badge admin-badge-private'}>
                          {note.isPublic ? '✓ Public' : 'Private'}
                        </span>
                      </td>
                      <td className="admin-table-actions">
                        <button
                          onClick={() => setSelectedNote(note)}
                          className="admin-link admin-link-primary"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note._id)}
                          className="admin-link admin-link-danger"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="admin-modal">
          <div className="admin-modal-content">
            <h2 className="admin-modal-title">Export Database</h2>
            
            <div className="admin-form-group">
              <label className="admin-label">Select Format:</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className="admin-input"
              >
                {exportFormats.map(fmt => (
                  <option key={fmt.id} value={fmt.id}>{fmt.label}</option>
                ))}
              </select>
            </div>

            {apiError && (
              <div className="admin-error-box">
                {apiError}
              </div>
            )}

            <div className="admin-modal-actions">
              <button
                onClick={() => setShowExportModal(false)}
                className="admin-btn admin-btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={handleExportDatabase}
                disabled={loading}
                className="admin-btn admin-btn-success"
              >
                {loading ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Detail Modal */}
      {selectedNote && (
        <div className="admin-modal">
          <div className="admin-modal-content admin-modal-large">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Note Details</h2>
              <button
                onClick={() => setSelectedNote(null)}
                className="admin-modal-close"
              >
                ✕
              </button>
            </div>
            
            <div className="admin-detail-fields">
              <div>
                <h3 className="admin-field-label">Date</h3>
                <p className="admin-field-value">{new Date(selectedNote.createdAt).toLocaleString()}</p>
              </div>
              
              <div>
                <h3 className="admin-field-label">Mood</h3>
                <p className="admin-field-value capitalize">{selectedNote.mood}</p>
              </div>

              <div>
                <h3 className="admin-field-label">Content</h3>
                <p className="admin-field-value admin-field-pre">{selectedNote.text}</p>
              </div>

              {selectedNote.attachments && selectedNote.attachments.length > 0 && (
                <div>
                  <h3 className="admin-field-label">Attachments</h3>
                  <div className="admin-attachments">
                    {selectedNote.attachments.map((att, idx) => (
                      <div key={idx} className="admin-attachment-item">
                        <span className="admin-attachment-type">{att.type}:</span>{' '}
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="admin-link admin-link-primary">
                          {att.url}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
