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
  const [editingRecord, setEditingRecord] = useState(null);
  const [newRecordData, setNewRecordData] = useState({});

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
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-requested-with': 'how-i-died',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        setAuthenticated(true);
        loadTables();
      } else {
        setLoginError('Invalid credentials');
      }
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTables = async () => {
    setLoading(true);
    try {
      const [tablesRes, statsRes] = await Promise.all([
        fetch('/api/admin/tables'),
        fetch('/api/admin/stats'),
      ]);

      if (tablesRes.ok) {
        const data = await tablesRes.json();
        setTables(data.tables);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTableData = async (tableName) => {
    setLoading(true);
    setSelectedTable(tableName);
    try {
      const response = await fetch(`/api/admin/table/${tableName}`);
      if (response.ok) {
        const data = await response.json();
        setRecords(data.records);
      }
    } catch (error) {
      console.error('Failed to load table:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecord = async () => {
    if (!selectedTable || Object.keys(newRecordData).length === 0) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/record/${selectedTable}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-requested-with': 'how-i-died',
        },
        body: JSON.stringify(newRecordData),
      });

      if (response.ok) {
        setNewRecordData({});
        await loadTableData(selectedTable);
      }
    } catch (error) {
      console.error('Failed to add record:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRecord = async (recordId, updates) => {
    if (!selectedTable) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/record/${selectedTable}/${recordId}`,
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
        await loadTableData(selectedTable);
      }
    } catch (error) {
      console.error('Failed to update record:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (recordId) => {
    if (!selectedTable || !window.confirm('Delete this record?')) return;

    setLoading(true);
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
      }
    } catch (error) {
      console.error('Failed to delete record:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setAuthenticated(false);
      setUsername('');
      setPassword('');
      setRecords([]);
      setTables([]);
      setSelectedTable(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold mb-6 text-center">Admin Login</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {loginError}
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
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gray-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        {Object.keys(stats).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {Object.entries(stats).map(([tableName, stat]) => (
              <div key={tableName} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900">{tableName}</h3>
                <p className="text-3xl font-bold text-blue-600">{stat.count}</p>
                <p className="text-sm text-gray-500">
                  {(stat.size / 1024).toFixed(2)} KB
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Tables List */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Tables</h2>
            <div className="space-y-2">
              {tables.map((table) => (
                <button
                  key={table}
                  onClick={() => loadTableData(table)}
                  className={`w-full text-left px-4 py-2 rounded-lg transition ${
                    selectedTable === table
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {table}
                </button>
              ))}
            </div>
            <button
              onClick={loadTables}
              disabled={loading}
              className="w-full mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg transition"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {/* Records View */}
          {selectedTable && (
            <div className="lg:col-span-2 space-y-6">
              {/* Add Record */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">Add Record to {selectedTable}</h3>
                <div className="space-y-3 mb-4">
                  <input
                    type="text"
                    placeholder="Field name"
                    value={Object.keys(newRecordData)[0] || ''}
                    onChange={(e) => {
                      const oldKey = Object.keys(newRecordData)[0];
                      const newData = { ...newRecordData };
                      if (oldKey) delete newData[oldKey];
                      newData[e.target.value] = newRecordData[oldKey] || '';
                      setNewRecordData(newData);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <textarea
                    placeholder="Field value (JSON format for complex data)"
                    value={Object.values(newRecordData)[0] || ''}
                    onChange={(e) => {
                      const key = Object.keys(newRecordData)[0] || 'value';
                      setNewRecordData({ ...newRecordData, [key]: e.target.value });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg h-20"
                  />
                </div>
                <button
                  onClick={handleAddRecord}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg transition"
                >
                  Add Record
                </button>
              </div>

              {/* Records Table */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6 border-b">
                  <h3 className="text-lg font-bold">
                    Records ({records.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  {records.length > 0 ? (
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-semibold">
                            ID
                          </th>
                          <th className="px-4 py-2 text-left text-sm font-semibold">
                            Data
                          </th>
                          <th className="px-4 py-2 text-left text-sm font-semibold">
                            Created
                          </th>
                          <th className="px-4 py-2 text-left text-sm font-semibold">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr key={record._id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-mono text-gray-600">
                              {record._id.slice(0, 8)}...
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-20">
                                {JSON.stringify(
                                  Object.keys(record)
                                    .filter((k) => !k.startsWith('_'))
                                    .reduce((acc, k) => ({ ...acc, [k]: record[k] }), {}),
                                  null,
                                  2
                                )}
                              </pre>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {new Date(record._created).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm space-x-2">
                              <button
                                onClick={() => setEditingRecord(record)}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteRecord(record._id)}
                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-6 text-center text-gray-500">
                      No records in this table
                    </div>
                  )}
                </div>
              </div>

              {/* Edit Modal */}
              {editingRecord && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6">
                    <h3 className="text-xl font-bold mb-4">
                      Edit Record
                    </h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
                      {Object.entries(editingRecord)
                        .filter(([k]) => !k.startsWith('_'))
                        .map(([key, value]) => (
                          <div key={key}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {key}
                            </label>
                            <textarea
                              value={
                                typeof value === 'object'
                                  ? JSON.stringify(value, null, 2)
                                  : value
                              }
                              onChange={(e) => {
                                setEditingRecord({
                                  ...editingRecord,
                                  [key]: e.target.value,
                                });
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                              rows="3"
                            />
                          </div>
                        ))}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() =>
                          handleUpdateRecord(
                            editingRecord._id,
                            Object.keys(editingRecord)
                              .filter((k) => !k.startsWith('_'))
                              .reduce(
                                (acc, k) => ({ ...acc, [k]: editingRecord[k] }),
                                {}
                              )
                          )
                        }
                        disabled={loading}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg transition"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => setEditingRecord(null)}
                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
