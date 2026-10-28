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
const busqueda = document.getElementById("buscar-productos");
const limpiarBusqueda = document.getElementById("limpiar-busqueda");
const formularioBusqueda = document.getElementById("busqueda-catalogo");
let productosCatalogo = [];

function normalizarTexto(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

// Iconos de categoría, no fotografías del modelo vendido.
function iconoProducto(nombre) {
    const texto = normalizarTexto(nombre);
    const categorias = [
        [/audifono|auricular|headphone|headset/, "audifonos"],
        [/teclado|keyboard/, "teclado"],
        [/mouse|raton/, "mouse"],
        [/laptop|portatil|notebook|macbook/, "portatil"],
        [/monitor|pantalla|televisor/, "monitor"],
        [/celular|telefono|smartphone|iphone/, "telefono"],
        [/bocina|altavoz|speaker/, "altavoz"]
    ];
    return categorias.find(([patron]) => patron.test(texto))?.[1] || "producto";
}

function mostrarProductos() {
    const consulta = normalizarTexto(busqueda.value);
    const palabras = consulta.split(/\s+/).filter(Boolean);
    const productos = productosCatalogo.filter(producto =>
        palabras.every(palabra => normalizarTexto(producto.nombre).includes(palabra))
    );
    const tarjetas = document.createDocumentFragment();
    for (const producto of productos) tarjetas.append(crearTarjeta(producto));
    lista.replaceChildren(tarjetas);
    limpiarBusqueda.hidden = busqueda.value.length === 0;

    if (productosCatalogo.length === 0) {
        estado.textContent = "Por ahora no hay productos disponibles. Vuelve a consultar más tarde.";
    } else if (productos.length === 0) {
        estado.textContent = "No encontramos productos. Prueba otro nombre o limpia la búsqueda.";
    } else {
        estado.textContent = consulta
            ? `${productos.length} de ${productosCatalogo.length} productos coinciden con tu búsqueda.`
            : `${productos.length} ${productos.length === 1 ? "producto disponible" : "productos disponibles"}.`;
    }
}

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

    fragmento.querySelector("use").setAttribute(
        "href", `/assets/iconos/productos.svg#${iconoProducto(producto.nombre)}`
    );
    fragmento.querySelector(".tarjeta-producto").classList.toggle(
        "tarjeta-producto--agotado", producto.stock_disponible === 0
    );

    const boton = fragmento.querySelector("button");

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
        producto.stock_disponible > 0
            ? `Agregar ${producto.nombre} al carrito`
            : `${producto.nombre}: sin existencias`
    );

    return fragmento;
}

async function cargarProductos() {
    if (cargando) return;

    cargando = true;
    busqueda.disabled = true;
    limpiarBusqueda.disabled = true;
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

        productosCatalogo = productos;
        mostrarProductos();
        busqueda.disabled = productos.length === 0;
    } catch {
        estado.textContent =
            "No pudimos cargar los productos. Vuelve a intentarlo con el botón de abajo.";
        reintentar.hidden = false;
    } finally {
        cargando = false;
        limpiarBusqueda.disabled = false;
        lista.removeAttribute("aria-busy");
    }
}

busqueda.addEventListener("input", mostrarProductos);
formularioBusqueda.addEventListener("submit", evento => evento.preventDefault());
limpiarBusqueda.addEventListener("click", () => {
    busqueda.value = "";
    mostrarProductos();
    busqueda.focus();
});
reintentar.addEventListener("click", cargarProductos);

conectarCuenta();
cargarProductos();
actualizarContadorCarrito();