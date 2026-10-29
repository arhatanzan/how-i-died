import React, { useState, useEffect } from 'react';

export function AdminPanel() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [editingRecord, setEditingRecord] = useState(null);
  const [editingField, setEditingField] = useState('');
  const [editingValue, setEditingValue] = useState('');
  const [addFieldName, setAddFieldName] = useState('');
  const [addFieldValue, setAddFieldValue] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [exportFormat, setExportFormat] = useState('json');
  const [showExportModal, setShowExportModal] = useState(false);

  // Check if already authenticated
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/tables');
      if (response.ok) {
        setAuthenticated(true);
        loadTables();
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
          'x-requested-with': 'how-i-died',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setAuthenticated(true);
        loadTables();
      } else {
        setLoginError(data.error || 'Invalid credentials');
      }
    } catch (error) {
      setLoginError('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTables = async () => {
    setLoading(true);
    setApiError('');
    try {
      const [tablesRes, statsRes] = await Promise.all([
        fetch('/api/admin/tables'),
        fetch('/api/admin/stats'),
      ]);

      if (tablesRes.ok) {
        const data = await tablesRes.json();
        setTables(data.tables || []);
      } else if (tablesRes.status === 401) {
        setAuthenticated(false);
        setApiError('Session expired. Please login again.');
      } else {
        setApiError('Failed to load tables');
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats || {});
      }
    } catch (error) {
      setApiError('Network error: ' + error.message);
      console.error('Failed to load tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTableData = async (tableName) => {
    setLoading(true);
    setApiError('');
    setSelectedTable(tableName);
    try {
      const response = await fetch(`/api/admin/table/${tableName}`);
      if (response.ok) {
        const data = await response.json();
        setRecords(data.records || []);
      } else if (response.status === 401) {
        setAuthenticated(false);
        setApiError('Session expired.');
      } else {
        setApiError(`Failed to load table: ${response.statusText}`);
      }
    } catch (error) {
      setApiError('Network error: ' + error.message);
      console.error('Failed to load table:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecord = async () => {
    if (!selectedTable || !addFieldName || !addFieldValue) {
      setApiError('Please fill in both field name and value');
      return;
    }

    setLoading(true);
    setApiError('');
    try {
      const body = { [addFieldName]: addFieldValue };
      const response = await fetch(`/api/admin/record/${selectedTable}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-requested-with': 'how-i-died',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setAddFieldName('');
        setAddFieldValue('');
        await loadTableData(selectedTable);
      } else if (response.status === 401) {
        setAuthenticated(false);
      } else {
        const data = await response.json();
        setApiError(data.error || 'Failed to add record');
      }
    } catch (error) {
      setApiError('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateField = async () => {
    if (!selectedTable || !editingRecord) return;

    setLoading(true);
    setApiError('');
    try {
      const updates = { [editingField]: editingValue };
      const response = await fetch(
        `/api/admin/record/${selectedTable}/${editingRecord._id}`,
        {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'x-requested-with': 'how-i-died',
          },
          body: JSON.stringify(updates),
        }
      );

      if (response.ok) {
        setEditingRecord(null);
        setEditingField('');
        setEditingValue('');
        await loadTableData(selectedTable);
      } else if (response.status === 401) {
        setAuthenticated(false);
      } else {
        const data = await response.json();
        setApiError(data.error || 'Failed to update record');
      }
    } catch (error) {
      setApiError('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (recordId) => {
    if (!window.confirm('Are you sure? This cannot be undone.')) return;

    setLoading(true);
    setApiError('');
    try {
      const response = await fetch(
        `/api/admin/record/${selectedTable}/${recordId}`,
        { 
          method: 'DELETE',
          headers: { 'x-requested-with': 'how-i-died' },
        }
      );

      if (response.ok) {
        await loadTableData(selectedTable);
      } else if (response.status === 401) {
        setAuthenticated(false);
      } else {
        const data = await response.json();
        setApiError(data.error || 'Failed to delete record');
      }
    } catch (error) {
      setApiError('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportTable = async () => {
    if (!selectedTable) return;
    setLoading(true);
    setApiError('');
    try {
      const response = await fetch(`/api/admin/export/${selectedTable}`);
      if (response.ok) {
        const data = await response.json();
        let content, filename, type;
        
        if (exportFormat === 'json') {
          content = JSON.stringify(data, null, 2);
          filename = `${selectedTable}-${new Date().toISOString().split('T')[0]}.json`;
          type = 'application/json';
        } else if (exportFormat === 'csv') {
          const records = data.records || [];
          if (records.length === 0) {
            setApiError('No records to export');
            setLoading(false);
            return;
          }
          
          const headers = ['_id', '_created', '_updated', ...Object.keys(records[0]).filter(k => !k.startsWith('_'))];
          const csvRows = [
            headers.join(','),
            ...records.map(record => 
              headers.map(header => {
                const value = record[header] ?? '';
                const escaped = String(value).replace(/"/g, '""');
                return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n') ? `"${escaped}"` : escaped;
              }).join(',')
            )
          ];
          content = csvRows.join('\n');
          filename = `${selectedTable}-${new Date().toISOString().split('T')[0]}.csv`;
          type = 'text/csv';
        } else if (exportFormat === 'jsonl') {
          const records = data.records || [];
          content = records.map(r => JSON.stringify(r)).join('\n');
          filename = `${selectedTable}-${new Date().toISOString().split('T')[0]}.jsonl`;
          type = 'application/x-ndjson';
        }
        
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setShowExportModal(false);
      } else {
        setApiError('Failed to export table');
      }
    } catch (error) {
      setApiError('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportAllTables = async () => {
    setLoading(true);
    setApiError('');
    try {
      const allData = {};
      for (const table of tables) {
        const response = await fetch(`/api/admin/export/${table}`);
        if (response.ok) {
          const data = await response.json();
          allData[table] = data;
        }
      }
      
      let content, filename, type;
      
      if (exportFormat === 'json') {
        content = JSON.stringify(allData, null, 2);
        filename = `database-${new Date().toISOString().split('T')[0]}.json`;
        type = 'application/json';
      } else if (exportFormat === 'jsonl') {
        const lines = [];
        for (const [tableName, tableData] of Object.entries(allData)) {
          for (const record of (tableData.records || [])) {
            lines.push(JSON.stringify({ ...record, _table: tableName }));
          }
        }
        content = lines.join('\n');
        filename = `database-${new Date().toISOString().split('T')[0]}.jsonl`;
        type = 'application/x-ndjson';
      }
      
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setShowExportModal(false);
    } catch (error) {
      setApiError('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getAllColumns = () => {
    const columns = new Set(['_id', '_created', '_updated']);
    records.forEach(record => {
      Object.keys(record).forEach(key => {
        if (!key.startsWith('_')) columns.add(key);
      });
    });
    return Array.from(columns);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { 
        method: 'POST',
        headers: { 'x-requested-with': 'how-i-died' }
      });
    } catch {}
    setAuthenticated(false);
    setUsername('');
    setPassword('');
    setRecords([]);
    setTables([]);
    setSelectedTable(null);
    setSelectedRecord(null);
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold mb-2 text-gray-900">Admin Panel</h1>
          <p className="text-gray-600 mb-6 text-sm">Manage your data</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter username"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter password"
                required
              />
            </div>
            
            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {loginError}
              </div>
            )}
            
            {apiError && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-sm">
                {apiError}
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Admin Panel</h1>
            <p className="text-gray-400 text-sm">Database Management</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg transition font-medium"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* API Error Alert */}
        {apiError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex justify-between items-center">
            <span>{apiError}</span>
            <button onClick={() => setApiError('')} className="text-red-700 hover:text-red-900">✕</button>
          </div>
        )}

        {/* Stats */}
        {Object.keys(stats).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {Object.entries(stats).map(([tableName, stat]) => (
              <div key={tableName} className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
                <p className="text-gray-600 text-sm font-medium">{tableName}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stat.count}</p>
                <p className="text-xs text-gray-500 mt-2">{(stat.size / 1024).toFixed(2)} KB</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Tables Sidebar */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Tables</h2>
            </div>
            
            <div className="p-0">
              {tables.length === 0 ? (
                <p className="text-gray-500 text-sm p-6">No tables found</p>
              ) : (
                <div className="space-y-0">
                  {tables.map((table) => (
                    <button
                      key={table}
                      onClick={() => {
                        loadTableData(table);
                        setSelectedRecord(null);
                      }}
                      className={`w-full text-left px-4 py-3 border-b transition font-medium ${
                        selectedTable === table
                          ? 'bg-blue-50 text-blue-900 border-l-4 border-l-blue-600'
                          : 'text-gray-700 hover:bg-gray-50 border-b-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{table}</span>
                        {stats[table] && (
                          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                            {stats[table].count}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 space-y-2">
              <button
                onClick={loadTables}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded transition text-sm"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                disabled={!selectedTable || loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded transition text-sm"
              >
                Export
              </button>
            </div>
          </div>

          {/* Main Content - Split View */}
          {selectedTable ? (
            <div className="lg:col-span-4 space-y-6">
              {/* Add Record Section */}
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">New Record</h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Field name"
                    value={addFieldName}
                    onChange={(e) => setAddFieldName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Field value"
                    value={addFieldValue}
                    onChange={(e) => setAddFieldValue(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                  <button
                    onClick={handleAddRecord}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded transition text-sm"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Records List and Detail Split */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Records List - Left Column */}
                <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-semibold text-gray-900 text-sm">
                      Rows ({records.length})
                    </h3>
                  </div>
                  
                  {records.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-500">
                      <div>
                        <p className="text-sm">No records yet</p>
                        <p className="text-xs text-gray-400 mt-1">Add the first record above</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto">
                      {records.map((record) => (
                        <button
                          key={record._id}
                          onClick={() => setSelectedRecord(record)}
                          className={`w-full text-left px-4 py-3 border-b transition ${
                            selectedRecord?._id === record._id
                              ? 'bg-blue-50 border-l-4 border-l-blue-600'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="text-sm font-mono text-gray-600 mb-1">
                            {record._id.slice(0, 12)}...
                          </div>
                          <div className="text-xs text-gray-500">
                            {Object.entries(record)
                              .filter(([k]) => !k.startsWith('_'))
                              .slice(0, 1)
                              .map(([k, v]) => (
                                <span key={k}>{k}: {String(v).slice(0, 40)}</span>
                              ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Record Details - Right Column */}
                <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {selectedRecord ? 'Record Data' : 'Select a row'}
                    </h3>
                  </div>

                  {selectedRecord ? (
                    <div className="flex-1 overflow-y-auto">
                      <div className="p-4 space-y-3">
                        {/* System Fields */}
                        <div className="text-xs">
                          <div className="bg-gray-50 p-3 rounded mb-4">
                            <div className="font-mono text-gray-600 mb-1">
                              <span className="font-semibold text-gray-700">ID:</span>
                            </div>
                            <div className="text-gray-700 break-all font-mono text-xs">
                              {selectedRecord._id}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-gray-50 p-3 rounded">
                              <div className="font-semibold text-gray-700 mb-1">Created</div>
                              <div className="text-gray-600 text-xs">
                                {new Date(selectedRecord._created).toLocaleString()}
                              </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded">
                              <div className="font-semibold text-gray-700 mb-1">Updated</div>
                              <div className="text-gray-600 text-xs">
                                {new Date(selectedRecord._updated).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* User Fields */}
                        <div className="border-t pt-4">
                          <div className="font-semibold text-gray-700 mb-3 text-xs uppercase tracking-wide">Fields</div>
                          {Object.entries(selectedRecord)
                            .filter(([k]) => !k.startsWith('_'))
                            .map(([key, value]) => (
                              <div key={key} className="mb-3 pb-3 border-b last:border-b-0">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="font-mono text-xs font-semibold text-gray-700">{key}</div>
                                  <button
                                    onClick={() => {
                                      setEditingRecord(selectedRecord);
                                      setEditingField(key);
                                      setEditingValue(value);
                                    }}
                                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded"
                                  >
                                    Edit
                                  </button>
                                </div>
                                <div className="bg-gray-50 p-2 rounded text-xs font-mono text-gray-700 break-words">
                                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </div>
                              </div>
                            ))}
                        </div>

                        {/* Delete Button */}
                        <div className="border-t pt-4 mt-4">
                          <button
                            onClick={() => {
                              if (window.confirm('Delete this record? This cannot be undone.')) {
                                handleDeleteRecord(selectedRecord._id);
                              }
                            }}
                            className="w-full bg-red-50 hover:bg-red-100 text-red-700 font-medium py-2 px-4 rounded transition text-sm"
                          >
                            Delete Record
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-500">
                      <p className="text-sm">Select a row to view details</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-4 bg-white rounded-lg shadow p-12 text-center text-gray-500">
              <p className="text-lg">Select a table to begin</p>
              <p className="text-sm text-gray-400 mt-2">Choose a table from the left sidebar</p>
            </div>
          )}
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Export Data</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Export Format
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="json"
                      checked={exportFormat === 'json'}
                      onChange={(e) => setExportFormat(e.target.value)}
                      className="mr-3"
                    />
                    <span className="text-sm text-gray-700">JSON (Pretty-printed)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="jsonl"
                      checked={exportFormat === 'jsonl'}
                      onChange={(e) => setExportFormat(e.target.value)}
                      className="mr-3"
                    />
                    <span className="text-sm text-gray-700">JSONL (Line-delimited, for DB import)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="csv"
                      checked={exportFormat === 'csv'}
                      onChange={(e) => setExportFormat(e.target.value)}
                      className="mr-3"
                    />
                    <span className="text-sm text-gray-700">CSV (Spreadsheet format)</span>
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-xs text-blue-800">
                  <span className="font-semibold">Tip:</span> Export in JSON or JSONL format for easy database migration in the future.
                </p>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 space-y-2">
              <button
                onClick={handleExportTable}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded transition"
              >
                Export {selectedTable}
              </button>
              <button
                onClick={handleExportAllTables}
                disabled={loading || tables.length === 0}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded transition"
              >
                Export All Tables
              </button>
              <button
                onClick={() => setShowExportModal(false)}
                className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Edit Field</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Field</label>
                <select
                  value={editingField}
                  onChange={(e) => {
                    setEditingField(e.target.value);
                    setEditingValue(editingRecord[e.target.value] ?? '');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Select a field...</option>
                  {Object.keys(editingRecord)
                    .filter(k => !k.startsWith('_'))
                    .map(key => (
                      <option key={key} value={key}>{key}</option>
                    ))}
                </select>
              </div>
              
              {editingField && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Value</label>
                  <textarea
                    value={editingValue ?? ''}
                    onChange={(e) => setEditingValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 text-sm font-mono"
                  />
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleUpdateField}
                disabled={loading || !editingField}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded transition"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingRecord(null);
                  setEditingField('');
                  setEditingValue('');
                }}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
