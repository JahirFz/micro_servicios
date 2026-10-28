const { randomUUID } = require("node:crypto");

const {
    conectarRabbitMQ,
    EXCHANGE,
    COLA_INVENTARIO
} = require("./config/rabbitmq");

async function enviarLiberacion() {
    const { conexion, canal } = await conectarRabbitMQ();

    try {
        const mensaje = {
            message_id: randomUUID(),
            tipo: "LiberarReserva",
            version: 1,
            fecha: new Date().toISOString(),
            id_pedido: 1717588349,
            datos: {}
        };

        let devuelto = false;

        canal.on("return", () => {
            devuelto = true;
        });

        canal.publish(
            EXCHANGE,
            COLA_INVENTARIO,
            Buffer.from(JSON.stringify(mensaje)),
            {
                persistent: true,
                mandatory: true,
                contentType: "application/json",
                messageId: mensaje.message_id
            }
        );

        await canal.waitForConfirms();

        if (devuelto) {
            throw new Error("El mensaje no llegó a una cola.");
        }

        console.log(
            "RabbitMQ aceptó LiberarReserva para el pedido:",
            mensaje.id_pedido
        );
    } finally {
        try {
            await canal.close();
        } finally {
            await conexion.close();
        }
    }
}

enviarLiberacion().catch((error) => {
    console.error("Falló el envío:", error.message);
    process.exitCode = 1;
});