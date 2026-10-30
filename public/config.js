// URL del servidor de WebSockets
// Si la pagina esta en Vercel se conecta al servidor de Render,
// si no, se conecta al mismo servidor desde donde se abrio (Render o la IP local)
if (location.hostname.endsWith(".vercel.app")) {
  window.LUX_SERVER = "wss://wl-chat.onrender.com";
} else {
  window.LUX_SERVER = "";
}
