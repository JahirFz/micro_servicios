import { solicitarAPI } from "../api.js";
import { obtenerSesion, cerrarSesion } from "../sesion.js";
import { obtenerCarrito, vaciarCarrito } from "../carrito.js";

const lista = document.getElementById("resumen-productos");
const plantilla = document.getElementById(
    "plantilla-resumen-producto"
);
const total = document.getElementById("total-checkout");
const estado = document.getElementById("estado-checkout");
const reintentar = document.getElementById("reintentar-checkout");

const formatoMoneda = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
});

const confirmar = document.getElementById("confirmar-compra");

let enviando = false;
let pedidoCreado = false;

function serializarCompra(compra) {
    return JSON.stringify({
        productos: [...compra.productos].sort(
            (a, b) => a.id_producto - b.id_producto
        ),
        metodo_pago: compra.metodo_pago
    });
}

let cargando = false;
let compraRevisada = null;

async function cargarResumen() {
    if (cargando || enviando || pedidoCreado) return;

    confirmar.disabled = true;

    if (!obtenerSesion()) {
        window.location.replace(
            "/acceso.html?volver=checkout"
        );
        return;
    }

    const carrito = obtenerCarrito();

    if (carrito.length === 0) {
        window.location.replace("/carrito.html");
        return;
    }

    cargando = true;
    compraRevisada = null;
    confirmar.disabled = false;
    lista.replaceChildren();
    lista.setAttribute("aria-busy", "true");
    reintentar.hidden = true;
    total.textContent = "Por calcular";
    estado.textContent = "Revisando productos y existencias…";

    try {
        const datos = await solicitarAPI("/productos");
        const productos = Array.isArray(datos)
            ? datos
            : datos?.productos;

        if (!Array.isArray(productos)) {
            throw new Error("La información del catálogo no es válida.");
        }

        const porId = new Map(
            productos.map(producto => [
                producto.id_producto,
                producto
            ])
        );

        let totalCentavos = 0n;
        const tarjetas = document.createDocumentFragment();

        for (const linea of carrito) {
            const producto = porId.get(linea.id_producto);

            if (
                !producto ||
                typeof producto.nombre !== "string" ||
                producto.moneda !== "MXN" ||
                typeof producto.precio !== "string" ||
                !/^\d{1,10}\.\d{2}$/.test(producto.precio) ||
                Number(producto.precio) <= 0 ||
                !Number.isInteger(producto.stock_disponible) ||
                producto.stock_disponible < linea.cantidad
            ) {
                throw new Error(
                    "Algún producto no está disponible en la cantidad " +
                    "solicitada. Vuelve al carrito para revisarlo."
                );
            }

            totalCentavos +=
                BigInt(producto.precio.replace(".", "")) *
                BigInt(linea.cantidad);

            const tarjeta = plantilla.content.cloneNode(true);

            tarjeta.querySelector(
                ".checkout__producto-nombre"
            ).textContent = producto.nombre;

            tarjeta.querySelector(
                ".checkout__producto-detalle"
            ).textContent =
                `Cantidad: ${linea.cantidad} · ` +
                `${formatoMoneda.format(Number(producto.precio))} MXN por unidad`;

            tarjetas.append(tarjeta);
        }

        if (totalCentavos > 999999999999n) {
            throw new Error(
                "El importe supera el límite permitido por pedido."
            );
        }

        lista.append(tarjetas);

        total.textContent =
            `${formatoMoneda.format(Number(totalCentavos) / 100)} MXN`;

        compraRevisada = {
            productos: carrito.map(linea => ({
                id_producto: linea.id_producto,
                cantidad: linea.cantidad
            })),
            metodo_pago: "TARJETA_PRUEBA"
        };

        estado.textContent =
            "Revisa el resumen antes de confirmar tu compra.";
    } catch (error) {
        estado.textContent = error.message;
        reintentar.hidden = false;
    } finally {
        cargando = false;
        lista.removeAttribute("aria-busy");
    }
}

confirmar.addEventListener("click", async () => {
    if (enviando || pedidoCreado || !compraRevisada) return;

    const sesion = obtenerSesion();

    if (!sesion) {
        window.location.assign("/acceso.html?volver=checkout");
        return;
    }

    enviando = true;
    confirmar.disabled = true;
    confirmar.textContent = "Creando pedido…";
    confirmar.setAttribute("aria-busy", "true");
    reintentar.hidden = true;

    const claveGuardado =
        `fertech.compra.${sesion.usuario.id_usuario}`;

    let intento;

    try {
        const cuerpo = serializarCompra(compraRevisada);
        const guardado = sessionStorage.getItem(claveGuardado);

        if (guardado) {
            intento = JSON.parse(guardado);

            if (
                typeof intento.clave !== "string" ||
                typeof intento.cuerpo !== "string"
            ) {
                throw new Error(
                    "No pudimos recuperar la solicitud anterior."
                );
            }

            if (intento.cuerpo !== cuerpo) {
                throw new Error(
                    "Hay una compra anterior pendiente de comprobar. " +
                    "No enviaremos otra compra con productos diferentes."
                );
            }
        } else {
            intento = {
                clave: crypto.randomUUID(),
                cuerpo
            };

            // Guardar antes de enviar: un fallo de red
            // no debe generar una clave nueva.
            sessionStorage.setItem(
                claveGuardado,
                JSON.stringify(intento)
            );
        }

        estado.textContent = "Creando tu pedido. Espera un momento.";

        const pedido = await solicitarAPI("/pedidos", {
            metodo: "POST",
            cuerpo: JSON.parse(intento.cuerpo),
            token: sesion.token,
            claveIdempotencia: intento.clave
        });

        if (
            !Number.isInteger(pedido.id_pedido) ||
            pedido.id_pedido < 1
        ) {
            throw new Error(
                "No pudimos confirmar la respuesta. " +
                "Reintenta para recuperar el mismo pedido."
            );
        }

        pedidoCreado = true;

        estado.textContent =
            `Pedido #${pedido.id_pedido} creado. ` +
            "Estamos procesando las existencias y el pago.";

        confirmar.textContent = "Pedido creado";

        // Conservar el identificador incluso si falla
        // alguna actualización posterior del navegador.
        sessionStorage.setItem(
            claveGuardado,
            JSON.stringify({
                ...intento,
                idPedido: pedido.id_pedido
            })
        );

        // No borrar un carrito que haya cambiado durante el envío.
        const carritoActual = serializarCompra({
            productos: obtenerCarrito(),
            metodo_pago: "TARJETA_PRUEBA"
        });

        if (carritoActual === intento.cuerpo) {
            vaciarCarrito();
        }

        sessionStorage.removeItem(claveGuardado);
        window.location.assign(
            `/pedido.html?id=${pedido.id_pedido}`
        );
    } catch (error) {
        if (error.status === 401 && !pedidoCreado) {
            cerrarSesion();

            window.location.replace(
                "/acceso.html?volver=checkout"
            );

            return;
        }
        estado.textContent = pedidoCreado
            ? "El pedido fue creado, pero no pudimos actualizar " +
              "los datos locales. Consulta tu historial antes de comprar otra vez."
            : `${error.message} Si reintentas esta compra, ` +
              "conservaremos la misma clave para evitar duplicados.";

        confirmar.textContent = pedidoCreado
            ? "Pedido creado"
            : "Reintentar compra";
    } finally {
        enviando = false;
        confirmar.disabled = pedidoCreado;
        confirmar.removeAttribute("aria-busy");
    }
});

reintentar.addEventListener("click", cargarResumen);

cargarResumen();