import { solicitarAPI } from "../api.js";
import { obtenerSesion, cerrarSesion } from "../sesion.js";

const parametros = new URLSearchParams(window.location.search);
const idTexto = parametros.get("id") || "";
const idPedido = Number(idTexto);

const mensaje = document.getElementById("mensaje-consulta");
const reintentar = document.getElementById("reintentar-pedido");
const contenido = document.getElementById("contenido-pedido");
const productos = document.getElementById("productos-pedido");

const formatoMoneda = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
});

const formatoFecha = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
});

let temporizador;
let consultando = false;
let detenido = false;
let ultimoEstado = null;

function irAlAcceso() {
    window.location.replace(
        `/acceso.html?volver=pedido&id=${idPedido}`
    );
}

function descripcionCancelacion(motivo) {
    if (motivo === "BANCO_TIMEOUT") {
        return "El pago tardó demasiado y la operación se cerró sin cargo.";
    }

    if (motivo === "BANCO_RECHAZADO") {
        return "El banco simulado rechazó el pago.";
    }

    if (
        typeof motivo === "string" &&
        motivo.startsWith("STOCK_INSUFICIENTE")
    ) {
        return "No había existencias suficientes para completar tu compra.";
    }

    return "No se pudo completar la operación. Puedes iniciar una nueva compra.";
}

function mostrarPedido(pedido) {
    const estados = {
        PENDING: {
            etiqueta: "Pendiente",
            titulo: "Estamos procesando tu pedido",
            descripcion:
                "Validamos las existencias y el pago. " +
                "El estado se actualizará automáticamente."
        },
        CONFIRMED: {
            etiqueta: "Confirmado",
            titulo: "Tu compra fue confirmada",
            descripcion:
                "El pago simulado fue aprobado y los productos " +
                "quedaron asignados a tu compra."
        },
        CANCELLED: {
            etiqueta: "Cancelado",
            titulo: "No se completó tu compra",
            descripcion: descripcionCancelacion(
                pedido.motivo_cancelacion
            )
        }
    };

    const vista = estados[pedido.estado];

    if (
        !vista ||
        pedido.id_pedido !== idPedido ||
        !Array.isArray(pedido.productos)
    ) {
        throw new Error("La respuesta del pedido no es válida.");
    }

    document.title = `Pedido #${idPedido} | Fertech`;

    document.getElementById("titulo-pedido").textContent =
        `Pedido #${idPedido}`;

    const fecha = new Date(pedido.fecha_creacion);

    document.getElementById("fecha-pedido").textContent =
        `${Number.isNaN(fecha.getTime()) ? "" : formatoFecha.format(fecha)} · ` +
        `${pedido.productos.length} productos`;

    // Actualizar la región anunciada solo cuando cambie el estado.
    if (ultimoEstado !== pedido.estado) {
        document.getElementById("etiqueta-estado").textContent =
            `Estado: ${vista.etiqueta}`;

        document.getElementById("titulo-estado").textContent =
            vista.titulo;

        document.getElementById("descripcion-estado").textContent =
            vista.descripcion;

        ultimoEstado = pedido.estado;
    }

    productos.replaceChildren();

    for (const producto of pedido.productos) {
        const item = document.createElement("li");
        item.className = "pedido__producto";

        const nombre = document.createElement("h3");
        nombre.textContent = producto.nombre_producto ||
            `Producto #${producto.id_producto}`;

        const detalle = document.createElement("p");
        detalle.className = "texto-secundario";

        const precio = producto.precio_unitario === null
            ? "Precio por confirmar"
            : `${formatoMoneda.format(Number(producto.precio_unitario))} MXN por unidad`;

        detalle.textContent =
            `Cantidad: ${producto.cantidad} · ${precio}`;

        item.append(nombre, detalle);
        productos.append(item);
    }

    document.getElementById("total-pedido").textContent =
        pedido.total === null
            ? "Por confirmar"
            : `${formatoMoneda.format(Number(pedido.total))} MXN`;

    document.getElementById("nota-pedido").textContent =
        pedido.estado === "PENDING"
            ? "Puedes volver a consultar este pedido usando su dirección."
            : "Este es un comprobante de prueba. No se realizó ningún cobro real.";

    document.getElementById("accion-pedido").textContent =
        pedido.estado === "CANCELLED"
            ? "Volver al catálogo"
            : "Seguir comprando";

    contenido.hidden = false;
}

async function consultarPedido() {
    if (consultando || detenido) return;

    clearTimeout(temporizador);

    const sesion = obtenerSesion();

    if (!sesion) {
        irAlAcceso();
        return;
    }

    consultando = true;
    reintentar.hidden = true;

    try {
        const pedido = await solicitarAPI(
            `/pedidos/${idPedido}`,
            { token: sesion.token }
        );

        if (detenido) return;

        mostrarPedido(pedido);
        mensaje.textContent = "";

        if (pedido.estado === "PENDING") {
            temporizador = setTimeout(consultarPedido, 2000);
        }
    } catch (error) {
        if (detenido) return;

        if (error.status === 401) {
            cerrarSesion();
            irAlAcceso();
            return;
        }

        mensaje.textContent = error.status === 404
            ? "No encontramos ese pedido en tu cuenta."
            : error.message;

        reintentar.hidden = error.status === 404;
    } finally {
        consultando = false;
    }
}

reintentar.addEventListener("click", consultarPedido);

window.addEventListener("pagehide", () => {
    detenido = true;
    clearTimeout(temporizador);
});

window.addEventListener("pageshow", evento => {
    if (evento.persisted) {
        detenido = false;
        consultarPedido();
    }
});

if (
    !/^[1-9]\d*$/.test(idTexto) ||
    !Number.isSafeInteger(idPedido) ||
    idPedido > 2147483647
) {
    mensaje.textContent = "El identificador del pedido no es válido.";
} else {
    consultarPedido();
}