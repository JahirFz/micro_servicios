const pool = require("./config/db");

const {
    conectarRabbitMQ,
    COLA_PEDIDOS,
    COLA_ERRORES
} = require("./config/rabbitmq");

const {
    manejarEvento
} = require("./servicios/manejadorEventos");

const ERRORES_TEMPORALES = new Set([
    "ER_LOCK_DEADLOCK",
    "ER_LOCK_WAIT_TIMEOUT",
    "ECONNRESET",
    "ECONNREFUSED",
    "PROTOCOL_CONNECTION_LOST",
    "ETIMEDOUT"
]);

function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function procesarConReintentos(mensaje) {
    for (let intento = 1; intento <= 3; intento++) {
        try {
            return await manejarEvento(mensaje);
        } catch (error) {
            const puedeReintentar =
                ERRORES_TEMPORALES.has(error.code) &&
                intento < 3;

            if (!puedeReintentar) {
                throw error;
            }

            console.warn(
                `Fallo temporal ${error.code}. Reintento ${intento}/2.`
            );

            await esperar(500 * intento);
        }
    }
}

function guardarEnColaErrores(canal, entrega, error) {
    return new Promise((resolve, reject) => {
        let finalizado = false;

        const temporizador = setTimeout(() => {
            terminar(new Error(
                "RabbitMQ no confirmó el mensaje de error."
            ));
        }, 10000);

        function terminar(fallo) {
            if (finalizado) return;

            finalizado = true;
            clearTimeout(temporizador);
            canal.removeListener("return", devuelto);

            if (fallo) reject(fallo);
            else resolve();
        }

        function devuelto() {
            terminar(new Error(
                `No se pudo enrutar a ${COLA_ERRORES}.`
            ));
        }

        canal.on("return", devuelto);

        try {
            canal.sendToQueue(
                COLA_ERRORES,
                entrega.content,
                {
                    persistent: true,
                    mandatory: true,
                    contentType: entrega.properties.contentType,
                    messageId: entrega.properties.messageId,
                    headers: {
                        ...entrega.properties.headers,
                        "fertech-error": String(
                            error.code || error.message
                        ).slice(0, 500),
                        "fertech-fecha-error":
                            new Date().toISOString()
                    }
                },
                (fallo) => terminar(fallo)
            );
        } catch (fallo) {
            terminar(fallo);
        }
    });
}

async function iniciar() {
    await pool.execute("SELECT 1");

    const { conexion, canal } = await conectarRabbitMQ();

    let detenido = false;

    conexion.once("close", () => {
        detenido = true;
        process.exitCode = 1;

        console.error(
            "Conexión RabbitMQ cerrada. Reinicia el consumidor."
        );

        pool.end().catch(error => {
            console.error(
                "Error al cerrar MySQL:",
                error.message
            );
        });
    });

    await canal.prefetch(1);

    async function procesarEntrega(entrega) {
        if (entrega === null) {
            throw new Error("RabbitMQ canceló el consumidor.");
        }

        if (detenido) return;

        try {
            const mensaje = JSON.parse(
                entrega.content.toString("utf8")
            );

            const resultado = await procesarConReintentos(
                mensaje
            );

            if (detenido) return;

            canal.ack(entrega);

            console.log(
                "Evento procesado. Pedido:",
                mensaje.id_pedido,
                resultado
            );
        } catch (error) {
            if (detenido) return;

            console.error(
                "No se completó la operación:",
                error.code || error.message
            );

            await guardarEnColaErrores(
                canal,
                entrega,
                error
            );

            if (!detenido) {
                canal.ack(entrega);

                console.log(
                    `Mensaje conservado en ${COLA_ERRORES}.`
                );
            }
        }
    }

    await canal.consume(
        COLA_PEDIDOS,
        (entrega) => {
            procesarEntrega(entrega).catch(async (error) => {
                if (detenido) return;

                detenido = true;
                process.exitCode = 1;

                console.error(
                    "Consumidor detenido:",
                    error.message
                );

                // Sin ACK: RabbitMQ podrá volver a entregar
                // el mensaje cuando reiniciemos el consumidor.
                await conexion.close().catch(() => {});
            });
        },
        { noAck: false }
    );

    console.log(
        `Pedidos esperando mensajes en ${COLA_PEDIDOS}...`
    );
}

iniciar().catch(async (error) => {
    console.error(
        "No se pudo iniciar el consumidor:",
        error.code || error.message
    );

    await pool.end().catch(() => {});
    process.exitCode = 1;
});