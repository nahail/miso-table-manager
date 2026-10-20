import React, { useState } from 'react';
import { ArrowRight, Delete } from 'lucide-react';

// Default Staff Accounts & PINs for MISO
const STAFF_PRESETS = [
  {
    role: 'Receptionist',
    label: 'Host Desk / Reception',
    icon: '🛎️',
    pin: '1234',
    assignedFloor: 'all',
    desc: 'Front entrance table seating & floor monitoring',
  },
  {
    role: 'Floor Waiter',
    label: 'Floor Waiter / Server',
    icon: '🍽️',
    pin: '5678',
    assignedFloor: 1,
    desc: 'Floor service & quick table free-up',
  },
  {
    role: 'Manager',
    label: 'Restaurant Manager',
    icon: '👑',
    pin: '0000',
    assignedFloor: 'all',
    desc: 'Full floor oversight & table configuration',
  },
];

export default function Login({ onLoginSuccess }) {
  const [selectedRole, setSelectedRole] = useState(STAFF_PRESETS[0]);
  const [staffName, setStaffName] = useState('Front Desk Host');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [waiterFloor, setWaiterFloor] = useState(1);

  const handleSelectRole = (preset) => {
    setSelectedRole(preset);
    setPin('');
    setError('');
    if (preset.role === 'Receptionist') setStaffName('Front Desk Host');
    else if (preset.role === 'Floor Waiter') setStaffName(`Waiter (Floor ${waiterFloor})`);
    else if (preset.role === 'Manager') setStaffName('Shift Manager');
  };

  const handleKeypadPress = (val) => {
    setError('');
    if (pin.length < 6) {
      setPin((prev) => prev + val);
    }
  };

  const handleBackspace = () => {
    setError('');
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();

    if (pin === selectedRole.pin || pin === '0000' || pin === '1234' || pin === '5678') {
      const session = {
        name: staffName || selectedRole.role,
        role: selectedRole.role,
        assignedFloor: selectedRole.role === 'Floor Waiter' ? waiterFloor : 'all',
        loggedInAt: new Date().toISOString(),
      };
      localStorage.setItem('miso_staff_session', JSON.stringify(session));
      onLoginSuccess(session);
    } else {
      setError(`Incorrect PIN. (Tip: Try ${selectedRole.pin})`);
    }
  };

  const handleQuickLogin = (preset) => {
    const session = {
      name: preset.role === 'Floor Waiter' ? `Waiter (Floor ${waiterFloor})` : preset.label,
      role: preset.role,
      assignedFloor: preset.role === 'Floor Waiter' ? waiterFloor : 'all',
      loggedInAt: new Date().toISOString(),
    };
    localStorage.setItem('miso_staff_session', JSON.stringify(session));
    onLoginSuccess(session);
  };

  return (
    <div className="min-h-screen bg-[#5d1022] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#7a1932] via-[#5d1022] to-[#450a18] text-[#fcf6ee] flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-[#420a17]/95 border-2 border-[#d39f61] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50 backdrop-blur-md flex flex-col gap-6">
        {/* Brand Logo & Header */}
        <div className="flex flex-col items-center text-center">
          {/* Official Brand Logo with Chopsticks-Bowl and Gold Banner */}
          <div className="w-48 sm:w-52 rounded-2xl overflow-hidden shadow-xl border-2 border-[#d39f61] bg-[#5d1022] mb-3">
            <img 
              src="/logo.png" 
              alt="Miso Asian Fusion" 
              className="w-full h-auto object-contain block" 
            />
          </div>
          
          <div className="flex flex-col items-center">
            <h1 className="font-['Cinzel',_serif] text-2xl sm:text-3xl font-extrabold tracking-[0.2em] text-[#d39f61] drop-shadow-sm">
              MISO
            </h1>
            <span className="font-['Tenor_Sans',_sans-serif] text-[11px] font-bold tracking-[0.35em] text-[#f4d9b6] uppercase mt-0.5">
              Asian Fusion
            </span>
            <p className="text-[11px] text-[#f4d9b6]/85 mt-2 font-medium">
              Staff Table Management &amp; Seating Portal
            </p>
          </div>
        </div>

        {/* Staff Role Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-[#d39f61] uppercase tracking-wider">
            Select Your Role
          </label>
          <div className="grid grid-cols-3 gap-2">
            {STAFF_PRESETS.map((preset) => {
              const isSelected = selectedRole.role === preset.role;
              return (
                <button
                  key={preset.role}
                  type="button"
                  onClick={() => handleSelectRole(preset)}
                  className={`p-3 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#78182f] border-[#d39f61] shadow-lg shadow-[#d39f61]/25 text-white ring-1 ring-[#d39f61]'
                      : 'bg-[#28050e]/80 border-[#d39f61]/35 text-stone-200 hover:border-[#d39f61]/80 hover:bg-[#380814]'
                  }`}
                >
                  <span className="text-xl">{preset.icon}</span>
                  <span className={`text-xs font-black leading-tight ${isSelected ? 'text-[#d39f61]' : 'text-[#f4d9b6]'}`}>
                    {preset.role}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Waiter Floor Assignment */}
        {selectedRole.role === 'Floor Waiter' && (
          <div className="bg-[#28050e] border border-[#d39f61]/40 rounded-2xl p-3 flex items-center justify-between">
            <span className="text-xs font-bold text-[#d39f61]">Assigned Floor:</span>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((fl) => (
                <button
                  key={fl}
                  type="button"
                  onClick={() => {
                    setWaiterFloor(fl);
                    setStaffName(`Waiter (Floor ${fl})`);
                  }}
                  className={`w-7 h-7 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    waiterFloor === fl
                      ? 'bg-[#78182f] text-[#d39f61] border border-[#d39f61] shadow-xs'
                      : 'bg-[#3d0814] border border-[#d39f61]/30 text-stone-200 hover:text-white'
                  }`}
                >
                  {fl}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Staff Name & PIN Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-[#f4d9b6] mb-1">
              Staff Member Name
            </label>
            <input
              type="text"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="e.g. Host / Server"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#23040c] border border-[#d39f61]/50 text-white text-sm focus:outline-none focus:border-[#d39f61] font-semibold placeholder-stone-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-[#f4d9b6]">
                Enter Staff PIN
              </label>
              <span className="text-[11px] text-[#f4d9b6]/80">
                Default PIN: <strong className="font-mono text-[#d39f61] font-black">{selectedRole.pin}</strong>
              </span>
            </div>

            {/* PIN Display Dots */}
            <div className="w-full h-12 bg-[#23040c] border border-[#d39f61]/50 rounded-xl flex items-center justify-center gap-3">
              {[0, 1, 2, 3].map((idx) => (
                <span
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                    pin.length > idx
                      ? 'bg-[#d39f61] scale-110 shadow-sm shadow-[#d39f61]/60'
                      : 'bg-[#500c1b]'
                  }`}
                />
              ))}
            </div>
            {error && (
              <p className="text-xs text-rose-300 mt-1.5 text-center font-bold">
                {error}
              </p>
            )}
          </div>

          {/* Touchscreen Numeric Keypad */}
          <div className="grid grid-cols-3 gap-2 mt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeypadPress(digit)}
                className="h-12 rounded-xl bg-[#330713] hover:bg-[#4f0c1e] active:bg-[#6e142b] border border-[#d39f61]/35 text-base font-black text-white transition-all cursor-pointer shadow-xs hover:border-[#d39f61]"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-12 rounded-xl bg-[#22040c] hover:bg-[#330713] border border-[#d39f61]/35 text-xs font-bold text-[#f4d9b6] hover:text-white transition-all cursor-pointer"
            >
              Clear
            </button>
            <button
              key="0"
              type="button"
              onClick={() => handleKeypadPress('0')}
              className="h-12 rounded-xl bg-[#330713] hover:bg-[#4f0c1e] active:bg-[#6e142b] border border-[#d39f61]/35 text-base font-black text-white transition-all cursor-pointer shadow-xs hover:border-[#d39f61]"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-12 rounded-xl bg-[#22040c] hover:bg-[#330713] border border-[#d39f61]/35 flex items-center justify-center text-[#f4d9b6] hover:text-white transition-all cursor-pointer"
            >
              <Delete className="w-4 h-4" />
            </button>
          </div>

          {/* Login Submit Button - Radiant Champagne Gold */}
          <button
            type="submit"
            className="w-full mt-2 py-3.5 rounded-2xl bg-[#d39f61] hover:bg-[#be8c4d] text-[#360812] font-black text-base shadow-xl active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 border-2 border-[#fdf2e3]"
          >
            <span>Log In to Shift</span>
            <ArrowRight className="w-4 h-4 text-[#360812]" />
          </button>
        </form>

        {/* Quick Shift Access Shortcut */}
        <div className="pt-2 border-t border-[#d39f61]/30 text-center">
          <p className="text-[11px] text-[#f4d9b6]/80 mb-2 font-semibold">Fast 1-tap shift login:</p>
          <div className="flex items-center justify-center gap-2">
            {STAFF_PRESETS.map((p) => (
              <button
                key={p.role}
                type="button"
                onClick={() => handleQuickLogin(p)}
                className="px-2.5 py-1.5 rounded-lg bg-[#23040c] hover:bg-[#360814] border border-[#d39f61]/50 text-[11px] font-black text-[#d39f61] transition-colors cursor-pointer"
              >
                {p.icon} {p.role}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
