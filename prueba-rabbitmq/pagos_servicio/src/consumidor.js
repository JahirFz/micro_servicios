const {
    conectarMongoDB,
    cerrarMongoDB
} = require("./config/db");

const {
    conectarRabbitMQ,
    COLA_PAGOS,
    COLA_ERRORES
} = require("./config/rabbitmq");

const {
    registrarSolicitudPago
} = require("./servicios/solicitudPagoServicio");

function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function esErrorTemporal(error) {
    return (
        error.code === 11000 ||
        error.hasErrorLabel?.("TransientTransactionError") ||
        error.hasErrorLabel?.("UnknownTransactionCommitResult") ||
        [
            "MongoNetworkError",
            "MongoNetworkTimeoutError",
            "MongoServerSelectionError"
        ].includes(error.name)
    );
}

async function procesarConReintentos(mensaje) {
    for (let intento = 1; intento <= 3; intento++) {
        try {
            return await registrarSolicitudPago(mensaje);
        } catch (error) {
            if (!esErrorTemporal(error) || intento === 3) {
                throw error;
            }

            console.warn(
                `Fallo temporal. Reintento ${intento}/2.`
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
    await conectarMongoDB();

    const { conexion, canal } = await conectarRabbitMQ();

    let detenido = false;

    conexion.once("close", () => {
        detenido = true;
        process.exitCode = 1;

        console.error(
            "Conexión RabbitMQ cerrada. Reinicia el consumidor."
        );

        cerrarMongoDB().catch(error => {
            console.error(
                "Error al cerrar MongoDB:",
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

            // Confirmar solo después de guardar en MongoDB.
            canal.ack(entrega);

            console.log(
                "Solicitud de pago registrada:",
                resultado
            );
        } catch (error) {
            if (detenido) return;

            console.error(
                "No se pudo registrar el pago:",
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
        COLA_PAGOS,
        (entrega) => {
            procesarEntrega(entrega).catch(async (error) => {
                if (detenido) return;

                detenido = true;
                process.exitCode = 1;

                console.error(
                    "Consumidor detenido:",
                    error.message
                );

                // Sin ACK si no pudimos conservar el mensaje.
                await conexion.close().catch(() => {});
            });
        },
        { noAck: false }
    );

    console.log(
        `Pagos esperando mensajes en ${COLA_PAGOS}...`
    );
}

iniciar().catch(async (error) => {
    console.error(
        "No se pudo iniciar el consumidor:",
        error.message
    );

    await cerrarMongoDB().catch(() => {});
    process.exitCode = 1;
});