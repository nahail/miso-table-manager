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
    <div className="min-h-screen bg-[#f4f5f7] text-stone-900 flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-stone-200/50 flex flex-col gap-6">
        {/* Restaurant Header */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-stone-900 flex items-center justify-center text-2xl shadow-sm mb-3">
            🍜
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">
              MISO
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
              STAFF PORTAL
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Sign in to access restaurant table management
          </p>
        </div>

        {/* Staff Role Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
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
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    isSelected
                      ? 'bg-stone-900 border-stone-900 shadow-sm text-white'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  <span className="text-xl">{preset.icon}</span>
                  <span className="text-xs font-bold leading-tight">{preset.role}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Waiter Floor Assignment (if Floor Waiter role is picked) */}
        {selectedRole.role === 'Floor Waiter' && (
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-700">Assigned Floor:</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((fl) => (
                <button
                  key={fl}
                  type="button"
                  onClick={() => {
                    setWaiterFloor(fl);
                    setStaffName(`Waiter (Floor ${fl})`);
                  }}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    waiterFloor === fl
                      ? 'bg-stone-900 text-white shadow-sm'
                      : 'bg-white border border-stone-200 text-stone-600 hover:text-stone-900'
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
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Staff Member Name
            </label>
            <input
              type="text"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="e.g. John / Sarah"
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-sm focus:outline-none focus:bg-white focus:border-stone-400 font-medium"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-stone-600">
                Enter Staff PIN
              </label>
              <span className="text-[11px] text-stone-500">
                Default PIN: <strong className="font-mono text-stone-900 font-bold">{selectedRole.pin}</strong>
              </span>
            </div>

            {/* PIN Display Dots */}
            <div className="w-full h-12 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-center gap-3">
              {[0, 1, 2, 3].map((idx) => (
                <span
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                    pin.length > idx
                      ? 'bg-stone-900 scale-110'
                      : 'bg-stone-200'
                  }`}
                />
              ))}
            </div>
            {error && (
              <p className="text-xs text-rose-600 mt-1.5 text-center font-semibold">
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
                className="h-12 rounded-xl bg-stone-50 hover:bg-stone-100 active:bg-stone-200 border border-stone-200/80 text-base font-bold text-stone-900 transition-all cursor-pointer shadow-sm"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-12 rounded-xl bg-stone-100/70 hover:bg-stone-200 border border-stone-200 text-xs font-bold text-stone-600 hover:text-stone-900 transition-all cursor-pointer"
            >
              Clear
            </button>
            <button
              key="0"
              type="button"
              onClick={() => handleKeypadPress('0')}
              className="h-12 rounded-xl bg-stone-50 hover:bg-stone-100 active:bg-stone-200 border border-stone-200/80 text-base font-bold text-stone-900 transition-all cursor-pointer shadow-sm"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-12 rounded-xl bg-stone-100/70 hover:bg-stone-200 border border-stone-200 flex items-center justify-center text-stone-600 hover:text-stone-900 transition-all cursor-pointer"
            >
              <Delete className="w-4 h-4" />
            </button>
          </div>

          {/* Login Submit Button */}
          <button
            type="submit"
            className="w-full mt-2 py-3.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm shadow-md active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Log In to Shift</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Shift Access Shortcut */}
        <div className="pt-2 border-t border-stone-200 text-center">
          <p className="text-[11px] text-stone-400 mb-2 font-medium">Fast 1-tap shift login:</p>
          <div className="flex items-center justify-center gap-2">
            {STAFF_PRESETS.map((p) => (
              <button
                key={p.role}
                type="button"
                onClick={() => handleQuickLogin(p)}
                className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 border border-stone-200 text-[11px] font-semibold text-stone-700 hover:text-stone-900 transition-colors cursor-pointer"
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
