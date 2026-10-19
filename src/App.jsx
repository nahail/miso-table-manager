import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Plus, Trash2, Edit3, Check, X, RefreshCw, 
  Layers, Clock, Filter, LogOut
} from 'lucide-react';
import { DEFAULT_TABLES } from './lib/supabaseClient';
import Login from './components/Login';

export default function App() {
  // Staff Authentication State
  const [currentStaff, setCurrentStaff] = useState(() => {
    const saved = localStorage.getItem('miso_staff_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // Table Data & Filter State
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFloor, setSelectedFloor] = useState('all'); // 'all' or 1..5
  const [partySizeFilter, setPartySizeFilter] = useState(0); // 0 = all
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'available', 'occupied'
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formFloor, setFormFloor] = useState(1);
  const [formSeats, setFormSeats] = useState(4);

  // Set default floor based on staff role when logged in
  useEffect(() => {
    if (currentStaff && currentStaff.assignedFloor) {
      setSelectedFloor(currentStaff.assignedFloor);
    }
  }, [currentStaff]);

  // Initial table fetch when logged in
  useEffect(() => {
    if (currentStaff) {
      initApp();
    }
  }, [currentStaff]);

  const initApp = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tables?_t=' + Date.now(), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setTables(data);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
    setTables(DEFAULT_TABLES);
    setLoading(false);
  };

  // Silent background refetch (runs every 1.5s for instant multi-device sync)
  const silentFetchTables = async () => {
    try {
      const res = await fetch('/api/tables?_t=' + Date.now(), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setTables(data);
        }
      }
    } catch (e) {
      // ignore background poll errors
    }
  };

  // Setup Continuous Multi-Device Sync (every 1.5 seconds & on tab focus)
  useEffect(() => {
    if (!currentStaff) return;

    // 1. Continuous fast poll (every 1.5 seconds)
    const pollInterval = setInterval(() => {
      silentFetchTables();
    }, 1500);

    // 2. Fetch immediately when phone wakes up or tab gains focus
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        silentFetchTables();
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [currentStaff]);

  // Toggle Table Occupancy (Green <-> Red)
  const handleToggleTable = async (table) => {
    const newOccupied = !table.is_occupied;
    const seatedAt = newOccupied ? new Date().toISOString() : null;

    // 1. Optimistic Local Update (Instant visual feedback)
    setTables((prev) =>
      prev.map((t) =>
        t.id === table.id || (t.name === table.name && t.floor === table.floor)
          ? { ...t, is_occupied: newOccupied, seated_at: seatedAt }
          : t
      )
    );

    // 2. Persist directly to backend database
    try {
      const res = await fetch('/api/tables', {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: table.id,
          name: table.name,
          floor: table.floor,
          is_occupied: newOccupied,
          seated_at: seatedAt,
        }),
      });

      if (res.ok) {
        silentFetchTables();
      }
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  // Add Table
  const handleAddTable = async (e) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const newTableData = {
      name: formName.trim(),
      floor: parseInt(formFloor, 10),
      seats: parseInt(formSeats, 10) || 4,
      is_occupied: false,
      seated_at: null,
    };

    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTableData),
      });

      if (res.ok) {
        silentFetchTables();
      }
    } catch (err) {
      alert('Error adding table: ' + err.message);
    }

    setFormName('');
    setIsAddModalOpen(false);
  };

  // Edit Table
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTable || !formName.trim()) return;

    const updatedData = {
      id: editingTable.id,
      name: formName.trim(),
      floor: parseInt(formFloor, 10),
      seats: parseInt(formSeats, 10) || 4,
    };

    try {
      const res = await fetch('/api/tables', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      if (res.ok) {
        silentFetchTables();
      }
    } catch (err) {
      alert('Error saving table: ' + err.message);
    }

    setEditingTable(null);
  };

  // Delete Table
  const handleDeleteTable = async (id) => {
    const table = tables.find((t) => t.id === id);
    try {
      const params = new URLSearchParams();
      if (id) params.set('id', id);
      if (table?.name) params.set('name', table.name);
      if (table?.floor) params.set('floor', table.floor);

      await fetch(`/api/tables?${params.toString()}`, { method: 'DELETE' });
      setTables((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      alert('Error deleting table: ' + err.message);
    }
    setConfirmDeleteId(null);
  };

  // Open Edit Modal
  const openEdit = (table, e) => {
    e.stopPropagation();
    setEditingTable(table);
    setFormName(table.name);
    setFormFloor(table.floor);
    setFormSeats(table.seats);
  };

  // Staff Logout
  const handleLogout = () => {
    localStorage.removeItem('miso_staff_session');
    setCurrentStaff(null);
  };

  // Filtered tables
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      // Floor filter
      if (selectedFloor !== 'all' && t.floor !== parseInt(selectedFloor, 10)) {
        return false;
      }
      // Status filter
      if (statusFilter === 'available' && t.is_occupied) return false;
      if (statusFilter === 'occupied' && !t.is_occupied) return false;
      // Party size filter
      if (partySizeFilter > 0 && t.seats < partySizeFilter) return false;
      return true;
    });
  }, [tables, selectedFloor, statusFilter, partySizeFilter]);

  // Floor stats
  const floorStats = useMemo(() => {
    const stats = {
      all: { total: tables.length, free: tables.filter((t) => !t.is_occupied).length, seats: tables.reduce((acc, t) => acc + (t.is_occupied ? 0 : t.seats), 0) },
      1: { total: 0, free: 0, seats: 0 },
      2: { total: 0, free: 0, seats: 0 },
      3: { total: 0, free: 0, seats: 0 },
      4: { total: 0, free: 0, seats: 0 },
      5: { total: 0, free: 0, seats: 0 },
    };

    tables.forEach((t) => {
      if (stats[t.floor]) {
        stats[t.floor].total += 1;
        if (!t.is_occupied) {
          stats[t.floor].free += 1;
          stats[t.floor].seats += t.seats;
        }
      }
    });

    return stats;
  }, [tables]);

  // Calculate elapsed time formatted string
  const formatTimeSince = (dateStr) => {
    if (!dateStr) return '';
    const diffMs = new Date() - new Date(dateStr);
    const mins = Math.floor(diffMs / (1000 * 60));
    if (mins < 1) return 'Just seated';
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    return `${mins}m`;
  };

  // If staff is not logged in, show Staff Login Screen
  if (!currentStaff) {
    return <Login onLoginSuccess={(session) => setCurrentStaff(session)} />;
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-stone-900 flex flex-col font-sans">
      {/* Top Staff Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/90 px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center text-xl shadow-xs">
            🍜
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-stone-900 flex items-center gap-2">
                MISO <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">TABLES</span>
              </h1>
            </div>
            <p className="text-xs text-stone-500 font-medium">5-Story Restaurant Seating Manager</p>
          </div>
        </div>

        {/* Global Summary Badge */}
        <div className="hidden md:flex items-center gap-2 text-xs bg-stone-50 border border-stone-200 rounded-xl p-1.5 px-3">
          <div className="flex items-center gap-1.5 pr-3 border-r border-stone-200">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-stone-500">Available:</span>
            <span className="font-bold text-emerald-700">{floorStats.all.free} Tables ({floorStats.all.seats} Seats)</span>
          </div>
          <div className="flex items-center gap-1.5 pl-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span className="text-stone-500">Occupied:</span>
            <span className="font-bold text-rose-700">{floorStats.all.total - floorStats.all.free} Tables</span>
          </div>
        </div>

        {/* Right Action Bar: Add Table & Staff Profile */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setFormName(`Table ${(selectedFloor === 'all' ? 1 : selectedFloor) * 100 + (tables.filter(t => t.floor === (selectedFloor === 'all' ? 1 : selectedFloor)).length + 1)}`);
              setFormFloor(selectedFloor === 'all' ? 1 : selectedFloor);
              setFormSeats(4);
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Table</span>
          </button>

          {/* Active Staff Badge & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-stone-200">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-stone-900 flex items-center justify-end gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                {currentStaff.name}
              </div>
              <div className="text-[10px] text-stone-500 font-semibold">
                {currentStaff.role} {currentStaff.assignedFloor !== 'all' ? `• Floor ${currentStaff.assignedFloor}` : ''}
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out of Shift"
              className="p-2 rounded-xl bg-stone-100 border border-stone-200 hover:bg-rose-50 hover:border-rose-200 text-stone-600 hover:text-rose-600 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 flex flex-col gap-6">

        {/* Floor Selection Tabs */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-stone-600" />
              Select Floor
            </h2>
            <div className="text-xs font-medium text-stone-500">
              Showing {filteredTables.length} {filteredTables.length === 1 ? 'table' : 'tables'}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            {/* All Floors Tab */}
            <button
              onClick={() => setSelectedFloor('all')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                selectedFloor === 'all'
                  ? 'bg-white border-2 border-stone-900 shadow-sm ring-1 ring-stone-900/10'
                  : 'bg-white border border-stone-200 hover:border-stone-300 text-stone-700'
              }`}
            >
              <div className="text-xs font-bold text-stone-600">All Floors</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-stone-900">{floorStats.all.free}</span>
                <span className="text-[11px] text-stone-500 font-semibold">/{floorStats.all.total} free</span>
              </div>
              <div className="text-[10px] text-emerald-700 font-bold mt-0.5">{floorStats.all.seats} seats open</div>
            </button>

            {/* Individual Floors 1 to 5 */}
            {[1, 2, 3, 4, 5].map((fl) => {
              const stat = floorStats[fl];
              const isSelected = selectedFloor === fl;
              const hasFree = stat.free > 0;

              return (
                <button
                  key={fl}
                  onClick={() => setSelectedFloor(fl)}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                    isSelected
                      ? 'bg-white border-2 border-stone-900 shadow-sm ring-1 ring-stone-900/10'
                      : 'bg-white border border-stone-200 hover:border-stone-300 text-stone-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-600">Floor {fl}</span>
                    <span className={`w-2 h-2 rounded-full ${hasFree ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className={`text-xl font-black ${hasFree ? 'text-stone-900' : 'text-rose-600'}`}>
                      {stat.free}
                    </span>
                    <span className="text-[11px] text-stone-500 font-semibold">/{stat.total} free</span>
                  </div>
                  <div className="text-[10px] text-stone-500 font-medium mt-0.5">
                    {stat.seats} seats open
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Filter & Quick Helper Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-stone-200/90 rounded-2xl p-3 px-4 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-stone-500 font-medium mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-stone-400" />
              Filter:
            </span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('available')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'available'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs'
                  : 'text-stone-600 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Only Free (Green)
            </button>
            <button
              onClick={() => setStatusFilter('occupied')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'occupied'
                  ? 'bg-rose-100 text-rose-800 border border-rose-300 shadow-xs'
                  : 'text-stone-600 hover:bg-rose-50 hover:text-rose-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              Only Occupied (Red)
            </button>
          </div>

          {/* Party size filter for receptionists finding table for arriving group */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500 font-medium">Party Size:</span>
            <div className="flex items-center gap-1">
              {[0, 2, 4, 6, 8].map((size) => (
                <button
                  key={size}
                  onClick={() => setPartySizeFilter(size)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                    partySizeFilter === size
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                  }`}
                >
                  {size === 0 ? 'All' : `${size}+`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tables Grid */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-stone-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-stone-700" />
            <p className="text-sm font-medium">Loading tables across floors...</p>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="py-20 bg-white border border-stone-200/90 rounded-3xl flex flex-col items-center justify-center text-center p-6 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center text-3xl mb-4 text-stone-500">
              🪑
            </div>
            <h3 className="text-base font-bold text-stone-900">No tables match your filter</h3>
            <p className="text-xs text-stone-500 mt-1 max-w-sm">
              Try switching floors or clearing the filter.
            </p>
            <button
              onClick={() => {
                setSelectedFloor('all');
                setStatusFilter('all');
                setPartySizeFilter(0);
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-semibold text-stone-800 transition-all cursor-pointer border border-stone-200"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredTables.map((table) => {
              const isOccupied = table.is_occupied;

              return (
                <div
                  key={table.id || `${table.floor}-${table.name}`}
                  onClick={() => handleToggleTable(table)}
                  className={`group relative rounded-3xl p-5 border-2 transition-all duration-150 cursor-pointer flex flex-col justify-between min-h-[195px] select-none shadow-xs hover:shadow-md ${
                    isOccupied
                      ? 'bg-rose-50/70 border-rose-400/90 hover:bg-rose-100/70 hover:border-rose-500'
                      : 'bg-emerald-50/70 border-emerald-500/80 hover:bg-emerald-100/70 hover:border-emerald-600'
                  }`}
                >
                  {/* Card Top: Floor badge & Edit/Delete controls */}
                  <div className="flex items-start justify-between">
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-2xs ${
                      isOccupied 
                        ? 'bg-white border-rose-200 text-rose-800' 
                        : 'bg-white border-emerald-200 text-emerald-800'
                    }`}>
                      Floor {table.floor}
                    </span>

                    {/* Manage table buttons */}
                    <div 
                      className="opacity-70 group-hover:opacity-100 flex items-center gap-1 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => openEdit(table, e)}
                        title="Edit Table"
                        className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-stone-600 hover:text-stone-900 border border-stone-200/80 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      
                      {confirmDeleteId === table.id ? (
                        <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 border border-rose-300 shadow-xs">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTable(table.id);
                            }}
                            title="Confirm delete"
                            className="p-1 rounded text-rose-600 hover:bg-rose-50"
                          >
                            <Check className="w-3.5 h-3.5 text-rose-600" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(null);
                            }}
                            title="Cancel"
                            className="p-1 rounded text-stone-400 hover:bg-stone-100"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(table.id);
                          }}
                          title="Remove Table"
                          className="p-1.5 rounded-lg bg-white/90 hover:bg-rose-50 text-stone-500 hover:text-rose-600 border border-stone-200/80 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Center: Table Name & Seating capacity */}
                  <div className="my-2.5">
                    <h3 className="text-xl font-extrabold text-stone-900 tracking-tight">
                      {table.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-stone-600">
                      <Users className="w-4 h-4 text-stone-500" />
                      <span>{table.seats} Chairs</span>
                    </div>
                  </div>

                  {/* Card Bottom: Status & Quick Tap Prompt */}
                  <div className="pt-3 border-t border-stone-200/70 flex items-center justify-between">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isOccupied ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        <span className={`text-xs font-black uppercase tracking-wide ${isOccupied ? 'text-rose-800' : 'text-emerald-800'}`}>
                          {isOccupied ? 'OCCUPIED' : 'AVAILABLE'}
                        </span>
                      </div>
                      {isOccupied && table.seated_at && (
                        <span className="text-[10px] text-stone-500 font-medium flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTimeSince(table.seated_at)}
                        </span>
                      )}
                    </div>

                    <div className={`text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all shadow-xs ${
                      isOccupied 
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}>
                      {isOccupied ? 'Free Up ➜' : 'Seat Guests ➜'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Clean Restaurant Footer */}
      <footer className="mt-auto border-t border-stone-200 bg-white px-4 py-3.5 text-center text-xs text-stone-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-stone-700">MISO Restaurant System</span>
          <span>•</span>
          <span className="text-emerald-700 font-medium">Real-Time Sync Active</span>
        </div>
        <div className="text-stone-500 text-[11px]">
          Tap any table box to toggle between Available (Green) and Occupied (Red).
        </div>
      </footer>

      {/* ADD TABLE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200">
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-stone-900" />
                Add New Table
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTable} className="mt-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Table Name or Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Table 106, VIP Booth, Window 1"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-sm focus:outline-none focus:bg-white focus:border-stone-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Floor Level
                  </label>
                  <select
                    value={formFloor}
                    onChange={(e) => setFormFloor(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-sm focus:outline-none focus:bg-white focus:border-stone-400"
                  >
                    {[1, 2, 3, 4, 5].map((fl) => (
                      <option key={fl} value={fl}>Floor {fl}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Chairs / Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    required
                    value={formSeats}
                    onChange={(e) => setFormSeats(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-sm focus:outline-none focus:bg-white focus:border-stone-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-4 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  Create Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TABLE MODAL */}
      {editingTable && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200">
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-stone-900" />
                Edit Table
              </h3>
              <button
                onClick={() => setEditingTable(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Table Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-sm focus:outline-none focus:bg-white focus:border-stone-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Floor Level
                  </label>
                  <select
                    value={formFloor}
                    onChange={(e) => setFormFloor(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-sm focus:outline-none focus:bg-white focus:border-stone-400"
                  >
                    {[1, 2, 3, 4, 5].map((fl) => (
                      <option key={fl} value={fl}>Floor {fl}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Chairs / Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    required
                    value={formSeats}
                    onChange={(e) => setFormSeats(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-sm focus:outline-none focus:bg-white focus:border-stone-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-4 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setEditingTable(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
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
