const path = require("node:path");
const amqp = require("amqplib");

require("dotenv").config({
    path: path.resolve(__dirname, "../../.env")
});

const EXCHANGE = "fertech";
const COLA_PAGOS = "pagos.comandos";
const COLA_EVENTOS = "pedidos.eventos";
const COLA_ERRORES = "pagos.errores";

async function conectarRabbitMQ() {
    if (!process.env.RABBITMQ_URL) {
        throw new Error("Falta configurar RABBITMQ_URL.");
    }

    const conexion = await amqp.connect(
        process.env.RABBITMQ_URL,
        { timeout: 10000 }
    );

    conexion.on("error", (error) => {
        console.error(
            "Error de conexión RabbitMQ:",
            error.message
        );
    });

    try {
        const canal = await conexion.createConfirmChannel();

        canal.on("error", (error) => {
            console.error(
                "Error de canal RabbitMQ:",
                error.message
            );
        });

        await canal.assertExchange(EXCHANGE, "direct", {
            durable: true
        });

        for (const cola of [COLA_PAGOS, COLA_EVENTOS]) {
            await canal.assertQueue(cola, {
                durable: true
            });

            await canal.bindQueue(
                cola,
                EXCHANGE,
                cola
            );
        }

        await canal.assertQueue(COLA_ERRORES, {
            durable: true
        });

        return { conexion, canal };
    } catch (error) {
        await conexion.close().catch(() => {});
        throw error;
    }
}

module.exports = {
    conectarRabbitMQ,
    EXCHANGE,
    COLA_PAGOS,
    COLA_EVENTOS,
    COLA_ERRORES
};