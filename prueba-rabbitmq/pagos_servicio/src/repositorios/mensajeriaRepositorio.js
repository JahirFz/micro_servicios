const { randomUUID } = require("node:crypto");
const { Int32 } = require("mongodb");

async function registrarMensajeRecibido(db, sesion, mensaje) {
    const coleccion = db.collection("mensajes_procesados");

    const existente = await coleccion.findOne(
        { _id: mensaje.message_id },
        { session: sesion }
    );

    if (existente) {
        if (existente.tipo !== mensaje.tipo) {
            throw new Error(
                "El identificador del mensaje ya existe con otro tipo."
            );
        }

        return { duplicado: true };
    }

    await coleccion.insertOne(
        {
            _id: mensaje.message_id,
            tipo: mensaje.tipo,
            procesado_en: new Date()
        },
        { session: sesion }
    );

    return { duplicado: false };
}

async function guardarMensajeSalida(
    db,
    sesion,
    { tipo, routingKey, idPedido, datos }
) {
    const ahora = new Date();

    const mensaje = {
        message_id: randomUUID(),
        tipo,
        version: 1,
        fecha: ahora.toISOString(),
        id_pedido: idPedido,
        datos
    };

    await db.collection("outbox").insertOne(
        {
            message_id: mensaje.message_id,
            tipo,
            routing_key: routingKey,
            payload: mensaje,
            estado_publicacion: "PENDIENTE",
            intentos: new Int32(0),
            proximo_intento_en: ahora,
            creado_en: ahora,
            publicado_en: null
        },
        { session: sesion }
    );

    return mensaje;
}

module.exports = {
    registrarMensajeRecibido,
    guardarMensajeSalida
};