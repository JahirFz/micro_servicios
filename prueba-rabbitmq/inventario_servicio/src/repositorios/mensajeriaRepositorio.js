const { randomUUID } = require("node:crypto");

async function registrarMensajeRecibido(
    conexion,
    messageId,
    tipo
) {
    try {
        await conexion.execute(`
            INSERT INTO mensaje_procesado (
                message_id,
                tipo
            )
            VALUES (?, ?)
        `, [messageId, tipo]);

        return { duplicado: false };
    } catch (error) {
        if (error.code !== "ER_DUP_ENTRY") {
            throw error;
        }

        const [existentes] = await conexion.execute(`
            SELECT tipo
            FROM mensaje_procesado
            WHERE message_id = ?
            FOR UPDATE
        `, [messageId]);

        if (
            existentes.length !== 1
            || existentes[0].tipo !== tipo
        ) {
            throw new Error(
                "El identificador del mensaje está en conflicto."
            );
        }

        return { duplicado: true };
    }
}

async function guardarMensajeSalida(
    conexion,
    tipo,
    idPedido,
    datos
) {
    const mensaje = {
        message_id: randomUUID(),
        tipo,
        version: 1,
        fecha: new Date().toISOString(),
        id_pedido: idPedido,
        datos
    };

    await conexion.execute(`
        INSERT INTO outbox (
            message_id,
            tipo,
            routing_key,
            payload
        )
        VALUES (?, ?, ?, ?)
    `, [
        mensaje.message_id,
        mensaje.tipo,
        "pedidos.eventos",
        JSON.stringify(mensaje)
    ]);

    return mensaje;
}

module.exports = {
    registrarMensajeRecibido,
    guardarMensajeSalida
};