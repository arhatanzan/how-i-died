/**
 * Admin UI for Storage Management
 * React component for managing Git LFS, deduplication, and storage
 */

import { useEffect, useState } from 'react';

const StorageAdminUI = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [lfsStatus, setLfsStatus] = useState(null);
  const [lfsStats, setLfsStats] = useState(null);
  const [dedupStats, setDedupStats] = useState(null);
  const [duplicates, setDuplicates] = useState(null);
  const [lfsRecommendations, setLfsRecommendations] = useState(null);

  // Load dashboard data on component mount
  useEffect(() => {
    loadDashboard();
  }, []);

  const apiCall = async (endpoint, method = 'GET', body = null) => {
    try {
      setLoading(true);
      setError(null);

      const options = {
        method,
        credentials: 'include',
      };

      if (body) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
      }

      const response = await fetch(endpoint, options);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      const data = await apiCall('/api/storage/dashboard');
      setDashboard(data.dashboard);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  };

  const loadLfsStatus = async () => {
    try {
      const [status, stats, recommendations] = await Promise.all([
        apiCall('/api/storage/lfs/status'),
        apiCall('/api/storage/lfs/stats'),
        apiCall('/api/storage/lfs/recommendations'),
      ]);
      setLfsStatus(status.lfs);
      setLfsStats(stats.lfs);
      setLfsRecommendations(recommendations.lfs);
    } catch (err) {
      console.error('Failed to load LFS status:', err);
    }
  };

  const loadDedupStats = async () => {
    try {
      const [stats, dups] = await Promise.all([
        apiCall('/api/storage/dedup/stats'),
        apiCall('/api/storage/dedup/duplicates'),
      ]);
      setDedupStats(stats.dedup);
      setDuplicates(dups.dedup);
    } catch (err) {
      console.error('Failed to load dedup stats:', err);
    }
  };

  const initLFS = async () => {
    try {
      const result = await apiCall('/api/storage/lfs/init', 'POST');
      alert('Git LFS initialized: ' + result.lfs.message);
      await loadLfsStatus();
    } catch (err) {
      alert('Failed to initialize LFS: ' + err.message);
    }
  };

  const migrateLFS = async () => {
    try {
      const result = await apiCall('/api/storage/lfs/migrate', 'POST');
      alert(`Migration queued: ${result.lfs.migratedCount} files`);
      await loadLfsStatus();
    } catch (err) {
      alert('Failed to migrate files: ' + err.message);
    }
  };

  const scanForDuplicates = async () => {
    try {
      const result = await apiCall('/api/storage/dedup/scan', 'POST');
      alert(`Scan complete: ${result.dedup.scanned} files scanned`);
      await loadDedupStats();
    } catch (err) {
      alert('Failed to scan for duplicates: ' + err.message);
    }
  };

  const consolidateDuplicates = async (hash) => {
    try {
      const result = await apiCall('/api/storage/dedup/consolidate', 'POST', { hash });
      alert(`Consolidation complete: ${result.dedup.linkedFiles.length} files linked`);
      await loadDedupStats();
    } catch (err) {
      alert('Failed to consolidate: ' + err.message);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'lfs' && !lfsStatus) {
      loadLfsStatus();
    } else if (tab === 'dedup' && !dedupStats) {
      loadDedupStats();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Storage Management</h1>
          <p className="text-slate-400">Git LFS, Deduplication, and Storage Analytics</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-300">
            <p className="font-semibold">Error: {error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-slate-700">
          <button
            onClick={() => handleTabChange('dashboard')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'dashboard'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => handleTabChange('lfs')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'lfs'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Git LFS
          </button>
          <button
            onClick={() => handleTabChange('dedup')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'dedup'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Deduplication
          </button>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Storage Stats Card */}
            {dashboard?.storage && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4">Storage Stats</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Size:</span>
                    <span className="text-white font-semibold">
                      {(dashboard.storage.totalSize / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Images:</span>
                    <span className="text-white">
                      {dashboard.storage.images?.count || 0} files
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Media:</span>
                    <span className="text-white">
                      {dashboard.storage.media?.count || 0} uploads
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* LFS Status Card */}
            {dashboard?.lfs && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4">Git LFS Status</h2>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${dashboard.lfs.installed ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <span className="text-slate-300">
                      {dashboard.lfs.installed ? 'Installed' : 'Not Installed'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Patterns:</span>
                    <span className="text-white">{dashboard.lfs.tracking?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Threshold:</span>
                    <span className="text-white">100 MB</span>
                  </div>
                </div>
              </div>
            )}

            {/* Dedup Stats Card */}
            {dashboard?.dedup && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4">Deduplication</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ratio:</span>
                    <span className="text-white font-semibold">{dashboard.dedup.dedupRatio}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Duplicates:</span>
                    <span className="text-white">{dashboard.dedup.duplicateFiles || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Potential Savings:</span>
                    <span className="text-green-400 font-semibold">
                      {(dashboard.dedup.potentialSavings / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Git LFS Tab */}
        {activeTab === 'lfs' && (
          <div className="space-y-6">
            {/* LFS Status */}
            {lfsStatus && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-4">Git LFS Configuration</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-200 mb-3">Status</h3>
                    <div className="space-y-2">
                      <p>
                        <span className="text-slate-400">Installed:</span>{' '}
                        <span className={lfsStatus.installed ? 'text-green-400' : 'text-red-400'}>
                          {lfsStatus.installed ? 'Yes' : 'No'}
                        </span>
                      </p>
                      <p>
                        <span className="text-slate-400">Threshold:</span>{' '}
                        <span className="text-white">
                          {(lfsStatus.threshold / 1024 / 1024).toFixed(0)} MB
                        </span>
                      </p>
                      <p>
                        <span className="text-slate-400">Patterns:</span>{' '}
                        <span className="text-white">{lfsStatus.tracking?.length || 0}</span>
                      </p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-200 mb-3">Actions</h3>
                    <div className="space-y-2">
                      <button
                        onClick={initLFS}
                        disabled={loading || lfsStatus.installed}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded font-medium transition"
                      >
                        Initialize LFS
                      </button>
                      <button
                        onClick={migrateLFS}
                        disabled={loading || !lfsStatus.installed}
                        className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded font-medium transition"
                      >
                        Migrate Large Files
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* LFS Stats */}
            {lfsStats && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4">Large Files Analysis</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Candidate Files (>100MB):</span>
                    <span className="text-white font-semibold">{lfsStats.candidateCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Size:</span>
                    <span className="text-white">{lfsStats.estimatedBandwidthSaved}</span>
                  </div>
                </div>
              </div>
            )}

            {/* LFS Recommendations */}
            {lfsRecommendations?.recommendations && lfsRecommendations.recommendations.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4">Recommendations</h2>
                <div className="space-y-3">
                  {lfsRecommendations.recommendations.map((rec, idx) => (
                    <div key={idx} className="p-3 bg-slate-700/50 rounded border border-slate-600">
                      <p className="text-yellow-400 font-semibold">{rec.title}</p>
                      <p className="text-slate-300 text-sm mt-1">{rec.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Deduplication Tab */}
        {activeTab === 'dedup' && (
          <div className="space-y-6">
            {/* Dedup Stats */}
            {dedupStats && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-4">Deduplication Analysis</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-700/50 p-4 rounded">
                    <p className="text-slate-400 text-sm">Unique Hashes</p>
                    <p className="text-2xl font-bold text-white">{dedupStats.uniqueHashes}</p>
                  </div>
                  <div className="bg-slate-700/50 p-4 rounded">
                    <p className="text-slate-400 text-sm">Total Files</p>
                    <p className="text-2xl font-bold text-white">{dedupStats.totalFiles}</p>
                  </div>
                  <div className="bg-slate-700/50 p-4 rounded">
                    <p className="text-slate-400 text-sm">Dedup Ratio</p>
                    <p className="text-2xl font-bold text-green-400">{dedupStats.dedupRatio}</p>
                  </div>
                  <div className="bg-slate-700/50 p-4 rounded">
                    <p className="text-slate-400 text-sm">Potential Savings</p>
                    <p className="text-2xl font-bold text-blue-400">
                      {(dedupStats.potentialSavings / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Scan Actions */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">Actions</h2>
              <button
                onClick={scanForDuplicates}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded font-medium transition"
              >
                {loading ? 'Scanning...' : 'Scan for Duplicates'}
              </button>
            </div>

            {/* Duplicates List */}
            {duplicates?.duplicates && duplicates.duplicates.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4">Duplicate Groups</h2>
                <div className="space-y-3">
                  {duplicates.duplicates.map((dup, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-700/50 rounded">
                      <div>
                        <p className="text-slate-300 font-mono text-sm">{dup.hash.substring(0, 16)}...</p>
                        <p className="text-slate-400 text-sm">
                          {dup.count} copies • {(dup.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 font-semibold">
                          Save {(dup.potentialSavings / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <button
                          onClick={() => consolidateDuplicates(dup.hash)}
                          disabled={loading}
                          className="mt-1 text-sm px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded transition"
                        >
                          Consolidate
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-slate-800 rounded-lg p-6">
              <p className="text-white">Loading...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StorageAdminUI;
