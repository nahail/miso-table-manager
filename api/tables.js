import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseInstance = null;
function getClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseInstance;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const supabase = getClient();

  try {
    // 1. GET: Fetch all tables
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('floor', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json(data);
    }

    // 2. PATCH: Toggle or update a table
    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id, name, floor, is_occupied, seated_at, seats } = body;

      const updatePayload = {};
      if (typeof is_occupied !== 'undefined') updatePayload.is_occupied = is_occupied;
      if (typeof seated_at !== 'undefined') updatePayload.seated_at = is_occupied ? (seated_at || new Date().toISOString()) : null;
      if (typeof seats !== 'undefined') updatePayload.seats = seats;
      if (typeof name !== 'undefined' && name) updatePayload.name = name;
      if (typeof floor !== 'undefined' && floor) updatePayload.floor = floor;

      let query = supabase.from('tables').update(updatePayload);

      if (id && String(id).includes('-')) {
        query = query.eq('id', id);
      } else if (name && floor) {
        query = query.eq('name', name).eq('floor', floor);
      } else if (id) {
        query = query.eq('id', id);
      }

      const { data, error } = await query.select();
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json(data);
    }

    // 3. POST: Add a new table
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { data, error } = await supabase.from('tables').insert([body]).select();
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json(data);
    }

    // 4. DELETE: Delete a table
    if (req.method === 'DELETE') {
      const { id, name, floor } = req.query;
      let query = supabase.from('tables').delete();

      if (id && String(id).includes('-')) {
        query = query.eq('id', id);
      } else if (name && floor) {
        query = query.eq('name', name).eq('floor', floor);
      } else if (id) {
        query = query.eq('id', id);
      }

      const { error } = await query;
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
