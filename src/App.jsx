import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, Plus, Trash2, Edit3, Check, X, RefreshCw, 
  Layers, Clock, Filter, LogOut
} from 'lucide-react';
import { 
  getSupabase, 
  isSupabaseConfigured, 
  DEFAULT_TABLES 
} from './lib/supabaseClient';
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

  // Backend Realtime Connection & Broadcast Channel Ref
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const realtimeChannelRef = useRef(null);

  // Set default floor based on staff role when logged in
  useEffect(() => {
    if (currentStaff && currentStaff.assignedFloor) {
      setSelectedFloor(currentStaff.assignedFloor);
    }
  }, [currentStaff]);

  // Initial table fetch
  useEffect(() => {
    if (currentStaff) {
      initApp();
    }
  }, [currentStaff]);

  const initApp = async () => {
    setLoading(true);
    const configured = isSupabaseConfigured();
    setSupabaseConnected(configured);

    if (configured) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('tables')
            .select('*')
            .order('floor', { ascending: true })
            .order('name', { ascending: true });

          if (error) {
            console.error('Supabase fetch error, using local tables:', error);
            loadLocalTables();
          } else if (data && data.length > 0) {
            setTables(data);
          } else {
            loadLocalTables();
          }
        } catch (err) {
          console.error(err);
          loadLocalTables();
        }
      } else {
        loadLocalTables();
      }
    } else {
      loadLocalTables();
    }
    setLoading(false);
  };

  // Silent background refetch (used by polling & window focus)
  const silentFetchTables = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('floor', { ascending: true })
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        setTables(data);
      }
    } catch (e) {
      // ignore background poll errors
    }
  };

  // Setup Multi-Device Realtime Sync (Broadcast + Postgres Changes + Background Poll)
  useEffect(() => {
    if (!supabaseConnected || !currentStaff) return;

    const supabase = getSupabase();
    if (!supabase) return;

    // 1. WebSocket Channel for Sub-second Broadcasts & DB changes
    const channel = supabase.channel('miso_realtime_sync');
    
    // Instant broadcast when any staff toggles a table
    channel
      .on('broadcast', { event: 'table_toggled' }, ({ payload }) => {
        if (!payload || !payload.id) return;
        setTables((prev) =>
          prev.map((t) =>
            t.id === payload.id
              ? { ...t, is_occupied: payload.is_occupied, seated_at: payload.seated_at }
              : t
          )
        );
      })
      // Broadcast when tables are added, edited, or removed
      .on('broadcast', { event: 'tables_updated' }, () => {
        silentFetchTables();
      })
      // Direct Postgres Changes listener
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
        silentFetchTables();
      })
      .subscribe();

    realtimeChannelRef.current = channel;

    // 2. Continuous Background Poll (every 2.5 seconds) to guarantee sync across phones & tablets
    const pollInterval = setInterval(() => {
      silentFetchTables();
    }, 2500);

    // 3. Sync immediately when waiter unlocks phone or switches back to browser tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        silentFetchTables();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [supabaseConnected, currentStaff]);

  const loadLocalTables = () => {
    const cached = localStorage.getItem('miso_local_tables');
    if (cached) {
      try {
        setTables(JSON.parse(cached));
        return;
      } catch (e) {
        console.error(e);
      }
    }
    setTables(DEFAULT_TABLES);
    localStorage.setItem('miso_local_tables', JSON.stringify(DEFAULT_TABLES));
  };

  const saveLocalTables = (updated) => {
    setTables(updated);
    localStorage.setItem('miso_local_tables', JSON.stringify(updated));
  };

  // Toggle Table Occupancy (Green <-> Red)
  const handleToggleTable = async (table) => {
    const newOccupied = !table.is_occupied;
    const seatedAt = newOccupied ? new Date().toISOString() : null;

    // 1. Optimistic Local Update
    const updatedTables = tables.map((t) =>
      t.id === table.id ? { ...t, is_occupied: newOccupied, seated_at: seatedAt } : t
    );
    setTables(updatedTables);

    // 2. Instant Real-time WebSocket Broadcast to ALL connected devices (< 50ms)
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.send({
        type: 'broadcast',
        event: 'table_toggled',
        payload: {
          id: table.id,
          is_occupied: newOccupied,
          seated_at: seatedAt,
        },
      });
    }

    // 3. Persist update to Supabase Database
    if (supabaseConnected) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { error } = await supabase
            .from('tables')
            .update({ is_occupied: newOccupied, seated_at: seatedAt })
            .eq('id', table.id);

          if (error) {
            console.error('Database update error:', error);
          }
        } catch (err) {
          console.error('Update failed:', err);
        }
      }
    } else {
      saveLocalTables(updatedTables);
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

    if (supabaseConnected) {
      const supabase = getSupabase();
      if (supabase) {
        const { data, error } = await supabase.from('tables').insert([newTableData]).select();
        if (error) {
          alert('Failed to add table: ' + error.message);
          return;
        }
        if (data && data[0]) {
          setTables((prev) => [...prev, data[0]].sort((a, b) => a.floor - b.floor || a.name.localeCompare(b.name)));
          // Broadcast to other screens
          if (realtimeChannelRef.current) {
            realtimeChannelRef.current.send({
              type: 'broadcast',
              event: 'tables_updated',
              payload: {},
            });
          }
        }
      }
    } else {
      const localNewTable = {
        ...newTableData,
        id: 'local_' + Date.now(),
      };
      const updated = [...tables, localNewTable].sort((a, b) => a.floor - b.floor || a.name.localeCompare(b.name));
      saveLocalTables(updated);
    }

    setFormName('');
    setIsAddModalOpen(false);
  };

  // Edit Table
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTable || !formName.trim()) return;

    const updatedData = {
      name: formName.trim(),
      floor: parseInt(formFloor, 10),
      seats: parseInt(formSeats, 10) || 4,
    };

    if (supabaseConnected) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('tables').update(updatedData).eq('id', editingTable.id);
        if (error) {
          alert('Failed to update table: ' + error.message);
          return;
        }
        if (realtimeChannelRef.current) {
          realtimeChannelRef.current.send({
            type: 'broadcast',
            event: 'tables_updated',
            payload: {},
          });
        }
      }
    }

    const updated = tables.map((t) => (t.id === editingTable.id ? { ...t, ...updatedData } : t));
    setTables(updated);
    if (!supabaseConnected) saveLocalTables(updated);

    setEditingTable(null);
  };

  // Delete Table
  const handleDeleteTable = async (id) => {
    if (supabaseConnected) {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('tables').delete().eq('id', id);
        if (error) {
          alert('Failed to delete table: ' + error.message);
          return;
        }
        if (realtimeChannelRef.current) {
          realtimeChannelRef.current.send({
            type: 'broadcast',
            event: 'tables_updated',
            payload: {},
          });
        }
      }
    }

    const updated = tables.filter((t) => t.id !== id);
    setTables(updated);
    if (!supabaseConnected) saveLocalTables(updated);
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
    <div className="min-h-screen bg-[#0c0d10] text-neutral-100 flex flex-col font-sans">
      {/* Top Staff Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#121318]/95 backdrop-blur-md border-b border-neutral-800 px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center text-xl shadow-lg shadow-orange-500/20">
            🍜
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                MISO <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">TABLES</span>
              </h1>
            </div>
            <p className="text-xs text-neutral-400">5-Story Restaurant Seating Manager</p>
          </div>
        </div>

        {/* Global Summary Badge */}
        <div className="hidden md:flex items-center gap-2 text-xs bg-neutral-900 border border-neutral-800 rounded-xl p-1.5 px-3">
          <div className="flex items-center gap-1.5 pr-3 border-r border-neutral-800">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-neutral-400">Available:</span>
            <span className="font-bold text-emerald-400">{floorStats.all.free} Tables ({floorStats.all.seats} Seats)</span>
          </div>
          <div className="flex items-center gap-1.5 pl-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span className="text-neutral-400">Occupied:</span>
            <span className="font-bold text-rose-400">{floorStats.all.total - floorStats.all.free} Tables</span>
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
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-lg shadow-orange-600/30 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Table</span>
          </button>

          {/* Active Staff Badge & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-neutral-800">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-white flex items-center justify-end gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                {currentStaff.name}
              </div>
              <div className="text-[10px] text-orange-400/90 font-medium">
                {currentStaff.role} {currentStaff.assignedFloor !== 'all' ? `• Floor ${currentStaff.assignedFloor}` : ''}
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out of Shift"
              className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-rose-950/40 hover:border-rose-500/40 text-neutral-400 hover:text-rose-300 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
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
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-orange-500" />
              Select Floor
            </h2>
            <div className="text-xs text-neutral-500">
              Showing {filteredTables.length} {filteredTables.length === 1 ? 'table' : 'tables'}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {/* All Floors Tab */}
            <button
              onClick={() => setSelectedFloor('all')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                selectedFloor === 'all'
                  ? 'bg-neutral-800 border-orange-500/60 shadow-lg ring-1 ring-orange-500/30'
                  : 'bg-neutral-900/80 border-neutral-800/80 hover:bg-neutral-800/60 hover:border-neutral-700'
              }`}
            >
              <div className="text-xs font-bold text-neutral-300">All Floors</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg font-black text-white">{floorStats.all.free}</span>
                <span className="text-[10px] text-neutral-400 font-medium">/{floorStats.all.total} free</span>
              </div>
              <div className="text-[10px] text-emerald-400 font-medium mt-0.5">{floorStats.all.seats} seats available</div>
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
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                    isSelected
                      ? 'bg-neutral-800 border-orange-500/60 shadow-lg ring-1 ring-orange-500/30'
                      : 'bg-neutral-900/80 border-neutral-800/80 hover:bg-neutral-800/60 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-300">Floor {fl}</span>
                    <span className={`w-2 h-2 rounded-full ${hasFree ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className={`text-lg font-black ${hasFree ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {stat.free}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-medium">/{stat.total} free</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 font-medium mt-0.5">
                    {stat.seats} seats open
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Filter & Quick Helper Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-3 px-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-400 font-medium mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-neutral-500" />
              Filter:
            </span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-neutral-800 text-white border border-neutral-700'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('available')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'available'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50'
                  : 'text-neutral-400 hover:text-emerald-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Only Free (Green)
            </button>
            <button
              onClick={() => setStatusFilter('occupied')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'occupied'
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-500/50'
                  : 'text-neutral-400 hover:text-rose-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              Only Occupied (Red)
            </button>
          </div>

          {/* Party size filter for receptionists finding table for arriving group */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 font-medium">Party Size:</span>
            <div className="flex items-center gap-1">
              {[0, 2, 4, 6, 8].map((size) => (
                <button
                  key={size}
                  onClick={() => setPartySizeFilter(size)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                    partySizeFilter === size
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'bg-neutral-800/80 text-neutral-400 hover:bg-neutral-800 hover:text-white'
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
          <div className="py-24 flex flex-col items-center justify-center text-neutral-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
            <p className="text-sm font-medium">Loading tables across floors...</p>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="py-20 bg-neutral-900/40 border border-neutral-800/80 rounded-3xl flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-2xl bg-neutral-800/80 flex items-center justify-center text-3xl mb-4 text-neutral-400">
              🪑
            </div>
            <h3 className="text-base font-bold text-white">No tables match your filter</h3>
            <p className="text-xs text-neutral-400 mt-1 max-w-sm">
              Try switching floors or clearing the filter.
            </p>
            <button
              onClick={() => {
                setSelectedFloor('all');
                setStatusFilter('all');
                setPartySizeFilter(0);
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white transition-all cursor-pointer"
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
                  key={table.id}
                  onClick={() => handleToggleTable(table)}
                  className={`group relative rounded-3xl p-5 border transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[190px] select-none shadow-md ${
                    isOccupied
                      ? 'bg-rose-950/40 border-rose-600/60 hover:bg-rose-950/60 hover:border-rose-500 shadow-rose-950/30'
                      : 'bg-emerald-950/40 border-emerald-600/60 hover:bg-emerald-950/60 hover:border-emerald-500 shadow-emerald-950/30'
                  }`}
                >
                  {/* Card Top: Floor badge & Edit/Delete controls */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-900/80 text-neutral-300 border border-neutral-700">
                        Floor {table.floor}
                      </span>
                    </div>

                    {/* Manage table buttons */}
                    <div 
                      className="opacity-60 group-hover:opacity-100 flex items-center gap-1 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => openEdit(table, e)}
                        title="Edit Table"
                        className="p-1.5 rounded-lg bg-neutral-900/70 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      
                      {confirmDeleteId === table.id ? (
                        <div className="flex items-center gap-1 bg-red-900/90 rounded-lg p-0.5 border border-red-500">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTable(table.id);
                            }}
                            title="Confirm delete"
                            className="p-1 rounded text-red-200 hover:text-white"
                          >
                            <Check className="w-3 h-3 text-red-300" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(null);
                            }}
                            title="Cancel"
                            className="p-1 rounded text-neutral-400 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(table.id);
                          }}
                          title="Remove Table"
                          className="p-1.5 rounded-lg bg-neutral-900/70 hover:bg-rose-900/60 text-neutral-400 hover:text-rose-300 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Center: Table Name & Seating capacity */}
                  <div className="my-2">
                    <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                      {table.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs font-semibold text-neutral-300">
                      <Users className="w-4 h-4 text-orange-400" />
                      <span>{table.seats} Chairs</span>
                    </div>
                  </div>

                  {/* Card Bottom: Status & Quick Tap Prompt */}
                  <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${isOccupied ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'}`} />
                        <span className={`text-xs font-black uppercase tracking-wide ${isOccupied ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {isOccupied ? 'OCCUPIED' : 'AVAILABLE'}
                        </span>
                      </div>
                      {isOccupied && table.seated_at && (
                        <span className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTimeSince(table.seated_at)}
                        </span>
                      )}
                    </div>

                    <div className={`text-[10px] font-bold px-2.5 py-1 rounded-xl transition-all ${
                      isOccupied 
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 group-hover:bg-rose-500 group-hover:text-white'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 group-hover:bg-emerald-500 group-hover:text-white'
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
      <footer className="mt-auto border-t border-neutral-900 bg-[#0e0f14] px-4 py-3 text-center text-xs text-neutral-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span>MISO Restaurant Operating System</span>
          <span>•</span>
          <span className="text-emerald-400/90 font-medium">Real-Time Sync Active</span>
        </div>
        <div className="text-neutral-500 text-[11px]">
          Tap any table box to toggle between Available (Green) and Occupied (Red).
        </div>
      </footer>

      {/* ADD TABLE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16171d] border border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-orange-500" />
                Add New Table
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTable} className="mt-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Table Name or Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Table 106, VIP Booth, Window 1"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Floor Level
                  </label>
                  <select
                    value={formFloor}
                    onChange={(e) => setFormFloor(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm focus:outline-none focus:border-orange-500"
                  >
                    {[1, 2, 3, 4, 5].map((fl) => (
                      <option key={fl} value={fl}>Floor {fl}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Chairs / Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    required
                    value={formSeats}
                    onChange={(e) => setFormSeats(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-4 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-lg shadow-orange-600/30 transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16171d] border border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-orange-500" />
                Edit Table
              </h3>
              <button
                onClick={() => setEditingTable(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Table Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Floor Level
                  </label>
                  <select
                    value={formFloor}
                    onChange={(e) => setFormFloor(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm focus:outline-none focus:border-orange-500"
                  >
                    {[1, 2, 3, 4, 5].map((fl) => (
                      <option key={fl} value={fl}>Floor {fl}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Chairs / Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    required
                    value={formSeats}
                    onChange={(e) => setFormSeats(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-4 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditingTable(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-lg shadow-orange-600/30 transition-all cursor-pointer"
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
