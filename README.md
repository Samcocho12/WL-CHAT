# 💬 LUX Chat

Chat en tiempo real con **WebSockets**, servidor en **Node.js** y base de datos en **Supabase** (PostgreSQL) que guarda el **registro de usuarios** y los **mensajes**.

## Estructura

```
lux-chat/
├── server.js        # Servidor HTTP + WebSocket (ws) — registro, login, mensajes, usuarios en línea
├── db.js            # Conexión a Supabase (o data.json si no hay credenciales)
├── supabase.sql     # Tablas usuarios y mensajes
├── .env.example     # Variables de entorno
├── vercel.json      # Para publicar la interfaz en Vercel
└── public/          # Interfaz HTML + CSS + JS
    ├── index.html
    ├── style.css
    ├── app.js
    └── config.js    # URL del servidor WebSocket (para Vercel)
```

## Protocolo de mensajes (JSON por WebSocket)

| Cliente → Servidor | Servidor → Cliente |
|---|---|
| `{tipo:'registro', username, password}` | `{tipo:'auth_ok', usuario, historial}` |
| `{tipo:'login', username, password}` | `{tipo:'mensaje', mensaje}` |
| `{tipo:'mensaje', contenido}` | `{tipo:'en_linea', usuarios}` |
| `{tipo:'escribiendo', activo}` | `{tipo:'sistema', texto}` / `{tipo:'error', texto}` |

Las contraseñas se guardan cifradas con **bcrypt**.

---

## 1. Crear la base de datos en Supabase

1. Crea un proyecto en https://supabase.com
2. Ve a **SQL Editor → New query**, pega el contenido de `supabase.sql` y dale **Run**.
3. En **Project Settings → API** copia la **Project URL** y la **service_role key**.

## 2. Correr el servidor en tu red WiFi (por IP)

```bash
npm install
cp .env.example .env      # en Windows: copy .env.example .env
# edita .env con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
npm start
```

La consola mostrará algo así:

```
💬  LUX Chat en marcha
🗄️   Base de datos: Supabase
🖥️   Este equipo:   http://localhost:3000
📶  Red WiFi:      http://192.168.1.15:3000
```

Desde cualquier celular o PC **conectado al mismo WiFi**, abre `http://192.168.1.15:3000` (la IP que te salga).

> **Windows:** la primera vez, el Firewall pregunta si permitir Node.js → marca **Redes privadas** y acepta.
> Si no aparece, permite el puerto 3000 en *Firewall de Windows → Reglas de entrada*.

Sin Supabase configurado, el servidor funciona igual guardando todo en `data.json` (útil para probar).

## 3. Publicar en internet (Vercel + servidor Node)

⚠️ **Vercel no mantiene servidores WebSocket abiertos** (sus funciones son serverless y se apagan). Por eso:

- **Interfaz (carpeta `public/`) → Vercel**
- **Servidor `server.js` → Render.com** (gratis, sí soporta WebSockets) o Railway

### a) Servidor en Render
1. Sube el proyecto a GitHub.
2. En Render: **New → Web Service** → conecta el repo.
3. Build command: `npm install` · Start command: `npm start`
4. En **Environment** agrega `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
5. Te dará una URL tipo `https://wl-chat.onrender.com` (el chat ya funciona completo ahí también).

### b) Interfaz en Vercel
1. En `public/config.js` pon: `window.LUX_SERVER = 'wss://wl-chat.onrender.com';`
2. En Vercel: **Add New → Project** → importa el repo (el `vercel.json` ya sirve la carpeta `public`).
3. Deploy. Listo 🎉
