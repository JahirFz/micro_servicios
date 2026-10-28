const { randomUUID } = require("node:crypto");

async function registrarMensajeRecibido(conexion, mensaje) {
    try {
        await conexion.execute(
            `INSERT INTO mensaje_procesado (message_id, tipo)
             VALUES (?, ?)`,
            [mensaje.message_id, mensaje.tipo]
        );

        return { duplicado: false };
    } catch (error) {
        if (error.code !== "ER_DUP_ENTRY") {
            throw error;
        }

        const [filas] = await conexion.execute(
            `SELECT tipo
             FROM mensaje_procesado
             WHERE message_id = ?
             FOR UPDATE`,
            [mensaje.message_id]
        );

        if (filas.length !== 1 || filas[0].tipo !== mensaje.tipo) {
            throw new Error(
                "El identificador del mensaje ya existe con otro tipo."
            );
        }

        return { duplicado: true };
    }
}

async function guardarMensajeSalida(
    conexion,
    { tipo, routingKey, idPedido, datos }
) {
    const mensaje = {
        message_id: randomUUID(),
        tipo,
        version: 1,
        fecha: new Date().toISOString(),
        id_pedido: idPedido,
        datos
    };

    await conexion.execute(
        `INSERT INTO outbox (
            message_id,
            tipo,
            routing_key,
            payload
         ) VALUES (?, ?, ?, ?)`,
        [
            mensaje.message_id,
            mensaje.tipo,
            routingKey,
            JSON.stringify(mensaje)
        ]
    );

    return mensaje;
}

module.exports = {
    registrarMensajeRecibido,
    guardarMensajeSalida
};