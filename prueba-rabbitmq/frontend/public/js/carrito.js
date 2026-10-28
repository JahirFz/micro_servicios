const CLAVE = "fertech.carrito";

function enteroValido(valor) {
    return (
        Number.isInteger(valor) &&
        valor >= 1 &&
        valor <= 2147483647
    );
}

export function obtenerCarrito() {
    const contenido = sessionStorage.getItem(CLAVE);

    if (!contenido) return [];

    try {
        const productos = JSON.parse(contenido);

        if (
            !Array.isArray(productos) ||
            productos.length > 100
        ) {
            throw new Error("Carrito inválido.");
        }

        const identificadores = new Set();

        for (const producto of productos) {
            if (
                !producto ||
                !enteroValido(producto.id_producto) ||
                !enteroValido(producto.cantidad) ||
                identificadores.has(producto.id_producto)
            ) {
                throw new Error("Producto del carrito inválido.");
            }

            identificadores.add(producto.id_producto);
        }

        return productos;
    } catch {
        sessionStorage.removeItem(CLAVE);
        return [];
    }
}

export function contarUnidades() {
    return obtenerCarrito().reduce(
        (total, producto) => total + producto.cantidad,
        0
    );
}

export function agregarProducto(idProducto, stockDisponible) {
    if (
        !enteroValido(idProducto) ||
        !enteroValido(stockDisponible)
    ) {
        throw new Error("El producto no tiene existencias disponibles.");
    }

    const productos = obtenerCarrito();

    const existente = productos.find(
        producto => producto.id_producto === idProducto
    );

    if (existente) {
        if (existente.cantidad >= stockDisponible) {
            throw new Error(
                "Ya agregaste todas las unidades disponibles."
            );
        }

        existente.cantidad++;
    } else {
        if (productos.length >= 100) {
            throw new Error(
                "El carrito admite hasta 100 productos diferentes."
            );
        }

        productos.push({
            id_producto: idProducto,
            cantidad: 1
        });
    }

    sessionStorage.setItem(CLAVE, JSON.stringify(productos));
}

export function cambiarCantidad(idProducto, cantidad) {
    if (!enteroValido(idProducto) || !enteroValido(cantidad)) {
        throw new Error("Cantidad inválida.");
    }

    const productos = obtenerCarrito();
    const producto = productos.find(
        item => item.id_producto === idProducto
    );

    if (!producto) {
        throw new Error("El producto ya no está en el carrito.");
    }

    producto.cantidad = cantidad;

    sessionStorage.setItem(CLAVE, JSON.stringify(productos));
}

export function eliminarProducto(idProducto) {
    const productos = obtenerCarrito().filter(
        item => item.id_producto !== idProducto
    );

    sessionStorage.setItem(CLAVE, JSON.stringify(productos));
}

export function vaciarCarrito() {
    sessionStorage.removeItem(CLAVE);
}