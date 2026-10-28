const {
    conectarMongoDB,
    cerrarMongoDB
} = require("./config/db");

const {
    conectarRabbitMQ,
    EXCHANGE
} = require("./config/rabbitmq");

let detener = false;

function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function publicarConfirmado(canal, documento) {
    return new Promise((resolve, reject) => {
        let terminado = false;

        const temporizador = setTimeout(() => {
            finalizar(new Error(
                "RabbitMQ no confirmó la publicación."
            ));
        }, 10000);

        function finalizar(error) {
            if (terminado) return;

            terminado = true;
            clearTimeout(temporizador);
            canal.removeListener("return", devuelto);

            if (error) reject(error);
            else resolve();
        }

        function devuelto() {
            finalizar(new Error(
                "El mensaje no pudo llegar a una cola."
            ));
        }

        canal.on("return", devuelto);

        try {
            canal.publish(
                EXCHANGE,
                documento.routing_key,
                Buffer.from(JSON.stringify(documento.payload)),
                {
                    persistent: true,
                    mandatory: true,
                    contentType: "application/json",
                    messageId: documento.message_id,
                    type: documento.tipo
                },
                error => finalizar(error)
            );
        } catch (error) {
            finalizar(error);
        }
    });
}

async function iniciar() {
    let conexion;
    let canal;
    let falloConexion = null;

    try {
        const db = await conectarMongoDB();

        ({ conexion, canal } = await conectarRabbitMQ());

        conexion.on("close", () => {
            if (!detener) {
                falloConexion = new Error(
                    "La conexión RabbitMQ se cerró."
                );
                detener = true;
            }
        });

        canal.on("close", () => {
            if (!detener) {
                falloConexion = new Error(
                    "El canal RabbitMQ se cerró."
                );
                detener = true;
            }
        });

        const outbox = db.collection("outbox");

        console.log("Publicador de Pagos iniciado.");

        while (!detener) {
            const documento = await outbox.findOne(
                {
                    estado_publicacion: "PENDIENTE",
                    proximo_intento_en: {
                        $lte: new Date()
                    }
                },
                {
                    sort: { creado_en: 1, _id: 1 }
                }
            );

            if (!documento) {
                await esperar(500);
                continue;
            }

            await outbox.updateOne(
                {
                    _id: documento._id,
                    estado_publicacion: "PENDIENTE"
                },
                {
                    $inc: { intentos: 1 }
                }
            );

            await publicarConfirmado(canal, documento);

            const resultado = await outbox.updateOne(
                {
                    _id: documento._id,
                    estado_publicacion: "PENDIENTE"
                },
                {
                    $set: {
                        estado_publicacion: "PUBLICADO",
                        publicado_en: new Date()
                    }
                }
            );

            if (resultado.modifiedCount !== 1) {
                throw new Error(
                    "No se pudo registrar la publicación en MongoDB."
                );
            }

            console.log(
                "Publicado:",
                documento.tipo,
                "Pedido:",
                documento.payload.id_pedido
            );
        }

        if (falloConexion) {
            throw falloConexion;
        }
    } finally {
        detener = true;

        if (canal) {
            await canal.close().catch(() => {});
        }

        if (conexion) {
            await conexion.close().catch(() => {});
        }

        await cerrarMongoDB();
    }
}

process.once("SIGINT", () => {
    console.log("Terminando la publicación actual...");
    detener = true;
});

iniciar().catch(error => {
    console.error(
        "Publicador detenido:",
        error.message
    );

    process.exitCode = 1;
});