// WL Chat - Servidor Node.js + WebSockets
require('dotenv').config();
const http = require('http');
const os = require('os');
const path = require('path');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const bcrypt = require('bcryptjs');
const db = require('./db');

const PORT = process.env.PORT || 3000;
const COLORES = ['#7c5cff', '#22d3ee', '#f472b6', '#facc15', '#34d399', '#fb923c', '#60a5fa', '#c084fc'];

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, app: 'WL Chat', db: db.modo }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// socket -> { id, username, color }
const conectados = new Map();

function enviar(ws, tipo, datos = {}) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ tipo, ...datos }));
}
function difundir(tipo, datos = {}) {
  for (const ws of conectados.keys()) enviar(ws, tipo, datos);
}
function listaEnLinea() {
  const vistos = new Map();
  for (const u of conectados.values()) vistos.set(u.id, { username: u.username, color: u.color });
  return [...vistos.values()];
}
function validarNombre(n) { return /^[a-zA-Z0-9_.áéíóúñÁÉÍÓÚÑ-]{3,20}$/.test(n); }

async function autenticar(ws, usuario) {
  conectados.set(ws, { id: usuario.id, username: usuario.username, color: usuario.color });
  await db.marcarConexion(usuario.id);
  const historial = await db.ultimosMensajes(50);
  enviar(ws, 'auth_ok', {
    usuario: { id: usuario.id, username: usuario.username, color: usuario.color },
    historial,
  });
  difundir('sistema', { texto: `${usuario.username} se unió al chat`, fecha: new Date().toISOString() });
  difundir('en_linea', { usuarios: listaEnLinea() });
}

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`🔌 Conexión nueva desde ${ip}`);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return enviar(ws, 'error', { texto: 'Mensaje inválido' }); }

    try {
      switch (msg.tipo) {
        case 'registro': {
          const username = String(msg.username || '').trim();
          const password = String(msg.password || '');
          if (!validarNombre(username)) return enviar(ws, 'error', { texto: 'El usuario debe tener 3-20 caracteres (letras, números, _ . -)' });
          if (password.length < 4) return enviar(ws, 'error', { texto: 'La contraseña debe tener al menos 4 caracteres' });
          if (await db.buscarUsuario(username)) return enviar(ws, 'error', { texto: 'Ese usuario ya existe' });
          const color = COLORES[(await db.totalUsuarios()) % COLORES.length];
          const password_hash = await bcrypt.hash(password, 10);
          const usuario = await db.crearUsuario({ username, password_hash, color });
          console.log(`🆕 Usuario registrado: ${username}`);
          return autenticar(ws, usuario);
        }

        case 'login': {
          const usuario = await db.buscarUsuario(String(msg.username || '').trim());
          if (!usuario || !(await bcrypt.compare(String(msg.password || ''), usuario.password_hash))) {
            return enviar(ws, 'error', { texto: 'Usuario o contraseña incorrectos' });
          }
          return autenticar(ws, usuario);
        }

        case 'mensaje': {
          const yo = conectados.get(ws);
          if (!yo) return enviar(ws, 'error', { texto: 'Primero inicia sesión' });
          const contenido = String(msg.contenido || '').trim().slice(0, 1000);
          if (!contenido) return;
          const guardado = await db.guardarMensaje({ usuario_id: yo.id, username: yo.username, contenido });
          return difundir('mensaje', { mensaje: { ...guardado, color: yo.color } });
        }

        case 'escribiendo': {
          const yo = conectados.get(ws);
          if (!yo) return;
          for (const otro of conectados.keys()) {
            if (otro !== ws) enviar(otro, 'escribiendo', { username: yo.username, activo: !!msg.activo });
          }
          return;
        }

        default:
          enviar(ws, 'error', { texto: 'Tipo de mensaje desconocido' });
      }
    } catch (err) {
      console.error('❌ Error:', err.message);
      enviar(ws, 'error', { texto: 'Error del servidor, intenta de nuevo' });
    }
  });

  ws.on('close', () => {
    const yo = conectados.get(ws);
    conectados.delete(ws);
    if (yo) {
      difundir('sistema', { texto: `${yo.username} salió del chat`, fecha: new Date().toISOString() });
      difundir('en_linea', { usuarios: listaEnLinea() });
    }
  });
});

// Mantener conexiones vivas y limpiar las caídas
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

function ipsLocales() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal)
    .map(i => i.address);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n💬  WL Chat en marcha');
  console.log(`🗄️   Base de datos: ${db.modo}`);
  console.log(`🖥️   Este equipo:   http://localhost:${PORT}`);
  for (const ip of ipsLocales()) console.log(`📶  Red WiFi:      http://${ip}:${PORT}`);
  console.log('\nComparte la dirección de "Red WiFi" con los demás dispositivos conectados a la misma red.\n');
});
