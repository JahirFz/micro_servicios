const formulario = document.getElementById("formulario-login");
const correo = document.getElementById("correo");
const password = document.getElementById("password");
const boton = document.getElementById("boton-login");
const mensaje = document.getElementById("mensaje");

let sesionActual = null;
let enviando = false;

formulario.addEventListener("submit", async evento => {
    evento.preventDefault();

    if (enviando) return;

    correo.value = correo.value.trim();

    if (!formulario.reportValidity()) return;

    enviando = true;
    boton.disabled = true;
    boton.textContent = "Iniciando sesión…";
    formulario.setAttribute("aria-busy", "true");
    mensaje.textContent = "";
    mensaje.dataset.error = "false";

    const controlador = new AbortController();
    const temporizador = setTimeout(
        () => controlador.abort(),
        15000
    );

    try {
        const respuesta = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                correo: correo.value,
                password: password.value
            }),
            signal: controlador.signal
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                datos.error?.mensaje ||
                "No pudimos iniciar sesión."
            );
        }

        if (
            typeof datos.access_token !== "string" ||
            !datos.usuario
        ) {
            throw new Error(
                "La respuesta de inicio de sesión no es válida."
            );
        }

        sesionActual = datos;
        password.value = "";

        await mostrarCatalogo();
    } catch (error) {
        mensaje.dataset.error = "true";

        mensaje.textContent = controlador.signal.aborted
            ? "La solicitud tardó demasiado. Intenta nuevamente."
            : error instanceof TypeError
                ? "No pudimos conectar. Revisa tu conexión."
                : error.message;
    } finally {
        clearTimeout(temporizador);
        enviando = false;
        boton.disabled = false;
        boton.textContent = "Iniciar sesión";
        formulario.removeAttribute("aria-busy");
    }
});

const vistaAcceso = document.getElementById("vista-acceso");
const vistaCatalogo = document.getElementById("vista-catalogo");
const saludo = document.getElementById("saludo");
const estadoCatalogo = document.getElementById("estado-catalogo");
const listaProductos = document.getElementById("lista-productos");
const reintentarCatalogo = document.getElementById(
    "reintentar-catalogo"
);

const formatoMoneda = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
});

async function mostrarCatalogo() {
    vistaAcceso.hidden = true;
    vistaCatalogo.hidden = false;

    saludo.textContent =
        `Hola, ${sesionActual.usuario.nombre}`;

    document.title = "Catálogo | Fertech";
    document.getElementById("titulo-catalogo").focus();

    await cargarProductos();
}

async function cargarProductos() {
    listaProductos.replaceChildren();
    reintentarCatalogo.hidden = true;
    estadoCatalogo.textContent = "Cargando productos…";
    listaProductos.setAttribute("aria-busy", "true");

    const controlador = new AbortController();
    const temporizador = setTimeout(
        () => controlador.abort(),
        15000
    );

    try {
        const respuesta = await fetch("/api/productos", {
            signal: controlador.signal
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                datos.error?.mensaje ||
                "No pudimos cargar los productos."
            );
        }

        const productos = Array.isArray(datos)
            ? datos
            : datos.productos;

        if (!Array.isArray(productos)) {
            throw new Error("El catálogo recibido no es válido.");
        }

        const fragmento = document.createDocumentFragment();

        for (const producto of productos) {
            const precio = Number(producto.precio);
            const stock = Number(producto.stock_disponible);

            if (
                typeof producto.nombre !== "string" ||
                !Number.isFinite(precio) ||
                precio <= 0 ||
                !Number.isInteger(stock) ||
                stock < 0 ||
                producto.moneda !== "MXN"
            ) {
                throw new Error(
                    "Un producto tiene información inválida."
                );
            }

            const tarjeta = document.createElement("li");
            tarjeta.className = "producto";

            const nombre = document.createElement("h2");
            nombre.textContent = producto.nombre;

            const importe = document.createElement("p");
            importe.className = "producto-precio";
            importe.textContent = formatoMoneda.format(precio);

            const disponibilidad = document.createElement("p");
            disponibilidad.className = "producto-stock";
            disponibilidad.textContent = stock > 0
                ? `Disponibles: ${stock}`
                : "Sin existencias";

            tarjeta.append(nombre, importe, disponibilidad);
            fragmento.append(tarjeta);
        }

        listaProductos.append(fragmento);

        estadoCatalogo.textContent = productos.length === 0
            ? "Por ahora no hay productos disponibles."
            : `${productos.length} productos en el catálogo.`;
    } catch (error) {
        estadoCatalogo.textContent =
            controlador.signal.aborted
                ? "La carga tardó demasiado. Intenta nuevamente."
                : "No pudimos cargar el catálogo. Intenta nuevamente.";

        reintentarCatalogo.hidden = false;
    } finally {
        clearTimeout(temporizador);
        listaProductos.removeAttribute("aria-busy");
    }
}

reintentarCatalogo.addEventListener("click", cargarProductos);