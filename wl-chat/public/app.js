// WL Chat - Cliente WebSocket
const $ = (s) => document.querySelector(s);

// URL del servidor: config.js o el mismo host desde donde se sirve la página
function urlServidor() {
  if (window.WL_SERVER) return window.WL_SERVER;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}`;
}

let ws = null;
let yo = null;
let modo = 'login';
let credenciales = null;      // para reconectar automáticamente
let reintentos = 0;
let ultimoAutor = null;
let timerEscribiendo = null;
const escribiendo = new Set();

// ---------- Conexión ----------
function conectar() {
  ws = new WebSocket(urlServidor());

  ws.onopen = () => {
    reintentos = 0;
    estado(true);
    if (credenciales) ws.send(JSON.stringify({ tipo: 'login', ...credenciales }));
  };

  ws.onmessage = (e) => {
    const d = JSON.parse(e.data);
    switch (d.tipo) {
      case 'auth_ok': entrar(d); break;
      case 'mensaje': pintarMensaje(d.mensaje); break;
      case 'sistema': pintarSistema(d.texto); break;
      case 'en_linea': pintarUsuarios(d.usuarios); break;
      case 'escribiendo': marcarEscribiendo(d.username, d.activo); break;
      case 'error': mostrarError(d.texto); break;
    }
  };

  ws.onclose = () => {
    estado(false);
    const espera = Math.min(1000 * 2 ** reintentos++, 10000);
    setTimeout(conectar, espera);
  };
  ws.onerror = () => ws.close();
}

function estado(ok) {
  for (const [p, t] of [['#punto-auth', '#txt-auth'], ['#punto-chat', '#txt-chat']]) {
    $(p).className = 'punto ' + (ok ? 'ok' : 'mal');
    $(t).textContent = ok ? 'Conectado' : 'Reconectando…';
  }
  $('#btn-auth').disabled = !ok;
}

// ---------- Autenticación ----------
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.remove('activo'));
  b.classList.add('activo');
  modo = b.dataset.modo;
  $('#btn-auth').textContent = modo === 'login' ? 'Entrar' : 'Crear cuenta';
  $('#auth-error').textContent = '';
}));

$('#form-auth').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!ws || ws.readyState !== WebSocket.OPEN) return mostrarError('Sin conexión con el servidor');
  const username = $('#in-user').value.trim();
  const password = $('#in-pass').value;
  credenciales = { username, password };
  $('#auth-error').textContent = '';
  ws.send(JSON.stringify({ tipo: modo, username, password }));
});

function entrar({ usuario, historial }) {
  const yaDentro = !!yo;
  yo = usuario;
  $('#pantalla-auth').classList.add('oculto');
  $('#pantalla-chat').classList.remove('oculto');
  $('#mi-nombre').textContent = yo.username;
  pintarAvatar($('#mi-avatar'), yo.username, yo.color);
  $('#servidor-info').textContent = urlServidor().replace(/^wss?:\/\//, '');
  if (!yaDentro || historial) {
    $('#mensajes').innerHTML = '';
    ultimoAutor = null;
    historial.forEach(pintarMensaje);
  }
  $('#in-msg').focus();
}

function mostrarError(texto) {
  if (!yo) { $('#auth-error').textContent = texto; credenciales = null; }
  else pintarSistema('⚠️ ' + texto);
}

$('#btn-salir').addEventListener('click', () => {
  credenciales = null; yo = null;
  ws.close();
  $('#pantalla-chat').classList.add('oculto');
  $('#pantalla-auth').classList.remove('oculto');
  $('#in-pass').value = '';
});

// ---------- Mensajes ----------
$('#form-msg').addEventListener('submit', (e) => {
  e.preventDefault();
  const contenido = $('#in-msg').value.trim();
  if (!contenido || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ tipo: 'mensaje', contenido }));
  ws.send(JSON.stringify({ tipo: 'escribiendo', activo: false }));
  $('#in-msg').value = '';
});

$('#in-msg').addEventListener('input', () => {
  if (ws.readyState !== WebSocket.OPEN) return;
  if (!timerEscribiendo) ws.send(JSON.stringify({ tipo: 'escribiendo', activo: true }));
  clearTimeout(timerEscribiendo);
  timerEscribiendo = setTimeout(() => {
    ws.send(JSON.stringify({ tipo: 'escribiendo', activo: false }));
    timerEscribiendo = null;
  }, 1500);
});

function hora(iso) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function pintarAvatar(el, nombre, color) {
  el.textContent = nombre[0].toUpperCase();
  el.style.background = color || '#7c5cff';
}

function pintarMensaje(m) {
  const cont = $('#mensajes');
  const abajo = cont.scrollHeight - cont.scrollTop - cont.clientHeight < 80;
  const div = document.createElement('div');
  div.className = 'msg' + (yo && m.usuario_id === yo.id ? ' mio' : '') + (ultimoAutor === m.usuario_id ? ' seguido' : '');
  const av = document.createElement('div');
  av.className = 'avatar';
  pintarAvatar(av, m.username, m.color);

  const b = document.createElement('div');
  b.className = 'burbuja';
  const meta = document.createElement('div');
  meta.className = 'meta';
  const n = document.createElement('strong');
  n.textContent = m.username;
  n.style.color = yo && m.usuario_id === yo.id ? '#fff' : m.color;
  const t = document.createElement('time');
  t.textContent = hora(m.creado_en);
  meta.append(n, t);
  const p = document.createElement('p');
  p.textContent = m.contenido;      // textContent evita inyección de HTML
  b.append(meta, p);

  div.append(av, b);
  cont.append(div);
  ultimoAutor = m.usuario_id;
  marcarEscribiendo(m.username, false);
  if (abajo || (yo && m.usuario_id === yo.id)) cont.scrollTop = cont.scrollHeight;
}

function pintarSistema(texto) {
  const d = document.createElement('div');
  d.className = 'sistema';
  d.textContent = texto;
  $('#mensajes').append(d);
  ultimoAutor = null;
  $('#mensajes').scrollTop = $('#mensajes').scrollHeight;
}

function pintarUsuarios(lista) {
  $('#contador').textContent = lista.length;
  const ul = $('#lista-usuarios');
  ul.innerHTML = '';
  lista.forEach((u) => {
    const li = document.createElement('li');
    const av = document.createElement('div');
    av.className = 'avatar';
    pintarAvatar(av, u.username, u.color);
    const s = document.createElement('span');
    s.textContent = u.username + (yo && u.username === yo.username ? ' (tú)' : '');
    li.append(av, s);
    ul.append(li);
  });
}

function marcarEscribiendo(nombre, activo) {
  activo ? escribiendo.add(nombre) : escribiendo.delete(nombre);
  const l = [...escribiendo];
  $('#escribiendo').textContent =
    l.length === 0 ? '' : l.length === 1 ? `${l[0]} está escribiendo…` : `${l.join(', ')} están escribiendo…`;
}

// Menú lateral en móvil
$('#btn-menu').addEventListener('click', () => $('#lateral').classList.toggle('abierto'));
$('#mensajes').addEventListener('click', () => $('#lateral').classList.remove('abierto'));

conectar();
