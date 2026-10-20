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
    <div className="min-h-screen bg-[#150307] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#380814] via-[#180409] to-[#0d0205] text-[#fcf6ee] flex flex-col font-sans">
      {/* Top Staff Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#24060e]/95 backdrop-blur-md border-b border-[#5d1022] px-4 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xl shadow-[#150307]/50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-[#d39f61] shadow-md shadow-[#d39f61]/20 bg-[#5d1022] flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="MISO" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-['Cinzel',_serif] text-xl font-extrabold tracking-[0.15em] text-[#d39f61] flex items-center gap-2 drop-shadow-xs">
                MISO <span className="font-['Tenor_Sans',_sans-serif] text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#d39f61] text-[#3d0814] uppercase tracking-widest shadow-xs">ASIAN FUSION</span>
              </h1>
            </div>
            <p className="text-xs text-[#f4d9b6]/85 font-medium">Floor &amp; Table Seating Manager</p>
          </div>
        </div>

        {/* Global Summary Badge */}
        <div className="hidden md:flex items-center gap-2 text-xs bg-[#180409] border border-[#5d1022] rounded-xl p-1.5 px-3">
          <div className="flex items-center gap-1.5 pr-3 border-r border-[#5d1022]">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-stone-300 font-medium">Available:</span>
            <span className="font-extrabold text-emerald-400">{floorStats.all.free} Tables ({floorStats.all.seats} Seats)</span>
          </div>
          <div className="flex items-center gap-1.5 pl-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span className="text-stone-300 font-medium">Occupied:</span>
            <span className="font-extrabold text-rose-400">{floorStats.all.total - floorStats.all.free} Tables</span>
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
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#5d1022] hover:bg-[#78172e] text-[#f2d1a3] text-xs font-black shadow-lg shadow-[#5d1022]/40 transition-all active:scale-95 cursor-pointer border-2 border-[#d39f61]"
          >
            <Plus className="w-4 h-4 text-[#d39f61]" />
            <span>Add Table</span>
          </button>

          {/* Active Staff Badge & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#5d1022]">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-white flex items-center justify-end gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                {currentStaff.name}
              </div>
              <div className="text-[10px] text-[#d39f61] font-bold">
                {currentStaff.role} {currentStaff.assignedFloor !== 'all' ? `• Floor ${currentStaff.assignedFloor}` : ''}
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out of Shift"
              className="p-2 rounded-xl bg-[#180409] border border-[#5d1022] hover:bg-[#2c0712] hover:border-rose-500 text-stone-300 hover:text-rose-400 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
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
            <h2 className="text-xs font-black uppercase tracking-wider text-[#d39f61] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#d39f61]" />
              Select Floor
            </h2>
            <div className="text-xs font-semibold text-stone-400">
              Showing {filteredTables.length} {filteredTables.length === 1 ? 'table' : 'tables'}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            {/* All Floors Tab */}
            <button
              onClick={() => setSelectedFloor('all')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                selectedFloor === 'all'
                  ? 'bg-[#5d1022] border-2 border-[#d39f61] shadow-xl shadow-[#d39f61]/20 text-white ring-2 ring-[#d39f61]/40'
                  : 'bg-[#24060e] border border-[#5d1022] hover:border-[#d39f61]/60 text-stone-200 hover:bg-[#2c0812]'
              }`}
            >
              <div className={`text-xs font-extrabold ${selectedFloor === 'all' ? 'text-white' : 'text-stone-300'}`}>
                All Floors
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className={`text-2xl font-black ${selectedFloor === 'all' ? 'text-[#d39f61]' : 'text-white'}`}>
                  {floorStats.all.free}
                </span>
                <span className={`text-[11px] font-semibold ${selectedFloor === 'all' ? 'text-stone-200' : 'text-stone-400'}`}>
                  /{floorStats.all.total} free
                </span>
              </div>
              <div className={`text-[10px] font-bold mt-0.5 ${selectedFloor === 'all' ? 'text-emerald-300' : 'text-emerald-400'}`}>
                {floorStats.all.seats} seats open
              </div>
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
                      ? 'bg-[#5d1022] border-2 border-[#d39f61] shadow-xl shadow-[#d39f61]/20 text-white ring-2 ring-[#d39f61]/40'
                      : 'bg-[#24060e] border border-[#5d1022] hover:border-[#d39f61]/60 text-stone-200 hover:bg-[#2c0812]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-extrabold ${isSelected ? 'text-white' : 'text-stone-300'}`}>
                      Floor {fl}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${hasFree ? 'bg-emerald-400 shadow-xs shadow-emerald-400' : 'bg-rose-400'}`} />
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className={`text-2xl font-black ${
                      isSelected 
                        ? (hasFree ? 'text-[#d39f61]' : 'text-rose-300')
                        : (hasFree ? 'text-white' : 'text-rose-400')
                    }`}>
                      {stat.free}
                    </span>
                    <span className={`text-[11px] font-semibold ${isSelected ? 'text-stone-200' : 'text-stone-400'}`}>
                      /{stat.total} free
                    </span>
                  </div>
                  <div className={`text-[10px] font-bold mt-0.5 ${
                    isSelected ? 'text-stone-200' : 'text-stone-400'
                  }`}>
                    {stat.seats} seats open
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Filter & Quick Helper Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#24060e] border border-[#5d1022] rounded-2xl p-3 px-4 shadow-lg text-white">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#d39f61] font-black mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[#d39f61]" />
              Filter:
            </span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[#5d1022] text-[#d39f61] border border-[#d39f61] shadow-xs'
                  : 'text-stone-300 hover:bg-[#180409] hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('available')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'available'
                  ? 'bg-emerald-950/90 text-emerald-300 border-2 border-emerald-500 shadow-xs'
                  : 'text-stone-300 hover:bg-emerald-950/40 hover:text-emerald-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Only Free (Green)
            </button>
            <button
              onClick={() => setStatusFilter('occupied')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'occupied'
                  ? 'bg-rose-950/90 text-rose-300 border-2 border-rose-500 shadow-xs'
                  : 'text-stone-300 hover:bg-rose-950/40 hover:text-rose-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              Only Occupied (Red)
            </button>
          </div>

          {/* Party size filter for receptionists finding table for arriving group */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-300 font-bold">Party Size:</span>
            <div className="flex items-center gap-1">
              {[0, 2, 4, 6, 8].map((size) => (
                <button
                  key={size}
                  onClick={() => setPartySizeFilter(size)}
                  className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center transition-all cursor-pointer ${
                    partySizeFilter === size
                      ? 'bg-[#5d1022] text-[#d39f61] border border-[#d39f61] shadow-xs'
                      : 'bg-[#180409] text-stone-300 hover:bg-[#2c0712] hover:text-white border border-[#5d1022]'
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
            <RefreshCw className="w-8 h-8 animate-spin text-[#d39f61]" />
            <p className="text-sm font-bold text-stone-300">Loading tables across floors...</p>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="py-20 bg-[#24060e] border border-[#5d1022] rounded-3xl flex flex-col items-center justify-center text-center p-6 shadow-xl text-white">
            <div className="w-16 h-16 rounded-2xl bg-[#180409] border border-[#5d1022] flex items-center justify-center text-3xl mb-4 text-[#d39f61]">
              🪑
            </div>
            <h3 className="text-base font-black text-white">No tables match your filter</h3>
            <p className="text-xs text-stone-300 mt-1 max-w-sm">
              Try switching floors or clearing the filter.
            </p>
            <button
              onClick={() => {
                setSelectedFloor('all');
                setStatusFilter('all');
                setPartySizeFilter(0);
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-[#5d1022] hover:bg-[#78172e] text-xs font-black text-[#d39f61] transition-all cursor-pointer border border-[#d39f61]"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
            {filteredTables.map((table) => {
              const isOccupied = table.is_occupied;

              return (
                <div
                  key={table.id || `${table.floor}-${table.name}`}
                  onClick={() => handleToggleTable(table)}
                  className={`group relative rounded-2xl p-3 sm:p-4 border-2 transition-all duration-150 cursor-pointer flex flex-col justify-between min-h-[128px] sm:min-h-[160px] select-none shadow-md ${
                    isOccupied
                      ? 'bg-[#2d0712] border-rose-600 shadow-rose-950/40 hover:bg-[#380a18] hover:border-rose-500'
                      : 'bg-[#0a2318] border-emerald-500 shadow-emerald-950/40 hover:bg-[#0e2e20] hover:border-emerald-400'
                  }`}
                >
                  {/* Card Top: Floor badge & Edit/Delete controls */}
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-md border shadow-2xs ${
                      isOccupied 
                        ? 'bg-[#180308] border-rose-500/70 text-rose-300' 
                        : 'bg-[#04140e] border-emerald-500/70 text-emerald-300'
                    }`}>
                      Fl {table.floor}
                    </span>

                    {/* Manage table buttons */}
                    <div 
                      className="opacity-75 group-hover:opacity-100 flex items-center gap-0.5 sm:gap-1 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => openEdit(table, e)}
                        title="Edit Table"
                        className={`p-1 rounded border transition-colors cursor-pointer shadow-2xs ${
                          isOccupied
                            ? 'bg-[#180308] hover:bg-[#28050e] text-rose-300 hover:text-white border-rose-600/70'
                            : 'bg-[#04140e] hover:bg-[#0a261a] text-emerald-300 hover:text-white border-emerald-600/70'
                        }`}
                      >
                        <Edit3 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                      
                      {confirmDeleteId === table.id ? (
                        <div className="flex items-center gap-0.5 bg-[#180308] rounded p-0.5 border border-rose-500 shadow-xs">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTable(table.id);
                            }}
                            title="Confirm delete"
                            className="p-0.5 rounded text-rose-400 hover:bg-rose-950"
                          >
                            <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-400" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(null);
                            }}
                            title="Cancel"
                            className="p-0.5 rounded text-stone-400 hover:bg-[#28050e]"
                          >
                            <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(table.id);
                          }}
                          title="Remove Table"
                          className={`p-1 rounded border transition-colors cursor-pointer shadow-2xs ${
                            isOccupied
                              ? 'bg-[#180308] hover:bg-rose-950 text-rose-400 border-rose-600/70'
                              : 'bg-[#04140e] hover:bg-rose-950 text-stone-400 hover:text-rose-400 border-emerald-600/70'
                          }`}
                        >
                          <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Center: Table Name & Seating capacity */}
                  <div className="my-1.5 sm:my-2">
                    <h3 className="text-base sm:text-xl font-black text-white tracking-tight drop-shadow-xs truncate">
                      {table.name}
                    </h3>
                    <div className={`flex items-center gap-1 mt-0.5 text-[11px] sm:text-xs font-bold ${
                      isOccupied ? 'text-rose-200' : 'text-emerald-200'
                    }`}>
                      <Users className={`w-3.5 h-3.5 ${isOccupied ? 'text-rose-400' : 'text-emerald-400'}`} />
                      <span>{table.seats} Chairs</span>
                    </div>
                  </div>

                  {/* Card Bottom: Status & Seated Timer */}
                  <div className={`pt-2 border-t flex items-center justify-between gap-1 ${
                    isOccupied ? 'border-rose-900/60' : 'border-emerald-900/60'
                  }`}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        isOccupied ? 'bg-rose-500 shadow-sm shadow-rose-500' : 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400'
                      }`} />
                      <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider truncate ${
                        isOccupied ? 'text-rose-300' : 'text-emerald-300'
                      }`}>
                        {isOccupied ? 'OCCUPIED' : 'AVAILABLE'}
                      </span>
                    </div>

                    {isOccupied && table.seated_at && (
                      <span className="text-[9px] sm:text-[10px] text-rose-300 font-semibold flex items-center gap-0.5 shrink-0">
                        <Clock className="w-2.5 h-2.5 shrink-0" />
                        {formatTimeSince(table.seated_at)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Clean Restaurant Footer */}
      <footer className="mt-auto border-t border-[#5d1022] bg-[#180409] px-4 py-3.5 text-center text-xs text-stone-300 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-black text-[#d39f61]">MISO Asian Fusion</span>
          <span className="text-stone-500">•</span>
          <span className="text-emerald-400 font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Real-Time Sync Active
          </span>
        </div>
        <div className="text-stone-400 text-[11px] font-semibold">
          Tap any table card to toggle between Available (Green) and Occupied (Red).
        </div>
      </footer>

      {/* ADD TABLE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#24060e] border-2 border-[#d39f61] rounded-3xl max-w-md w-full p-6 shadow-2xl shadow-black animate-in fade-in zoom-in-95 duration-150 text-white">
            <div className="flex items-center justify-between pb-4 border-b border-[#5d1022]">
              <h3 className="text-base font-black text-[#d39f61] flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#d39f61]" />
                Add New Table
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-[#180409]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTable} className="mt-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1.5">
                  Table Name or Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Table 106, VIP Booth, Window 1"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#180409] border border-[#5d1022] text-white text-sm focus:outline-none focus:border-[#d39f61] placeholder-stone-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1.5">
                    Floor Level
                  </label>
                  <select
                    value={formFloor}
                    onChange={(e) => setFormFloor(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#180409] border border-[#5d1022] text-white text-sm focus:outline-none focus:border-[#d39f61]"
                  >
                    {[1, 2, 3, 4, 5].map((fl) => (
                      <option key={fl} value={fl} className="bg-[#180409] text-white">Floor {fl}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1.5">
                    Chairs / Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    required
                    value={formSeats}
                    onChange={(e) => setFormSeats(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#180409] border border-[#5d1022] text-white text-sm focus:outline-none focus:border-[#d39f61]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-4 pt-3 border-t border-[#5d1022]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#5d1022] hover:bg-[#78172e] text-[#d39f61] text-xs font-black shadow-lg shadow-[#5d1022]/40 transition-all cursor-pointer border border-[#d39f61]"
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
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#24060e] border-2 border-[#d39f61] rounded-3xl max-w-md w-full p-6 shadow-2xl shadow-black animate-in fade-in zoom-in-95 duration-150 text-white">
            <div className="flex items-center justify-between pb-4 border-b border-[#5d1022]">
              <h3 className="text-base font-black text-[#d39f61] flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#d39f61]" />
                Edit Table
              </h3>
              <button
                onClick={() => setEditingTable(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-[#180409]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1.5">
                  Table Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#180409] border border-[#5d1022] text-white text-sm focus:outline-none focus:border-[#d39f61]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1.5">
                    Floor Level
                  </label>
                  <select
                    value={formFloor}
                    onChange={(e) => setFormFloor(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#180409] border border-[#5d1022] text-white text-sm focus:outline-none focus:border-[#d39f61]"
                  >
                    {[1, 2, 3, 4, 5].map((fl) => (
                      <option key={fl} value={fl} className="bg-[#180409] text-white">Floor {fl}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1.5">
                    Chairs / Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    required
                    value={formSeats}
                    onChange={(e) => setFormSeats(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#180409] border border-[#5d1022] text-white text-sm focus:outline-none focus:border-[#d39f61]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-4 pt-3 border-t border-[#5d1022]">
                <button
                  type="button"
                  onClick={() => setEditingTable(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#5d1022] hover:bg-[#78172e] text-[#d39f61] text-xs font-black shadow-lg shadow-[#5d1022]/40 transition-all cursor-pointer border border-[#d39f61]"
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
