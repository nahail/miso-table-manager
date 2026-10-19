import { createClient } from '@supabase/supabase-js';

// Get credentials from environment variables or browser localStorage
const getCredentials = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const localUrl = localStorage.getItem('miso_supabase_url');
  const localKey = localStorage.getItem('miso_supabase_anon_key');

  const supabaseUrl = (localUrl && localUrl.trim() !== '') ? localUrl.trim() : (envUrl && envUrl.trim() !== '' && !envUrl.includes('your-project-id') ? envUrl.trim() : null);
  const supabaseKey = (localKey && localKey.trim() !== '') ? localKey.trim() : (envKey && envKey.trim() !== '' && !envKey.includes('your-anon-public-key') ? envKey.trim() : null);

  return { supabaseUrl, supabaseKey };
};

export const isSupabaseConfigured = () => {
  const { supabaseUrl, supabaseKey } = getCredentials();
  return Boolean(supabaseUrl && supabaseKey);
};

export const getStoredCredentials = () => {
  return getCredentials();
};

export const saveSupabaseCredentials = (url, key) => {
  if (url) localStorage.setItem('miso_supabase_url', url.trim());
  else localStorage.removeItem('miso_supabase_url');

  if (key) localStorage.setItem('miso_supabase_anon_key', key.trim());
  else localStorage.removeItem('miso_supabase_anon_key');
};

let clientInstance = null;

export const getSupabase = () => {
  const { supabaseUrl, supabaseKey } = getCredentials();
  if (supabaseUrl && supabaseKey) {
    if (!clientInstance) {
      clientInstance = createClient(supabaseUrl, supabaseKey, {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
    }
    return clientInstance;
  }
  return null;
};

// Initial default tables for 5 floors (used as fallback for local demo mode)
export const DEFAULT_TABLES = [
  // Floor 1
  { id: '101', name: 'Table 101', floor: 1, seats: 2, is_occupied: false, seated_at: null },
  { id: '102', name: 'Table 102', floor: 1, seats: 4, is_occupied: false, seated_at: null },
  { id: '103', name: 'Table 103', floor: 1, seats: 4, is_occupied: false, seated_at: null },
  { id: '104', name: 'Table 104', floor: 1, seats: 6, is_occupied: false, seated_at: null },
  { id: '105', name: 'Table 105', floor: 1, seats: 8, is_occupied: false, seated_at: null },

  // Floor 2
  { id: '201', name: 'Table 201', floor: 2, seats: 2, is_occupied: false, seated_at: null },
  { id: '202', name: 'Table 202', floor: 2, seats: 4, is_occupied: false, seated_at: null },
  { id: '203', name: 'Table 203', floor: 2, seats: 4, is_occupied: false, seated_at: null },
  { id: '204', name: 'Table 204', floor: 2, seats: 6, is_occupied: false, seated_at: null },
  { id: '205', name: 'Table 205', floor: 2, seats: 6, is_occupied: false, seated_at: null },

  // Floor 3
  { id: '301', name: 'Table 301', floor: 3, seats: 2, is_occupied: false, seated_at: null },
  { id: '302', name: 'Table 302', floor: 3, seats: 4, is_occupied: false, seated_at: null },
  { id: '303', name: 'Table 303', floor: 3, seats: 4, is_occupied: false, seated_at: null },
  { id: '304', name: 'Table 304', floor: 3, seats: 4, is_occupied: false, seated_at: null },
  { id: '305', name: 'Table 305', floor: 3, seats: 8, is_occupied: false, seated_at: null },

  // Floor 4
  { id: '401', name: 'Table 401', floor: 4, seats: 2, is_occupied: false, seated_at: null },
  { id: '402', name: 'Table 402', floor: 4, seats: 4, is_occupied: false, seated_at: null },
  { id: '403', name: 'Table 403', floor: 4, seats: 4, is_occupied: false, seated_at: null },
  { id: '404', name: 'Table 404', floor: 4, seats: 6, is_occupied: false, seated_at: null },
  { id: '405', name: 'Table 405', floor: 4, seats: 10, is_occupied: false, seated_at: null },

  // Floor 5
  { id: '501', name: 'Table 501', floor: 5, seats: 2, is_occupied: false, seated_at: null },
  { id: '502', name: 'Table 502', floor: 5, seats: 4, is_occupied: false, seated_at: null },
  { id: '503', name: 'Table 503', floor: 5, seats: 4, is_occupied: false, seated_at: null },
  { id: '504', name: 'Table 504', floor: 5, seats: 6, is_occupied: false, seated_at: null },
  { id: '505', name: 'Table 505', floor: 5, seats: 8, is_occupied: false, seated_at: null },
];
