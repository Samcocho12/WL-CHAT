// Capa de datos: Supabase si hay credenciales, si no, archivo local data.json
const fs = require('fs');
const path = require('path');

const usarSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
let supabase = null;

if (usarSupabase) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ---------- Modo local (data.json) ----------
const ARCHIVO = path.join(__dirname, 'data.json');
function leerLocal() {
  try { return JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')); }
  catch { return { usuarios: [], mensajes: [], seq: { u: 0, m: 0 } }; }
}
function guardarLocal(d) { fs.writeFileSync(ARCHIVO, JSON.stringify(d, null, 2)); }

// ---------- API ----------
async function buscarUsuario(username) {
  if (usarSupabase) {
    const { data, error } = await supabase
      .from('usuarios').select('*').ilike('username', username).maybeSingle();
    if (error) throw error;
    return data;
  }
  const d = leerLocal();
  return d.usuarios.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
}

async function crearUsuario({ username, password_hash, color }) {
  if (usarSupabase) {
    const { data, error } = await supabase
      .from('usuarios').insert({ username, password_hash, color }).select().single();
    if (error) throw error;
    return data;
  }
  const d = leerLocal();
  const u = { id: ++d.seq.u, username, password_hash, color, creado_en: new Date().toISOString(), ultima_conexion: null };
  d.usuarios.push(u);
  guardarLocal(d);
  return u;
}

async function marcarConexion(id) {
  const ahora = new Date().toISOString();
  if (usarSupabase) {
    await supabase.from('usuarios').update({ ultima_conexion: ahora }).eq('id', id);
    return;
  }
  const d = leerLocal();
  const u = d.usuarios.find(x => x.id === id);
  if (u) { u.ultima_conexion = ahora; guardarLocal(d); }
}

async function guardarMensaje({ usuario_id, username, contenido }) {
  if (usarSupabase) {
    const { data, error } = await supabase
      .from('mensajes').insert({ usuario_id, username, contenido }).select().single();
    if (error) throw error;
    return data;
  }
  const d = leerLocal();
  const m = { id: ++d.seq.m, usuario_id, username, contenido, creado_en: new Date().toISOString() };
  d.mensajes.push(m);
  guardarLocal(d);
  return m;
}

async function ultimosMensajes(limite = 50) {
  let lista;
  if (usarSupabase) {
    const { data, error } = await supabase
      .from('mensajes')
      .select('id, usuario_id, username, contenido, creado_en, usuarios(color)')
      .order('creado_en', { ascending: false })
      .limit(limite);
    if (error) throw error;
    lista = data.map(m => ({ ...m, color: m.usuarios?.color, usuarios: undefined }));
  } else {
    const d = leerLocal();
    lista = d.mensajes.slice(-limite).reverse().map(m => ({
      ...m, color: d.usuarios.find(u => u.id === m.usuario_id)?.color,
    }));
  }
  return lista.reverse();
}

async function totalUsuarios() {
  if (usarSupabase) {
    const { count } = await supabase.from('usuarios').select('*', { count: 'exact', head: true });
    return count || 0;
  }
  return leerLocal().usuarios.length;
}

module.exports = {
  modo: usarSupabase ? 'Supabase' : 'Local (data.json)',
  buscarUsuario, crearUsuario, marcarConexion, guardarMensaje, ultimosMensajes, totalUsuarios,
};
