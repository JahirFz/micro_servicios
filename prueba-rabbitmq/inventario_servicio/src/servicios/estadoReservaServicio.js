function validarIdPedido(idPedido) {
    if (
        !Number.isInteger(idPedido)
        || idPedido <= 0
        || idPedido > 2147483647
    ) {
        throw new Error("El identificador del pedido es inválido.");
    }
}

async function cambiarEstado(conexion, idPedido, destino) {
    validarIdPedido(idPedido);

    // Serializar cambios de estado sobre el mismo pedido.
    const [pedidos] = await conexion.execute(`
        SELECT resultado
        FROM reserva_pedido
        WHERE id_pedido = ?
        FOR UPDATE
    `, [idPedido]);

    if (pedidos.length === 0) {
        throw new Error(
            "No se ha procesado la reserva de este pedido."
        );
    }

    const [reservas] = await conexion.execute(`
        SELECT id_reserva, id_producto, cantidad, estado
        FROM reserva_inventario
        WHERE id_pedido = ?
        ORDER BY id_producto
        FOR UPDATE
    `, [idPedido]);

    if (pedidos[0].resultado === "RECHAZADO") {
        if (reservas.length !== 0) {
            throw new Error(
                "Inconsistencia: un pedido rechazado tiene reservas."
            );
        }

        if (destino === "CONFIRMADA") {
            throw new Error("No se puede confirmar una reserva rechazada.");
        }

        // No había unidades apartadas que devolver.
        return {
            id_pedido: idPedido,
            sin_reservas: true,
            duplicado: false
        };
    }

    if (reservas.length === 0) {
        throw new Error(
            "Inconsistencia: faltan las líneas de la reserva."
        );
    }

    const estados = new Set(reservas.map(r => r.estado));

    if (estados.size !== 1) {
        throw new Error(
            "Inconsistencia: las reservas tienen estados diferentes."
        );
    }

    const estadoActual = reservas[0].estado;

    if (estadoActual === destino) {
        return {
            id_pedido: idPedido,
            estado: destino,
            duplicado: true
        };
    }

    if (estadoActual !== "ACTIVA") {
        throw new Error(
            `No se puede pasar de ${estadoActual} a ${destino}.`
        );
    }

    if (destino === "LIBERADA") {
        for (const reserva of reservas) {
            // Bloquear productos en orden para reducir interbloqueos.
            const [productos] = await conexion.execute(`
                SELECT id_producto
                FROM producto
                WHERE id_producto = ?
                FOR UPDATE
            `, [reserva.id_producto]);

            if (productos.length !== 1) {
                throw new Error(
                    "No se encontró un producto de la reserva."
                );
            }

            const [actualizacion] = await conexion.execute(`
                UPDATE producto
                SET stock_disponible = stock_disponible + ?
                WHERE id_producto = ?
            `, [
                reserva.cantidad,
                reserva.id_producto
            ]);

            if (actualizacion.affectedRows !== 1) {
                throw new Error("No se pudo devolver el inventario.");
            }
        }
    }

    const [actualizacion] = await conexion.execute(`
        UPDATE reserva_inventario
        SET estado = ?
        WHERE id_pedido = ?
          AND estado = 'ACTIVA'
    `, [destino, idPedido]);

    if (actualizacion.affectedRows !== reservas.length) {
        throw new Error(
            "No se actualizaron todas las líneas de la reserva."
        );
    }

    return {
        id_pedido: idPedido,
        estado: destino,
        duplicado: false
    };
}

async function confirmarReserva(conexion, idPedido) {
    return cambiarEstado(conexion, idPedido, "CONFIRMADA");
}

async function liberarReserva(conexion, idPedido) {
    return cambiarEstado(conexion, idPedido, "LIBERADA");
}

module.exports = {
    confirmarReserva,
    liberarReserva
};