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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Tables Sidebar */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Tables</h2>
            
            {tables.length === 0 ? (
              <p className="text-gray-500 text-sm">No tables found</p>
            ) : (
              <div className="space-y-2 mb-4">
                {tables.map((table) => (
                  <button
                    key={table}
                    onClick={() => loadTableData(table)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition font-medium ${
                      selectedTable === table
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    {table}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={loadTables}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition"
            >
              {loading ? 'Refreshing...' : 'Refresh Tables'}
            </button>
          </div>

          {/* Main Content */}
          {selectedTable ? (
            <div className="lg:col-span-3 space-y-6">
              {/* Add Record Form */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4 text-gray-900">Add Record to {selectedTable}</h3>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Field name (e.g., text, mood)"
                    value={addFieldName}
                    onChange={(e) => setAddFieldName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Field value"
                    value={addFieldValue}
                    onChange={(e) => setAddFieldValue(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleAddRecord}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded-lg transition"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Records Table */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">
                    Records ({records.length})
                  </h3>
                </div>
                
                {records.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    No records in this table
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">ID</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Data</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Created</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr key={record._id} className="border-b hover:bg-gray-50 transition">
                            <td className="px-4 py-3 text-sm font-mono text-gray-600 whitespace-nowrap">
                              {record._id.slice(0, 8)}...
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="max-w-xs">
                                {Object.entries(record)
                                  .filter(([k]) => !k.startsWith('_'))
                                  .slice(0, 2)
                                  .map(([k, v]) => (
                                    <div key={k} className="text-gray-600 text-xs mb-1">
                                      <span className="font-medium">{k}:</span> {String(v).slice(0, 30)}
                                    </div>
                                  ))}
                                {Object.keys(record).filter(k => !k.startsWith('_')).length > 2 && (
                                  <div className="text-gray-500 text-xs">+{Object.keys(record).filter(k => !k.startsWith('_')).length - 2} more</div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                              {new Date(record._created).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-right space-x-2">
                              <button
                                onClick={() => setEditingRecord(record)}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs inline-block"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteRecord(record._id)}
                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs inline-block"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="lg:col-span-3 bg-white rounded-lg shadow p-12 text-center text-gray-500">
              <p className="text-lg">Select a table to view records</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Edit Record</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Field</label>
                <select
                  value={editingField}
                  onChange={(e) => setEditingField(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    value={editingValue || (editingRecord[editingField] ?? '')}
                    onChange={(e) => setEditingValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                  />
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleUpdateField}
                disabled={loading || !editingField}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingRecord(null);
                  setEditingField('');
                  setEditingValue('');
                }}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-lg transition"
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
