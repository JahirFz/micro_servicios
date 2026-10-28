const {
    conectarRabbitMQ
} = require("./config/rabbitmq");

async function probar() {
    let conexion;
    let canal;

    try {
        ({ conexion, canal } = await conectarRabbitMQ());

        console.log("Conexión con RabbitMQ: OK.");

        const cola = await canal.checkQueue("pagos.comandos");

        console.log(
            "Solicitudes de pago en espera:",
            cola.messageCount
        );
    } catch (error) {
        console.error(
            "Falló la prueba:",
            error.message
        );

        process.exitCode = 1;
    } finally {
        if (canal) {
            await canal.close().catch(() => {});
        }

        if (conexion) {
            await conexion.close().catch(() => {});
        }
    }
}

probar();