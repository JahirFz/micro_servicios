import {
    obtenerSesion,
    cerrarSesion
} from "./sesion.js";

export function conectarCuenta() {
    const botonSalir = document.getElementById("cerrar-sesion");
    const saludo = document.getElementById("saludo");
    const enlaceAcceso = document.querySelector(
        'a[href="/acceso.html"]'
    );

    const sesion = obtenerSesion();

    const enlaceAdmin = document.getElementById("enlace-admin");

    if (enlaceAdmin) {
        enlaceAdmin.hidden = sesion?.usuario?.rol !== "ADMIN";
    }

    if (saludo) {
        saludo.hidden = !sesion;
        saludo.textContent = sesion
            ? `Hola, ${sesion.usuario.nombre}`
            : "";
    }

    if (enlaceAcceso) {
        enlaceAcceso.hidden = Boolean(sesion);
    }

    if (!botonSalir) return;

    botonSalir.hidden = !sesion;

    botonSalir.addEventListener("click", () => {
        cerrarSesion();
        window.location.replace("/acceso.html");
    });
}