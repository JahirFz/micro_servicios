const path = require("node:path");
const amqp = require("amqplib");

require("dotenv").config({
    path: path.resolve(__dirname, "../../.env")
});

const EXCHANGE = "fertech";
const COLA_INVENTARIO = "inventario.comandos";

async function conectarRabbitMQ() {
    if (!process.env.RABBITMQ_URL) {
        throw new Error("Falta configurar RABBITMQ_URL.");
    }

    const conexion = await amqp.connect(
        process.env.RABBITMQ_URL,
        { timeout: 10000 }
    );

    conexion.on("error", (error) => {
        console.error("Error de conexión RabbitMQ:", error.message);
    });

    try {
        const canal = await conexion.createConfirmChannel();

        canal.on("error", (error) => {
            console.error("Error de canal RabbitMQ:", error.message);
        });

        await canal.assertExchange(EXCHANGE, "direct", {
            durable: true
        });

        await canal.assertQueue(COLA_INVENTARIO, {
            durable: true
        });

        await canal.bindQueue(
            COLA_INVENTARIO,
            EXCHANGE,
            COLA_INVENTARIO
        );

        // Cola de resultados que después consumirá Orders.
        await canal.assertQueue("pedidos.eventos", {
            durable: true
        });

        await canal.bindQueue(
            "pedidos.eventos",
            EXCHANGE,
            "pedidos.eventos"
        );

        // Mensajes inválidos o que agoten sus reintentos.
        await canal.assertQueue("inventario.errores", {
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
    COLA_INVENTARIO
};