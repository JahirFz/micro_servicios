const amqp = require("amqplib");
const { randomUUID } = require("node:crypto");

async function enviar() {
    const conexion = await amqp.connect(
        "amqp://jahir:PasarelaLocal2026@localhost:5672"
    );

    try {
        const canal = await conexion.createConfirmChannel();
        const cola = "prueba_pedidos";

        await canal.assertQueue(cola, {
            durable: true
        });

        const mensaje = {
            message_id: randomUUID(),
            tipo: "ReservarInventario",
            id_pedido: 26,
            productos: [
                {
                    id_producto: 8,
                    cantidad: 2
                }
            ]
        };

        canal.sendToQueue(
            cola,
            Buffer.from(JSON.stringify(mensaje)),
            {
                persistent: true,
                contentType: "application/json",
                messageId: mensaje.message_id
            }
        );

        await canal.waitForConfirms();

        console.log("RabbitMQ confirmó la recepción:");
        console.log(mensaje);

        await canal.close();
    } finally {
        await conexion.close();
    }
}

enviar().catch((error) => {
    console.error("No se pudo enviar:", error.message);
    process.exitCode = 1;
});