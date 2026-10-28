const {
    conectarRabbitMQ
} = require("./config/rabbitmq");

async function probar() {
    const { conexion, canal } = await conectarRabbitMQ();

    try {
        const inventario = await canal.checkQueue(
            "inventario.comandos"
        );

        console.log("Conexión correcta con RabbitMQ.");
        console.log("Exchange: fertech");
        console.log("Cola:", inventario.queue);
        console.log("Mensajes pendientes:", inventario.messageCount);
    } finally {
        try {
            await canal.close();
        } finally {
            await conexion.close();
        }
    }
}

probar().catch((error) => {
    console.error("Falló la prueba:", error.message);
    process.exitCode = 1;
});