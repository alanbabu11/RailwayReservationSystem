'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminAPI, trainAPI, stationAPI } from '../lib/api';

interface Station {
  id: number;
  code: string;
  name: string;
  city: string;
}

interface Train {
  id: number;
  train_number: string;
  number?: string;
  name: string;
  train_type?: string;
  source_station_name?: string;
  source_station_code?: string;
  dest_station_name?: string;
  dest_station_code?: string;
  departure_time?: string;
  arrival_time?: string;
  base_fare?: string;
  is_active?: boolean;
}

interface UserItem {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  created_at: string;
}

interface DashboardStats {
  total_bookings: number;
  total_revenue: string;
  active_trains: number;
  total_users: number;
}

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'trains' | 'stations' | 'users'>('dashboard');

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trains, setTrains] = useState<Train[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [usersList, setUsersList] = useState<UserItem[]>([]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');

  // Station State
  const [newStationCode, setNewStationCode] = useState('');
  const [newStationName, setNewStationName] = useState('');
  const [newStationCity, setNewStationCity] = useState('');
  const [stationMsg, setStationMsg] = useState('');

  // Add Train Modal State
  const [showAddTrainModal, setShowAddTrainModal] = useState(false);
  const [addTrainForm, setAddTrainForm] = useState({
    train_number: '',
    name: '',
    train_type: 'Express',
    source_station_id: '',
    destination_station_id: '',
    departure_time: '08:00',
    arrival_time: '18:00',
    base_fare: '500',
  });
  const [addTrainMsg, setAddTrainMsg] = useState('');

  // Edit Train Modal State
  const [editingTrain, setEditingTrain] = useState<Train | null>(null);
  const [editTrainForm, setEditTrainForm] = useState({
    train_number: '',
    name: '',
    train_type: 'Express',
    departure_time: '08:00',
    arrival_time: '18:00',
    base_fare: '500',
    is_active: true,
  });
  const [editTrainMsg, setEditTrainMsg] = useState('');

  useEffect(() => {
    if (user && isAdmin) {
      fetchInitialData();
    } else if (!authLoading) {
      setInitialLoading(false);
    }
  }, [user, isAdmin, authLoading]);

  // Initial load only
  const fetchInitialData = async () => {
    setInitialLoading(true);
    setError('');
    try {
      const [dashData, trainData, stationData, userData] = await Promise.all([
        adminAPI.dashboard().catch(() => null),
        trainAPI.getAll().catch(() => ({ trains: [] })),
        stationAPI.getAll().catch(() => ({ stations: [] })),
        adminAPI.users().catch(() => ({ users: [] })),
      ]);

      if (dashData?.stats) setStats(dashData.stats);
      if (trainData?.trains) setTrains(trainData.trains);
      if (stationData?.stations) setStations(stationData.stations);
      if (userData?.users) setUsersList(userData.users);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data');
    } finally {
      setInitialLoading(false);
    }
  };

  // Silent background refresh
  const silentRefreshData = async () => {
    try {
      const [dashData, trainData, stationData, userData] = await Promise.all([
        adminAPI.dashboard().catch(() => null),
        trainAPI.getAll().catch(() => ({ trains: [] })),
        stationAPI.getAll().catch(() => ({ stations: [] })),
        adminAPI.users().catch(() => ({ users: [] })),
      ]);

      if (dashData?.stats) setStats(dashData.stats);
      if (trainData?.trains) setTrains(trainData.trains);
      if (stationData?.stations) setStations(stationData.stations);
      if (userData?.users) setUsersList(userData.users);
    } catch (err) {
      console.error('Background refresh failed:', err);
    }
  };

  // Station CRUD: Add
  const handleAddStation = async (e: React.FormEvent) => {
    e.preventDefault();
    setStationMsg('');
    try {
      const res = await stationAPI.add({
        code: newStationCode.toUpperCase().trim(),
        name: newStationName.trim(),
        city: newStationCity.trim(),
      });
      setStationMsg('Station added successfully!');
      setNewStationCode('');
      setNewStationName('');
      setNewStationCity('');

      if (res.station) {
        setStations(prev => [...prev, res.station]);
      }
      silentRefreshData();
    } catch (err: unknown) {
      setStationMsg(err instanceof Error ? err.message : 'Failed to add station');
    }
  };

  // Station CRUD: Instant Optimistic Delete
  const handleDeleteStation = async (id: number) => {
    if (!confirm('Are you sure you want to delete this station?')) return;

    const previousStations = [...stations];
    // Instant UI update
    setStations(prev => prev.filter(s => s.id !== id));

    try {
      await stationAPI.delete(id);
      silentRefreshData();
    } catch (err: unknown) {
      // Revert if failed
      setStations(previousStations);
      alert(err instanceof Error ? err.message : 'Failed to delete station');
    }
  };

  // Train CRUD: Add
  const handleAddTrain = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddTrainMsg('');
    try {
      if (!addTrainForm.source_station_id || !addTrainForm.destination_station_id) {
        setAddTrainMsg('Please select both source and destination stations');
        return;
      }
      if (addTrainForm.source_station_id === addTrainForm.destination_station_id) {
        setAddTrainMsg('Source and destination stations cannot be the same');
        return;
      }

      const res = await trainAPI.add({
        train_number: addTrainForm.train_number.trim(),
        name: addTrainForm.name.trim(),
        train_type: addTrainForm.train_type,
        source_station_id: parseInt(addTrainForm.source_station_id),
        destination_station_id: parseInt(addTrainForm.destination_station_id),
        departure_time: addTrainForm.departure_time,
        arrival_time: addTrainForm.arrival_time,
        base_fare: parseFloat(addTrainForm.base_fare),
      });

      setShowAddTrainModal(false);
      setAddTrainForm({
        train_number: '',
        name: '',
        train_type: 'Express',
        source_station_id: '',
        destination_station_id: '',
        departure_time: '08:00',
        arrival_time: '18:00',
        base_fare: '500',
      });

      if (res.train) {
        setTrains(prev => [res.train, ...prev]);
      }
      silentRefreshData();
    } catch (err: unknown) {
      setAddTrainMsg(err instanceof Error ? err.message : 'Failed to add train');
    }
  };

  // Train CRUD: Edit Open
  const openEditModal = (train: Train) => {
    setEditingTrain(train);
    setEditTrainForm({
      train_number: train.train_number || train.number || '',
      name: train.name || '',
      train_type: train.train_type || 'Express',
      departure_time: train.departure_time?.substring(0, 5) || '08:00',
      arrival_time: train.arrival_time?.substring(0, 5) || '18:00',
      base_fare: train.base_fare || '500',
      is_active: train.is_active ?? true,
    });
    setEditTrainMsg('');
  };

  // Train CRUD: Edit Submit
  const handleEditTrain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrain) return;
    setEditTrainMsg('');

    try {
      const res = await trainAPI.update(editingTrain.id, {
        train_number: editTrainForm.train_number.trim(),
        name: editTrainForm.name.trim(),
        train_type: editTrainForm.train_type,
        departure_time: editTrainForm.departure_time,
        arrival_time: editTrainForm.arrival_time,
        base_fare: parseFloat(editTrainForm.base_fare),
        is_active: editTrainForm.is_active,
      });

      // Update local state instantly
      if (res.train) {
        setTrains(prev => prev.map(t => t.id === editingTrain.id ? { ...t, ...res.train } : t));
      }

      setEditingTrain(null);
      silentRefreshData();
    } catch (err: unknown) {
      setEditTrainMsg(err instanceof Error ? err.message : 'Failed to update train');
    }
  };

  // Train CRUD: Instant Optimistic Delete
  const handleDeleteTrain = async (id: number) => {
    if (!confirm('Are you sure you want to delete or deactivate this train?')) return;

    const previousTrains = [...trains];
    // Instant UI update
    setTrains(prev => prev.filter(t => t.id !== id));

    try {
      await trainAPI.delete(id);
      silentRefreshData();
    } catch (err: unknown) {
      // Revert if failed
      setTrains(previousTrains);
      alert(err instanceof Error ? err.message : 'Failed to delete train');
    }
  };

  if (authLoading || initialLoading) {
    return (
      <div className="text-center py-16 text-xs text-slate-600 font-medium">
        Loading Admin Control Panel...
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white border border-slate-200 rounded-md text-center shadow-sm">
        <h2 className="text-base font-bold text-slate-800 mb-2">Admin Access Required</h2>
        <p className="text-xs text-slate-600 mb-4">
          Log in with an administrator account to access management tools.
        </p>
        <div className="bg-slate-50 border border-slate-200 rounded p-3 text-left text-xs space-y-1">
          <div className="font-bold text-slate-700">Admin Credentials:</div>
          <div>Email: <span className="font-mono text-blue-900 font-bold">admin@railway.com</span></div>
          <div>Password: <span className="font-mono text-blue-900 font-bold">Admin@123</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Admin Management Portal</h1>
            <span className="bg-blue-900 text-white text-[10px] font-bold px-2 py-0.5 rounded tracking-wider">
              ADMIN CONTROL
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Configure train routes, manage stations, and view registered system users
          </p>
        </div>

        <button
          onClick={() => {
            setShowAddTrainModal(true);
            setAddTrainMsg('');
          }}
          className="btn-primary text-xs !py-1.5 !px-3 font-semibold"
        >
          + Add New Train
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-3 mb-4">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        {(['dashboard', 'trains', 'stations', 'users'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-bold text-xs uppercase tracking-wider border-b-2 ${
              activeTab === tab
                ? 'border-blue-900 text-blue-900 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab === 'dashboard' ? 'Overview' : tab}
          </button>
        ))}
      </div>

      {/* Overview Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-md shadow-xs">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Bookings</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                {stats?.total_bookings || 0}
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-md shadow-xs">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Revenue</div>
              <div className="text-2xl font-bold text-blue-900 mt-1 font-mono">
                ₹{stats?.total_revenue || '0.00'}
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-md shadow-xs">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">System Trains</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                {trains.length}
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-md shadow-xs">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Registered Users</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                {usersList.length}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 p-4 rounded-md shadow-xs">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Active System Trains</h3>
                <button onClick={() => setActiveTab('trains')} className="text-xs text-blue-800 font-semibold hover:underline">
                  Manage Trains →
                </button>
              </div>
              <div className="space-y-2">
                {trains.slice(0, 6).map((t) => (
                  <div
                    key={t.id}
                    className="bg-slate-50 border border-slate-200 p-2.5 rounded flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-blue-900 mr-2">#{t.train_number || t.number}</span>
                      <span className="font-semibold text-slate-800">{t.name}</span>
                    </div>
                    <span className="text-slate-500 font-medium">
                      {t.source_station_code || 'SRC'} → {t.dest_station_code || 'DST'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-md shadow-xs">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Configured Stations</h3>
                <button onClick={() => setActiveTab('stations')} className="text-xs text-blue-800 font-semibold hover:underline">
                  Manage Stations →
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {stations.slice(0, 8).map((s) => (
                  <div key={s.id} className="bg-slate-50 border border-slate-200 p-2 rounded text-xs flex justify-between items-center">
                    <span className="font-medium text-slate-800 truncate">{s.name}</span>
                    <span className="font-mono font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">{s.code}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trains Tab (CRUD) */}
      {activeTab === 'trains' && (
        <div className="bg-white border border-slate-200 rounded-md p-4 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Train Directory & Control</h3>
              <p className="text-xs text-slate-500">Create, edit, or delete train schedules and fares</p>
            </div>
            <button
              onClick={() => {
                setShowAddTrainModal(true);
                setAddTrainMsg('');
              }}
              className="btn-primary text-xs !py-1 !px-3 font-semibold"
            >
              + Add New Train
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 uppercase bg-slate-50 font-bold">
                  <th className="py-2.5 px-3">Train #</th>
                  <th className="py-2.5 px-3">Train Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Route (Source → Destination)</th>
                  <th className="py-2.5 px-3">Timings</th>
                  <th className="py-2.5 px-3">Base Fare</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trains.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{t.train_number || t.number}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{t.name}</td>
                    <td className="py-2.5 px-3 text-slate-600">{t.train_type || 'Express'}</td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">
                      {t.source_station_name} ({t.source_station_code}) → {t.dest_station_name} ({t.dest_station_code})
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono">
                      {t.departure_time?.substring(0, 5)} - {t.arrival_time?.substring(0, 5)}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 font-mono">₹{t.base_fare}</td>
                    <td className="py-2.5 px-3">
                      <span className={`badge ${t.is_active !== false ? 'badge-confirmed' : 'badge-cancelled'}`}>
                        {t.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(t)}
                        className="text-blue-800 hover:underline font-bold cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTrain(t.id)}
                        className="text-red-700 hover:underline font-bold cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stations Tab (CRUD) */}
      {activeTab === 'stations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-md p-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 border-b border-slate-200 pb-2">
              Add New Station
            </h3>
            {stationMsg && (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded p-2 mb-3">
                {stationMsg}
              </div>
            )}
            <form onSubmit={handleAddStation} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Station Code (e.g. NDLS)
                </label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  value={newStationCode}
                  onChange={(e) => setNewStationCode(e.target.value)}
                  placeholder="e.g. NDLS"
                  className="input-field text-xs uppercase font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Station Name
                </label>
                <input
                  type="text"
                  required
                  value={newStationName}
                  onChange={(e) => setNewStationName(e.target.value)}
                  placeholder="e.g. New Delhi"
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  City Name
                </label>
                <input
                  type="text"
                  required
                  value={newStationCity}
                  onChange={(e) => setNewStationCity(e.target.value)}
                  placeholder="e.g. New Delhi"
                  className="input-field text-xs"
                />
              </div>
              <button type="submit" className="btn-primary w-full text-xs py-2 font-semibold">
                + Add Station
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-md p-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 border-b border-slate-200 pb-2">
              Configured Stations ({stations.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
              {stations.map((s) => (
                <div
                  key={s.id}
                  className="bg-slate-50 border border-slate-200 p-3 rounded flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-800">{s.name}</div>
                    <div className="text-slate-500 text-[11px]">{s.city}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {s.code}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteStation(s.id)}
                      className="text-red-700 hover:underline font-bold text-[11px] cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-md p-4 shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 border-b border-slate-200 pb-2">
            System User Directory ({usersList.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 uppercase bg-slate-50 font-bold">
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Email Address</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono text-slate-600">{u.id}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{u.name}</td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono">{u.email}</td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono">{u.phone || 'N/A'}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`badge ${
                          u.role === 'admin'
                            ? 'bg-amber-100 text-amber-900 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal for Add Train */}
      {showAddTrainModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-md p-5 w-full max-w-md shadow-lg">
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-800">Add New Train</h3>
              <button
                onClick={() => setShowAddTrainModal(false)}
                className="text-slate-500 hover:text-slate-800 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {addTrainMsg && (
              <div className="bg-red-50 text-red-700 text-xs p-2 rounded mb-3 border border-red-200">
                {addTrainMsg}
              </div>
            )}

            <form onSubmit={handleAddTrain} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Train Number</label>
                  <input
                    type="text"
                    required
                    value={addTrainForm.train_number}
                    onChange={(e) => setAddTrainForm({ ...addTrainForm, train_number: e.target.value })}
                    placeholder="e.g. 12951"
                    className="input-field font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Base Fare (₹)</label>
                  <input
                    type="number"
                    required
                    value={addTrainForm.base_fare}
                    onChange={(e) => setAddTrainForm({ ...addTrainForm, base_fare: e.target.value })}
                    placeholder="500"
                    className="input-field font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Train Name</label>
                <input
                  type="text"
                  required
                  value={addTrainForm.name}
                  onChange={(e) => setAddTrainForm({ ...addTrainForm, name: e.target.value })}
                  placeholder="e.g. Rajdhani Express"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Train Type</label>
                <select
                  value={addTrainForm.train_type}
                  onChange={(e) => setAddTrainForm({ ...addTrainForm, train_type: e.target.value })}
                  className="input-field"
                >
                  <option value="Express">Express</option>
                  <option value="Superfast">Superfast</option>
                  <option value="Rajdhani">Rajdhani</option>
                  <option value="Shatabdi">Shatabdi</option>
                  <option value="Vande Bharat">Vande Bharat</option>
                  <option value="Garib Rath">Garib Rath</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Source Station</label>
                  <select
                    required
                    value={addTrainForm.source_station_id}
                    onChange={(e) => setAddTrainForm({ ...addTrainForm, source_station_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Select Origin</option>
                    {stations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Destination Station</label>
                  <select
                    required
                    value={addTrainForm.destination_station_id}
                    onChange={(e) => setAddTrainForm({ ...addTrainForm, destination_station_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Select Destination</option>
                    {stations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Departure Time</label>
                  <input
                    type="time"
                    required
                    value={addTrainForm.departure_time}
                    onChange={(e) => setAddTrainForm({ ...addTrainForm, departure_time: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Arrival Time</label>
                  <input
                    type="time"
                    required
                    value={addTrainForm.arrival_time}
                    onChange={(e) => setAddTrainForm({ ...addTrainForm, arrival_time: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddTrainModal(false)}
                  className="btn-secondary text-xs !py-1 !px-3"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs !py-1 !px-3 font-semibold">
                  Create Train
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Edit Train */}
      {editingTrain && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-md p-5 w-full max-w-md shadow-lg">
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-800">Edit Train #{editingTrain.train_number || editingTrain.number}</h3>
              <button
                onClick={() => setEditingTrain(null)}
                className="text-slate-500 hover:text-slate-800 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {editTrainMsg && (
              <div className="bg-red-50 text-red-700 text-xs p-2 rounded mb-3 border border-red-200">
                {editTrainMsg}
              </div>
            )}

            <form onSubmit={handleEditTrain} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Train Number</label>
                  <input
                    type="text"
                    required
                    value={editTrainForm.train_number}
                    onChange={(e) => setEditTrainForm({ ...editTrainForm, train_number: e.target.value })}
                    className="input-field font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Base Fare (₹)</label>
                  <input
                    type="number"
                    required
                    value={editTrainForm.base_fare}
                    onChange={(e) => setEditTrainForm({ ...editTrainForm, base_fare: e.target.value })}
                    className="input-field font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Train Name</label>
                <input
                  type="text"
                  required
                  value={editTrainForm.name}
                  onChange={(e) => setEditTrainForm({ ...editTrainForm, name: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Train Type</label>
                  <select
                    value={editTrainForm.train_type}
                    onChange={(e) => setEditTrainForm({ ...editTrainForm, train_type: e.target.value })}
                    className="input-field"
                  >
                    <option value="Express">Express</option>
                    <option value="Superfast">Superfast</option>
                    <option value="Rajdhani">Rajdhani</option>
                    <option value="Shatabdi">Shatabdi</option>
                    <option value="Vande Bharat">Vande Bharat</option>
                    <option value="Garib Rath">Garib Rath</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Active Status</label>
                  <select
                    value={editTrainForm.is_active ? 'active' : 'inactive'}
                    onChange={(e) => setEditTrainForm({ ...editTrainForm, is_active: e.target.value === 'active' })}
                    className="input-field font-bold"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Departure Time</label>
                  <input
                    type="time"
                    required
                    value={editTrainForm.departure_time}
                    onChange={(e) => setEditTrainForm({ ...editTrainForm, departure_time: e.target.value })}
                    className="input-field font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Arrival Time</label>
                  <input
                    type="time"
                    required
                    value={editTrainForm.arrival_time}
                    onChange={(e) => setEditTrainForm({ ...editTrainForm, arrival_time: e.target.value })}
                    className="input-field font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingTrain(null)}
                  className="btn-secondary text-xs !py-1 !px-3"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs !py-1 !px-3 font-semibold">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
