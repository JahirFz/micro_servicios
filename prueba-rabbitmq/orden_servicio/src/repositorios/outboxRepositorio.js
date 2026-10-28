const { randomUUID } = require("node:crypto");

async function guardarReservaSolicitada(
    conexion,
    idPedido,
    productos
) {
    const mensaje = {
        message_id: randomUUID(),
        tipo: "ReservarInventario",
        version: 1,
        fecha: new Date().toISOString(),
        id_pedido: idPedido,
        datos: { productos }
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
        "inventario.comandos",
        JSON.stringify(mensaje)
    ]);
}

module.exports = { guardarReservaSolicitada };