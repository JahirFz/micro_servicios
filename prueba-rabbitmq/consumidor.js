const amqp = require("amqplib");

async function iniciar() {
    const conexion = await amqp.connect(
        "amqp://jahir:PasarelaLocal2026@localhost:5672"
    );

    const canal = await conexion.createChannel();
    const cola = "prueba_pedidos";

    await canal.assertQueue(cola, {
        durable: true
    });

    // Procesar un mensaje a la vez.
    await canal.prefetch(1);

    console.log(`Esperando mensajes en ${cola}...`);

    await canal.consume(cola, (mensaje) => {
        if (mensaje === null) {
            console.log("El servidor canceló el consumidor.");
            return;
        }

        try {
            const contenido = JSON.parse(
                mensaje.content.toString()
            );

            console.log("Mensaje recibido:");
            console.log(contenido);

            // Confirmar que terminamos de procesarlo.
            canal.ack(mensaje);
        } catch (error) {
            console.error("Mensaje inválido:", error.message);

            // Retirarlo de la cola sin volver a intentarlo.
            canal.nack(mensaje, false, false);
        }
    }, {
        noAck: false
    });
}

iniciar().catch((error) => {
    console.error("No se pudo iniciar:", error.message);
    process.exitCode = 1;
});