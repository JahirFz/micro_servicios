import { solicitarAPI } from "../api.js";
import { guardarSesion } from "../sesion.js";

const formulario = document.getElementById("formulario-acceso");
const correo = document.getElementById("correo");
const password = document.getElementById("password");
const mostrar = document.getElementById("mostrar-password");
const boton = document.getElementById("iniciar-sesion");
const errorGeneral = document.getElementById("error-acceso");
const estado = document.getElementById("estado-acceso");

let enviando = false;

mostrar.addEventListener("click", () => {
    const visible = password.type === "password";

    password.type = visible ? "text" : "password";
    mostrar.setAttribute("aria-pressed", String(visible));
    mostrar.setAttribute(
        "aria-label",
        visible ? "Ocultar contraseña" : "Mostrar contraseña"
    );
});

function validarCampo(input, idError, texto) {
    const error = document.getElementById(idError);
    const valido = input.validity.valid;

    input.setAttribute("aria-invalid", String(!valido));
    error.hidden = valido;
    error.textContent = valido ? "" : texto;

    return valido;
}

formulario.noValidate = true;

formulario.addEventListener("submit", async evento => {
    evento.preventDefault();

    if (enviando) return;

    correo.value = correo.value.trim();
    errorGeneral.hidden = true;
    errorGeneral.textContent = "";

    const correoValido = validarCampo(
        correo,
        "error-correo",
        "Error: escribe un correo electrónico válido."
    );

    const passwordValido = validarCampo(
        password,
        "error-password",
        "Error: ingresa tu contraseña."
    );

    if (!correoValido || !passwordValido) {
        estado.textContent = "Revisa los campos indicados.";
        (!correoValido ? correo : password).focus();
        return;
    }

    enviando = true;
    boton.disabled = true;
    boton.textContent = "Iniciando sesión…";
    boton.setAttribute("aria-busy", "true");
    formulario.setAttribute("aria-busy", "true");
    estado.textContent = "Validando tus datos. Espera un momento.";

    try {
        const datos = await solicitarAPI("/auth/login", {
            metodo: "POST",
            cuerpo: {
                correo: correo.value,
                password: password.value
            }
        });

        password.value = "";
        guardarSesion(datos);

        const parametros = new URLSearchParams(window.location.search);
        const destino = parametros.get("volver");
        const idTexto = parametros.get("id") || "";
        const id = Number(idTexto);

        let direccion = "/";
        if (destino === "checkout") {
            direccion = "/checkout.html";
        } else if (destino === "historial") {
            direccion = "/mis-pedidos.html";
        } else if (destino === "admin") {
            direccion = "/admin.html";
        } else if (
            destino === "pedido" &&
            /^[1-9]\d*$/.test(idTexto) &&
            Number.isSafeInteger(id) &&
            id <= 2147483647
        ) {
            direccion = `/pedido.html?id=${id}`;
        } else if (
            destino === "admin-pedido" &&
            /^[1-9]\d*$/.test(idTexto) &&
            Number.isSafeInteger(id) &&
            id <= 2147483647
        ) {
            direccion = `/admin-pedido.html?id=${id}`;
        }

        window.location.assign(direccion);
    } catch (error) {
        errorGeneral.textContent = error.message;
        errorGeneral.hidden = false;
        estado.textContent = "";
    } finally {
        enviando = false;
        boton.disabled = false;
        boton.textContent = "Iniciar sesión";
        boton.removeAttribute("aria-busy");
        formulario.removeAttribute("aria-busy");
    }
});