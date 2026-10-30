// ===== LUX Chat - Cliente =====

// Si config.js tiene una URL la usamos, si no, nos conectamos al mismo servidor
let url = window.LUX_SERVER;
if (!url) {
  if (location.protocol === "https:") {
    url = "wss://" + location.host;
  } else {
    url = "ws://" + location.host;
  }
}

let socket;
let miUsuario = null;
let datosLogin = null; // para volver a entrar si se cae la conexion
let tiempoEscribiendo;

function conectar() {
  socket = new WebSocket(url);

  socket.onopen = function () {
    document.getElementById("estado").textContent = "Conectado al servidor";
    // si ya habia iniciado sesion, vuelve a entrar automaticamente
    if (datosLogin) {
      socket.send(JSON.stringify({ tipo: "login", username: datosLogin.username, password: datosLogin.password }));
    }
  };

  socket.onclose = function () {
    document.getElementById("estado").textContent = "Sin conexión, reintentando...";
    setTimeout(conectar, 3000);
  };

  socket.onmessage = function (evento) {
    const datos = JSON.parse(evento.data);

    if (datos.tipo === "auth_ok") {
      entrarAlChat(datos.usuario, datos.historial);
    } else if (datos.tipo === "mensaje") {
      mostrarMensaje(datos.mensaje);
    } else if (datos.tipo === "sistema") {
      mostrarAviso(datos.texto);
    } else if (datos.tipo === "en_linea") {
      mostrarUsuarios(datos.usuarios);
    } else if (datos.tipo === "escribiendo") {
      mostrarEscribiendo(datos.username, datos.activo);
    } else if (datos.tipo === "error") {
      if (miUsuario) {
        mostrarAviso("Error: " + datos.texto);
      } else {
        document.getElementById("error").textContent = datos.texto;
        datosLogin = null;
      }
    }
  };
}

// ----- Login y registro -----
function enviarLogin(tipo) {
  const username = document.getElementById("usuario").value.trim();
  const password = document.getElementById("clave").value;

  if (username === "" || password === "") {
    document.getElementById("error").textContent = "Completa todos los campos";
    return;
  }

  document.getElementById("error").textContent = "";
  datosLogin = { username: username, password: password };
  socket.send(JSON.stringify({ tipo: tipo, username: username, password: password }));
}

document.getElementById("btnEntrar").onclick = function () {
  enviarLogin("login");
};

document.getElementById("btnRegistrar").onclick = function () {
  enviarLogin("registro");
};

document.getElementById("clave").addEventListener("keydown", function (e) {
  if (e.key === "Enter") enviarLogin("login");
});

function entrarAlChat(usuario, historial) {
  miUsuario = usuario;
  document.getElementById("login").classList.add("oculto");
  document.getElementById("chat").classList.remove("oculto");
  document.getElementById("nombreUsuario").textContent = "Hola, " + usuario.username;

  // mostrar los mensajes guardados en la base de datos
  document.getElementById("mensajes").innerHTML = "";
  for (let i = 0; i < historial.length; i++) {
    mostrarMensaje(historial[i]);
  }
}

document.getElementById("btnSalir").onclick = function () {
  miUsuario = null;
  datosLogin = null;
  socket.close();
  document.getElementById("chat").classList.add("oculto");
  document.getElementById("login").classList.remove("oculto");
  document.getElementById("clave").value = "";
};

// ----- Mensajes -----
function enviarMensaje() {
  const input = document.getElementById("texto");
  const texto = input.value.trim();
  if (texto === "") return;

  socket.send(JSON.stringify({ tipo: "mensaje", contenido: texto }));
  socket.send(JSON.stringify({ tipo: "escribiendo", activo: false }));
  input.value = "";
}

document.getElementById("btnEnviar").onclick = enviarMensaje;

document.getElementById("texto").addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    enviarMensaje();
  } else {
    // avisar que estoy escribiendo
    socket.send(JSON.stringify({ tipo: "escribiendo", activo: true }));
    clearTimeout(tiempoEscribiendo);
    tiempoEscribiendo = setTimeout(function () {
      socket.send(JSON.stringify({ tipo: "escribiendo", activo: false }));
    }, 2000);
  }
});

// evita que alguien meta codigo HTML en los mensajes
function limpiar(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

function mostrarMensaje(msg) {
  const contenedor = document.getElementById("mensajes");
  const hora = new Date(msg.creado_en).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

  let clase = "mensaje";
  if (miUsuario && msg.usuario_id === miUsuario.id) {
    clase = "mensaje mio";
  }

  contenedor.innerHTML +=
    '<div class="' + clase + '">' +
      '<span class="autor">' + limpiar(msg.username) + '</span>' +
      '<span class="hora">' + hora + '</span>' +
      '<div class="contenido-msg">' + limpiar(msg.contenido) + '</div>' +
    '</div>';

  contenedor.scrollTop = contenedor.scrollHeight;
  mostrarEscribiendo(msg.username, false);
}

function mostrarAviso(texto) {
  const contenedor = document.getElementById("mensajes");
  contenedor.innerHTML += '<p class="aviso">' + limpiar(texto) + '</p>';
  contenedor.scrollTop = contenedor.scrollHeight;
}

function mostrarUsuarios(lista) {
  document.getElementById("cantidad").textContent = lista.length;
  let html = "";
  for (let i = 0; i < lista.length; i++) {
    html += "<li>" + limpiar(lista[i].username) + "</li>";
  }
  document.getElementById("listaUsuarios").innerHTML = html;
}

function mostrarEscribiendo(nombre, activo) {
  const p = document.getElementById("escribiendo");
  if (activo) {
    p.textContent = nombre + " está escribiendo...";
  } else if (p.textContent.startsWith(nombre + " ")) {
    p.textContent = "";
  }
}

conectar();
