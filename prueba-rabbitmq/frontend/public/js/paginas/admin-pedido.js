import { solicitarAPI } from "../api.js";
import { obtenerSesion, cerrarSesion } from "../sesion.js";

const textoId = new URLSearchParams(
    window.location.search
).get("id") || "";

const id = Number(textoId);

const mensaje = document.getElementById("estado-consulta");
const detalle = document.getElementById("detalle-admin");
const datosPedido = document.getElementById("datos-pedido");
const lista = document.getElementById("productos-pedido");
const actualizar = document.getElementById("actualizar-pedido");

const moneda = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
});

const fecha = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
});

const estados = {
    PENDING: "Pendiente",
    CONFIRMED: "Confirmado",
    CANCELLED: "Cancelado"
};

let cargando = false;

function irAlAcceso() {
    window.location.replace(
        `/acceso.html?volver=admin-pedido&id=${id}`
    );
}

function agregarDato(nombre, valor) {
    const termino = document.createElement("dt");
    termino.textContent = nombre;

    const descripcion = document.createElement("dd");
    descripcion.textContent = String(valor);

    datosPedido.append(termino, descripcion);
}

function mostrarPedido(pedido) {
    if (
        pedido.id_pedido !== id ||
        !Array.isArray(pedido.productos)
    ) {
        throw new Error("La respuesta del pedido no es válida.");
    }

    document.title = `Administración · Pedido #${id} | Fertech`;
    document.getElementById("titulo-pedido").textContent =
        `Pedido #${id}`;

    datosPedido.replaceChildren();

    const momento = new Date(pedido.fecha_creacion);

    agregarDato("Cliente", `#${pedido.id_usuario}`);
    agregarDato(
        "Fecha",
        Number.isNaN(momento.getTime())
            ? "No disponible"
            : fecha.format(momento)
    );
    agregarDato("Estado", estados[pedido.estado] || pedido.estado);
    agregarDato("Fase del proceso", pedido.fase_saga);

    agregarDato(
        "Motivo de cancelación",
        pedido.motivo_cancelacion || "No aplica"
    );

    // Un indicador falso no significa necesariamente un fallo.
    agregarDato(
        "Inventario liberado",
        pedido.inventario_liberado ? "Sí" : "No registrado"
    );

    agregarDato(
        "Pago resuelto sin cargo",
        pedido.pago_resuelto_sin_cargo ? "Sí" : "No registrado"
    );

    lista.replaceChildren();

    for (const producto of pedido.productos) {
        const item = document.createElement("li");
        item.className = "pedido__producto";

        const titulo = document.createElement("h3");
        titulo.textContent = producto.nombre_producto ||
            `Producto #${producto.id_producto}`;

        const descripcion = document.createElement("p");
        descripcion.className = "texto-secundario";

        const precio = producto.precio_unitario === null
            ? "Precio por confirmar"
            : `${moneda.format(Number(producto.precio_unitario))} MXN por unidad`;

        descripcion.textContent =
            `Producto #${producto.id_producto} · ` +
            `Cantidad: ${producto.cantidad} · ${precio}`;

        item.append(titulo, descripcion);
        lista.append(item);
    }

    document.getElementById("total-pedido").textContent =
        pedido.total === null
            ? "Por confirmar"
            : `${moneda.format(Number(pedido.total))} MXN`;

    detalle.hidden = false;
}

async function cargarPedido() {
    if (cargando) return;

    const sesion = obtenerSesion();

    if (!sesion) {
        irAlAcceso();
        return;
    }

    if (sesion.usuario.rol !== "ADMIN") {
        detalle.hidden = true;
        actualizar.hidden = true;
        mensaje.textContent = "No tienes permisos para acceder.";
        return;
    }

    cargando = true;
    actualizar.disabled = true;
    actualizar.setAttribute("aria-busy", "true");
    mensaje.textContent = "Consultando pedido…";

    try {
        const pedido = await solicitarAPI(
            `/admin/pedidos/${id}`,
            { token: sesion.token }
        );

        mostrarPedido(pedido);
        actualizar.hidden = false;
        actualizar.textContent = "Actualizar pedido";
        mensaje.textContent = "Información actualizada.";
    } catch (error) {
        if (error.status === 401) {
            cerrarSesion();
            irAlAcceso();
            return;
        }

        const sinAcceso =
            error.status === 403 || error.status === 404;

        if (sinAcceso) {
            detalle.hidden = true;
        }

        mensaje.textContent = error.message;
        actualizar.hidden = sinAcceso;
        actualizar.textContent = "Reintentar";
    } finally {
        cargando = false;
        actualizar.disabled = false;
        actualizar.removeAttribute("aria-busy");
    }
}

actualizar.addEventListener("click", cargarPedido);

if (
    !/^[1-9]\d*$/.test(textoId) ||
    !Number.isSafeInteger(id) ||
    id > 2147483647
) {
    mensaje.textContent = "El identificador del pedido no es válido.";
} else {
    cargarPedido();
}