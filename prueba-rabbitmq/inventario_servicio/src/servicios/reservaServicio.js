const { createHash } = require("node:crypto");

function enteroPositivo(valor) {
    return Number.isInteger(valor)
        && valor > 0
        && valor <= 2147483647;
}

function validarProductos(productos) {
    if (
        !Array.isArray(productos)
        || productos.length === 0
        || productos.length > 100
    ) {
        throw new Error("El pedido debe contener entre 1 y 100 productos.");
    }

    const identificadores = new Set();

    const normalizados = productos.map((producto) => {
        if (
            !producto
            || !enteroPositivo(producto.id_producto)
            || !enteroPositivo(producto.cantidad)
        ) {
            throw new Error("Producto o cantidad inválidos.");
        }

        if (identificadores.has(producto.id_producto)) {
            throw new Error("No se permiten productos repetidos.");
        }

        identificadores.add(producto.id_producto);

        return {
            id_producto: producto.id_producto,
            cantidad: producto.cantidad
        };
    });

    // Todas las reservas bloquean productos en el mismo orden.
    return normalizados.sort(
        (a, b) => a.id_producto - b.id_producto
    );
}

async function leerResultado(conexion, idPedido, duplicado) {
    const [reservas] = await conexion.execute(`
        SELECT resultado, motivo
        FROM reserva_pedido
        WHERE id_pedido = ?
    `, [idPedido]);

    const [productos] = await conexion.execute(`
        SELECT
            id_producto,
            cantidad,
            nombre_producto,
            precio_unitario,
            moneda,
            estado
        FROM reserva_inventario
        WHERE id_pedido = ?
        ORDER BY id_producto
    `, [idPedido]);

    return {
        id_pedido: idPedido,
        duplicado,
        resultado: reservas[0].resultado,
        motivo: reservas[0].motivo,
        productos
    };
}

// Debe recibir una conexión con una transacción ya iniciada.
async function reservarInventario(conexion, idPedido, productos) {
    if (!enteroPositivo(idPedido)) {
        throw new Error("El identificador del pedido es inválido.");
    }

    const seleccion = validarProductos(productos);

    const hash = createHash("sha256")
        .update(JSON.stringify(seleccion))
        .digest("hex");

    try {
        // La PK serializa solicitudes concurrentes del mismo pedido.
        // Este registro es provisional hasta confirmar la transacción.
        await conexion.execute(`
            INSERT INTO reserva_pedido (
                id_pedido,
                hash_productos,
                resultado
            )
            VALUES (?, ?, 'RESERVADO')
        `, [idPedido, hash]);
    } catch (error) {
        if (error.code !== "ER_DUP_ENTRY") {
            throw error;
        }

        const [existentes] = await conexion.execute(`
            SELECT hash_productos
            FROM reserva_pedido
            WHERE id_pedido = ?
            FOR UPDATE
        `, [idPedido]);

        if (
            existentes.length === 0
            || existentes[0].hash_productos !== hash
        ) {
            throw new Error(
                "El pedido ya tiene otra selección de productos."
            );
        }

        // No descontar stock ni crear nuevas reservas.
        return leerResultado(conexion, idPedido, true);
    }

    const disponibles = [];
    let motivo = null;

    // Primero comprobar todos; todavía no descontar existencias.
    for (const solicitado of seleccion) {
        const [filas] = await conexion.execute(`
            SELECT
                id_producto,
                nombre,
                precio,
                moneda,
                stock_disponible,
                activo
            FROM producto
            WHERE id_producto = ?
            FOR UPDATE
        `, [solicitado.id_producto]);

        const producto = filas[0];

        if (!producto || !producto.activo) {
            motivo = `PRODUCTO_NO_DISPONIBLE:${solicitado.id_producto}`;
            break;
        }

        if (producto.moneda !== "MXN") {
            motivo = `MONEDA_NO_ADMITIDA:${solicitado.id_producto}`;
            break;
        }

        if (producto.stock_disponible < solicitado.cantidad) {
            motivo = `STOCK_INSUFICIENTE:${solicitado.id_producto}`;
            break;
        }

        disponibles.push({
            ...producto,
            cantidad: solicitado.cantidad
        });
    }

    if (motivo) {
        await conexion.execute(`
            UPDATE reserva_pedido
            SET resultado = 'RECHAZADO',
                motivo = ?
            WHERE id_pedido = ?
        `, [motivo, idPedido]);

        return leerResultado(conexion, idPedido, false);
    }

    for (const producto of disponibles) {
        const [actualizacion] = await conexion.execute(`
            UPDATE producto
            SET stock_disponible = stock_disponible - ?
            WHERE id_producto = ?
              AND stock_disponible >= ?
        `, [
            producto.cantidad,
            producto.id_producto,
            producto.cantidad
        ]);

        if (actualizacion.affectedRows !== 1) {
            throw new Error(
                "No se pudo actualizar el inventario."
            );
        }

        await conexion.execute(`
            INSERT INTO reserva_inventario (
                id_pedido,
                id_producto,
                cantidad,
                nombre_producto,
                precio_unitario,
                moneda,
                estado
            )
            VALUES (?, ?, ?, ?, ?, ?, 'ACTIVA')
        `, [
            idPedido,
            producto.id_producto,
            producto.cantidad,
            producto.nombre,
            producto.precio,
            producto.moneda
        ]);
    }

    return leerResultado(conexion, idPedido, false);
}

module.exports = {
    reservarInventario
};