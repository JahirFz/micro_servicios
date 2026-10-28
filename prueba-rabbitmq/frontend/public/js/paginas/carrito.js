import { solicitarAPI } from "../api.js";

import {
    obtenerCarrito,
    cambiarCantidad,
    eliminarProducto,
    vaciarCarrito
} from "../carrito.js";

const lista = document.getElementById("lista-carrito");
const plantilla = document.getElementById("plantilla-linea-carrito");
const titulo = document.getElementById("titulo-carrito");
const estado = document.getElementById("estado-carrito");
const resumen = document.getElementById("resumen-carrito");
const total = document.getElementById("total-carrito");
const vaciar = document.getElementById("vaciar-carrito");
const reintentar = document.getElementById("reintentar-carrito");
const continuar = document.getElementById("continuar-compra");
const vistaVacia = document.getElementById("carrito-vacio");
const ayudaCompra = document.querySelector(
    ".pagina-carrito > p:last-child"
);

const formatoMoneda = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
});

let productosPorId = new Map();
let cargando = false;

function validarProducto(producto) {
    return (
        producto &&
        Number.isInteger(producto.id_producto) &&
        producto.id_producto > 0 &&
        typeof producto.nombre === "string" &&
        typeof producto.precio === "string" &&
        /^\d{1,10}\.\d{2}$/.test(producto.precio) &&
        Number(producto.precio) > 0 &&
        Number.isInteger(producto.stock_disponible) &&
        producto.stock_disponible >= 0 &&
        producto.moneda === "MXN"
    );
}

function dibujarCarrito() {
    const lineas = obtenerCarrito();

    const estaVacio = lineas.length === 0;

    vistaVacia.hidden = !estaVacio;
    lista.hidden = estaVacio;
    continuar.hidden = estaVacio;

    if (ayudaCompra) {
        ayudaCompra.hidden = estaVacio;
    }

    lista.replaceChildren();
    titulo.textContent = lineas.length
        ? `Tu carrito · ${lineas.length} productos`
        : "Tu carrito";

    vaciar.hidden = lineas.length === 0;
    resumen.hidden = lineas.length === 0;

    let totalCentavos = 0n;
    let tieneProblemas = false;

    for (const linea of lineas) {
        const producto = productosPorId.get(linea.id_producto);
        const nombre = producto?.nombre ||
            `Producto #${linea.id_producto}`;

        const fragmento = plantilla.content.cloneNode(true);
        const item = fragmento.querySelector(".linea-carrito");

        item.dataset.id = String(linea.id_producto);

        item.querySelector(
            ".linea-carrito__nombre"
        ).textContent = nombre;

        item.querySelector(
            ".selector-cantidad__valor"
        ).textContent = String(linea.cantidad);

        const precio = item.querySelector(".linea-carrito__precio");
        const stock = item.querySelector(".linea-carrito__stock");
        const aviso = item.querySelector(".linea-carrito__aviso");

        if (producto) {
            precio.textContent =
                `${formatoMoneda.format(Number(producto.precio))} MXN`;

            stock.textContent =
                `${producto.stock_disponible} disponibles`;

            totalCentavos +=
                BigInt(producto.precio.replace(".", "")) *
                BigInt(linea.cantidad);

            if (linea.cantidad > producto.stock_disponible) {
                tieneProblemas = true;
                aviso.hidden = false;
                aviso.textContent =
                    "La cantidad supera las existencias. " +
                    "Reduce las unidades o elimina el producto.";
            }
        } else {
            tieneProblemas = true;
            precio.textContent = "Precio no disponible";
            stock.textContent = "Producto no disponible";
            aviso.hidden = false;
            aviso.textContent =
                "Elimina este producto para continuar.";
        }

        continuar.disabled = lineas.length === 0 || tieneProblemas;

        const menos = item.querySelector(".selector-cantidad__menos");
        const mas = item.querySelector(".selector-cantidad__mas");
        const eliminar = item.querySelector(".linea-carrito__eliminar");

        menos.dataset.accion = "menos";
        mas.dataset.accion = "mas";
        eliminar.dataset.accion = "eliminar";

        menos.disabled = linea.cantidad <= 1;
        mas.disabled =
            !producto ||
            linea.cantidad >= producto.stock_disponible;

        menos.setAttribute(
            "aria-label",
            `Disminuir cantidad de ${nombre}`
        );

        mas.setAttribute(
            "aria-label",
            `Aumentar cantidad de ${nombre}`
        );

        eliminar.setAttribute(
            "aria-label",
            `Eliminar ${nombre} del carrito`
        );

        lista.append(fragmento);
    }

    total.textContent = tieneProblemas
        ? "Revisa los productos"
        : `${formatoMoneda.format(Number(totalCentavos) / 100)} MXN`;

    if (lineas.length === 0) {
        estado.textContent =
            "Tu carrito está vacío. Explora la tienda para agregar productos.";
    } else if (tieneProblemas) {
        estado.textContent =
            "Revisa los productos indicados antes de continuar.";
    } else {
        estado.textContent = "";
    }
}

lista.addEventListener("click", evento => {
    const boton = evento.target.closest("button[data-accion]");

    if (!boton || boton.disabled) return;

    const item = boton.closest(".linea-carrito");
    const id = Number(item.dataset.id);
    const accion = boton.dataset.accion;

    const linea = obtenerCarrito().find(
        producto => producto.id_producto === id
    );

    if (!linea) return;

    try {
        if (accion === "eliminar") {
            eliminarProducto(id);
        } else {
            const cantidad = linea.cantidad +
                (accion === "mas" ? 1 : -1);

            const producto = productosPorId.get(id);

            if (
                cantidad < 1 ||
                (
                    accion === "mas" &&
                    (!producto || cantidad > producto.stock_disponible)
                )
            ) {
                return;
            }

            cambiarCantidad(id, cantidad);
        }

        dibujarCarrito();

        const nuevoItem = lista.querySelector(
            `[data-id="${id}"]`
        );

        const siguienteFoco = nuevoItem?.querySelector(
            `[data-accion="${accion}"]:not(:disabled)`
        ) || nuevoItem?.querySelector(
            '[data-accion="eliminar"]'
        );

        (siguienteFoco || titulo).focus();

        if (obtenerCarrito().length > 0) {
            estado.textContent = "Carrito actualizado.";
        }
    } catch (error) {
        estado.textContent = error.message;
    }
});

vaciar.addEventListener("click", () => {
    try {
        vaciarCarrito();
        dibujarCarrito();
        titulo.focus();
    } catch {
        estado.textContent = "No pudimos vaciar el carrito.";
    }
});

async function cargarCarrito() {
    continuar.disabled = true;
    if (cargando) return;

    cargando = true;
    vistaVacia.hidden = true;
    reintentar.hidden = true;
    vaciar.hidden = true;
    resumen.hidden = true;
    lista.replaceChildren();
    lista.setAttribute("aria-busy", "true");
    estado.textContent = "Consultando precios y existencias…";

    try {
        if (obtenerCarrito().length === 0) {
            dibujarCarrito();
            return;
        }

        const datos = await solicitarAPI("/productos");
        const productos = Array.isArray(datos)
            ? datos
            : datos?.productos;

        if (
            !Array.isArray(productos) ||
            !productos.every(validarProducto)
        ) {
            throw new Error("La información de productos no es válida.");
        }

        productosPorId = new Map(
            productos.map(producto => [
                producto.id_producto,
                producto
            ])
        );

        dibujarCarrito();
    } catch (error) {
        estado.textContent = error.message;
        reintentar.hidden = false;
    } finally {
        cargando = false;
        lista.removeAttribute("aria-busy");
    }
}

reintentar.addEventListener("click", cargarCarrito);
continuar.addEventListener("click", () => {
    window.location.assign("/checkout.html");
});

cargarCarrito();