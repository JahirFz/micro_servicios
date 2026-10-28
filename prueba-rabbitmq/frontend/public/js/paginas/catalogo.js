import { solicitarAPI } from "../api.js";
import { conectarCuenta } from "../cuenta.js";
import {
    agregarProducto,
    contarUnidades
} from "../carrito.js";


const lista = document.getElementById("lista-productos");
const plantilla = document.getElementById("plantilla-producto");
const estado = document.getElementById("estado-catalogo");
const reintentar = document.getElementById("reintentar-catalogo");

const moneda = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
});

let cargando = false;

const estadoCarrito = document.getElementById("estado-carrito");

function actualizarContadorCarrito() {
    estadoCarrito.textContent =
        `Carrito: ${contarUnidades()} unidades.`;
}


function validarProducto(producto) {
    return (
        producto !== null &&
        typeof producto === "object" &&
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

function crearTarjeta(producto) {
    const fragmento = plantilla.content.cloneNode(true);

    fragmento.querySelector(
        ".tarjeta-producto__nombre"
    ).textContent = producto.nombre;

    fragmento.querySelector(
        ".tarjeta-producto__precio"
    ).textContent = `${moneda.format(Number(producto.precio))} MXN`;

    fragmento.querySelector(
        ".tarjeta-producto__stock"
    ).textContent = producto.stock_disponible > 0
        ? `Disponible · ${producto.stock_disponible} unidades`
        : "Sin existencias";

    const boton = fragmento.querySelector("button");

    // Se habilitará cuando conectemos el módulo del carrito.
    boton.disabled = producto.stock_disponible === 0;

    boton.addEventListener("click", () => {
        try {
            agregarProducto(
                producto.id_producto,
                producto.stock_disponible
            );

            estadoCarrito.textContent =
                `${producto.nombre} agregado. ` +
                `Carrito: ${contarUnidades()} unidades.`;
        } catch (error) {
            estadoCarrito.textContent = error.message;
        }
    });

    boton.textContent = producto.stock_disponible > 0
        ? "Agregar al carrito"
        : "Sin existencias";

    boton.setAttribute(
        "aria-label",
        `Agregar ${producto.nombre} al carrito`
    );

    return fragmento;
}

async function cargarProductos() {
    if (cargando) return;

    cargando = true;
    lista.replaceChildren();
    lista.setAttribute("aria-busy", "true");
    reintentar.hidden = true;
    estado.textContent = "Cargando productos…";

    try {
        const datos = await solicitarAPI("/productos");

        const productos = Array.isArray(datos)
            ? datos
            : datos?.productos;

        if (
            !Array.isArray(productos) ||
            !productos.every(validarProducto)
        ) {
            throw new Error(
                "La información del catálogo no es válida."
            );
        }

        const tarjetas = document.createDocumentFragment();

        for (const producto of productos) {
            tarjetas.append(crearTarjeta(producto));
        }

        lista.append(tarjetas);

        estado.textContent = productos.length === 0
            ? "Por ahora no hay productos disponibles."
            : "";
    } catch (error) {
        estado.textContent = error.message;
        reintentar.hidden = false;
    } finally {
        cargando = false;
        lista.removeAttribute("aria-busy");
    }
}

reintentar.addEventListener("click", cargarProductos);

conectarCuenta();
cargarProductos();
actualizarContadorCarrito();