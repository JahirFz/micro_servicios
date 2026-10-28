import { solicitarAPI } from "../api.js";
import { obtenerSesion, cerrarSesion } from "../sesion.js";
import { conectarCuenta } from "../cuenta.js";

const lista = document.getElementById("lista-pedidos");
const estado = document.getElementById("estado-historial");
const cargar = document.getElementById("cargar-pedidos");
const vistaVacia = document.getElementById("historial-vacio");

const moneda = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
});

const fecha = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
});

const etiquetas = {
    PENDING: "Pendiente",
    CONFIRMED: "Confirmado",
    CANCELLED: "Cancelado"
};

let cursor = null;
let primeraPagina = true;
let cargando = false;
let terminado = false;

function irAlAcceso() {
    window.location.replace("/acceso.html?volver=historial");
}

function crearTarjeta(pedido) {
    if (
        !Number.isInteger(pedido.id_pedido) ||
        pedido.id_pedido < 1 ||
        !Object.hasOwn(etiquetas, pedido.estado) ||
        pedido.moneda !== "MXN" ||
        (
            pedido.total !== null &&
            (
                typeof pedido.total !== "string" ||
                !/^\d{1,10}\.\d{2}$/.test(pedido.total)
            )
        )
    ) {
        throw new Error("La información de un pedido no es válida.");
    }

    const item = document.createElement("li");
    item.className = "pedido-historial";

    const cabecera = document.createElement("div");
    cabecera.className = "pedido-historial__cabecera";

    const titulo = document.createElement("h2");
    titulo.textContent = `Pedido #${pedido.id_pedido}`;

    const etiqueta = document.createElement("p");
    etiqueta.className = "pedido-historial__estado";
    etiqueta.textContent = etiquetas[pedido.estado];

    const momento = new Date(pedido.fecha_creacion);

    if (Number.isNaN(momento.getTime())) {
        throw new Error("La fecha del pedido no es válida.");
    }

    const fechaPedido = document.createElement("time");
    fechaPedido.className = "texto-secundario texto-pequeno";
    fechaPedido.dateTime = momento.toISOString();
    fechaPedido.textContent = fecha.format(momento);

    const total = document.createElement("p");
    total.textContent = pedido.total === null
        ? "Total por confirmar"
        : `${moneda.format(Number(pedido.total))} MXN`;

    const enlace = document.createElement("a");
    enlace.className = "boton boton--secundario";
    enlace.href = `/pedido.html?id=${pedido.id_pedido}`;
    enlace.textContent = "Ver detalle";
    enlace.setAttribute(
        "aria-label",
        `Ver detalle del pedido ${pedido.id_pedido}`
    );

    cabecera.append(titulo, etiqueta);
    item.append(cabecera, fechaPedido, total, enlace);

    return item;
}

async function cargarPagina() {
    if (cargando || terminado) return;

    const sesion = obtenerSesion();

    if (!sesion) {
        irAlAcceso();
        return;
    }

    cargando = true;
    cargar.disabled = true;
    cargar.setAttribute("aria-busy", "true");
    lista.setAttribute("aria-busy", "true");
    estado.textContent = "Consultando tus pedidos…";

    try {
        const parametros = new URLSearchParams({ limite: "10" });

        if (!primeraPagina) {
            parametros.set("antes_de", String(cursor));
        }

        const datos = await solicitarAPI(
            `/pedidos?${parametros.toString()}`,
            { token: sesion.token }
        );

        if (
            !Array.isArray(datos.pedidos) ||
            (
                datos.siguiente_antes_de !== null &&
                (
                    !Number.isInteger(datos.siguiente_antes_de) ||
                    datos.siguiente_antes_de < 1
                )
            )
        ) {
            throw new Error("El historial recibido no es válido.");
        }

        const fragmento = document.createDocumentFragment();

        for (const pedido of datos.pedidos) {
            fragmento.append(crearTarjeta(pedido));
        }

        lista.append(fragmento);

        cursor = datos.siguiente_antes_de;
        primeraPagina = false;
        terminado = cursor === null;

        cargar.hidden = terminado;
        cargar.textContent = "Cargar más pedidos";

        const cantidad = lista.children.length;

        vistaVacia.hidden = cantidad > 0;
        estado.textContent = cantidad === 0
            ? "Todavía no tienes pedidos. Tu próxima compra empieza aquí."
            : `${cantidad} pedidos mostrados.`;

        // El botón desaparece al llegar a la última página.
        if (terminado && document.activeElement === cargar) {
            const enlaces = lista.querySelectorAll("a");
            enlaces[enlaces.length - 1]?.focus();
        }
    } catch (error) {
        if (error.status === 401) {
            cerrarSesion();
            irAlAcceso();
            return;
        }

        estado.textContent = error.message;
        cargar.hidden = false;
        cargar.textContent = "Reintentar";
    } finally {
        cargando = false;
        cargar.disabled = false;
        cargar.removeAttribute("aria-busy");
        lista.removeAttribute("aria-busy");
    }
}

cargar.addEventListener("click", cargarPagina);

conectarCuenta();
cargarPagina();