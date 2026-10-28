import { solicitarAPI } from "../api.js";
import { obtenerSesion, cerrarSesion } from "../sesion.js";
import { conectarCuenta } from "../cuenta.js";

const contenido = document.getElementById("contenido-admin");
const estadoAdmin = document.getElementById("estado-admin");

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

let accesoBloqueado = false;

function pedirAcceso() {
    accesoBloqueado = true;
    window.location.replace("/acceso.html?volver=admin");
}

function gestionarErrorAcceso(error) {
    if (error.status === 401) {
        cerrarSesion();
        pedirAcceso();
        return true;
    }

    if (error.status === 403) {
        accesoBloqueado = true;
        contenido.hidden = true;
        estadoAdmin.textContent =
            "No tienes permisos para acceder a esta sección.";
        return true;
    }

    return false;
}

function crearTarjeta(titulo, textos) {
    const item = document.createElement("li");
    item.className = "admin__tarjeta";

    const encabezado = document.createElement("h3");
    encabezado.textContent = titulo;
    item.append(encabezado);

    for (const texto of textos) {
        const parrafo = document.createElement("p");
        parrafo.className = "texto-secundario texto-pequeno";
        parrafo.textContent = texto;
        item.append(parrafo);
    }

    return item;
}

function tarjetaPedido(pedido) {
    const momento = new Date(pedido.fecha_creacion);

    const tarjeta = crearTarjeta(`Pedido #${pedido.id_pedido}`, [
        `Cliente #${pedido.id_usuario}`,
        `Estado: ${estados[pedido.estado] || "Por consultar"}`,
        Number.isNaN(momento.getTime())
            ? "Fecha no disponible"
            : fecha.format(momento),
        pedido.total === null
            ? "Total por confirmar"
            : `${moneda.format(Number(pedido.total))} MXN`
    ]);

    const enlace = document.createElement("a");
    enlace.className = "boton boton--secundario";
    enlace.href = `/admin-pedido.html?id=${pedido.id_pedido}`;
    enlace.textContent = "Ver detalle";
    enlace.setAttribute(
        "aria-label",
        `Ver detalle administrativo del pedido ${pedido.id_pedido}`
    );

    tarjeta.append(enlace);

    return tarjeta;
}

function tarjetaProducto(producto) {
    return crearTarjeta(producto.nombre, [
        `Producto #${producto.id_producto}`,
        `${moneda.format(Number(producto.precio))} MXN`,
        `Existencias disponibles: ${producto.stock_disponible}`,
        Number(producto.activo) === 1 ? "Activo" : "Inactivo"
    ]);
}

function prepararListado(nombre, crearItem) {
    const lista = document.getElementById(`lista-${nombre}`);
    const estado = document.getElementById(`estado-${nombre}`);
    const boton = document.getElementById(`mas-${nombre}`);

    let cursor = null;
    let cargando = false;
    let terminado = false;

    async function cargar() {
        if (cargando || terminado || accesoBloqueado) return;

        const sesion = obtenerSesion();

        if (!sesion) {
            pedirAcceso();
            return;
        }

        cargando = true;
        boton.disabled = true;
        boton.setAttribute("aria-busy", "true");
        lista.setAttribute("aria-busy", "true");
        estado.textContent = "Cargando…";

        try {
            const parametros = new URLSearchParams();

            if (cursor !== null) {
                parametros.set("antes_de", String(cursor));
            }

            const datos = await solicitarAPI(
                `/admin/${nombre}?${parametros.toString()}`,
                { token: sesion.token }
            );

            if (accesoBloqueado) return;

            if (
                !Array.isArray(datos[nombre]) ||
                (
                    datos.siguiente_antes_de !== null &&
                    (
                        !Number.isInteger(datos.siguiente_antes_de) ||
                        datos.siguiente_antes_de < 1
                    )
                )
            ) {
                throw new Error("La respuesta recibida no es válida.");
            }

            const fragmento = document.createDocumentFragment();

            for (const item of datos[nombre]) {
                fragmento.append(crearItem(item));
            }

            lista.append(fragmento);
            cursor = datos.siguiente_antes_de;
            terminado = cursor === null;

            if (terminado && document.activeElement === boton) {
                lista.tabIndex = -1;
                lista.focus();
            }

            boton.hidden = terminado;
            boton.textContent = "Cargar más";

            estado.textContent = lista.children.length === 0
                ? "No hay registros."
                : `${lista.children.length} registros mostrados.`;
        } catch (error) {
            if (gestionarErrorAcceso(error)) return;

            estado.textContent = error.message;
            boton.textContent = "Reintentar";
        } finally {
            cargando = false;
            boton.disabled = false;
            boton.removeAttribute("aria-busy");
            lista.removeAttribute("aria-busy");
        }
    }

    boton.addEventListener("click", cargar);

    return cargar;
}

async function cargarResumen() {
    if (accesoBloqueado) return;

    const boton = document.getElementById("actualizar-resumen");
    const pendientes = document.getElementById("cantidad-pendientes");
    const pocoStock = document.getElementById("cantidad-poco-stock");
    const mensaje = document.getElementById("estado-resumen");

    if (boton.disabled) return;

    const sesion = obtenerSesion();

    if (!sesion) {
        pedirAcceso();
        return;
    }

    boton.disabled = true;
    boton.setAttribute("aria-busy", "true");
    mensaje.textContent = "Actualizando resumen…";

    try {
        const resultados = await Promise.allSettled([
            solicitarAPI("/admin/pedidos/resumen", {
                token: sesion.token
            }),
            solicitarAPI("/admin/productos/resumen", {
                token: sesion.token
            })
        ]);

        if (accesoBloqueado) return;

        const indicadores = [
            {
                resultado: resultados[0],
                elemento: pendientes,
                propiedad: "pendientes"
            },
            {
                resultado: resultados[1],
                elemento: pocoStock,
                propiedad: "productos_poco_stock"
            }
        ];

        let fallos = 0;

        for (const indicador of indicadores) {
            const resultado = indicador.resultado;

            if (resultado.status === "rejected") {
                if (gestionarErrorAcceso(resultado.reason)) return;

                indicador.elemento.textContent = "No disponible";
                fallos++;
                continue;
            }

            const valor = resultado.value[indicador.propiedad];

            if (!Number.isSafeInteger(valor) || valor < 0) {
                indicador.elemento.textContent = "No disponible";
                fallos++;
                continue;
            }

            indicador.elemento.textContent = String(valor);
        }

        mensaje.textContent = fallos === 0
            ? "Resumen actualizado."
            : "No pudimos actualizar todo el resumen. Puedes reintentar.";
    } finally {
        boton.disabled = false;
        boton.removeAttribute("aria-busy");
    }
}

document.getElementById("actualizar-resumen").addEventListener(
    "click",
    cargarResumen
);

conectarCuenta();

const sesion = obtenerSesion();

if (!sesion) {
    pedirAcceso();
} else if (sesion.usuario.rol !== "ADMIN") {
    accesoBloqueado = true;
    estadoAdmin.textContent =
        "No tienes permisos para acceder a esta sección.";
} else {
    contenido.hidden = false;
    estadoAdmin.textContent = "";

    cargarResumen();
    prepararListado("pedidos", tarjetaPedido)();
    prepararListado("productos", tarjetaProducto)();
}