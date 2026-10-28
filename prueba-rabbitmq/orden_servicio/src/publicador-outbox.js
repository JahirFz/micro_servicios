const pool = require("./config/db");

const {
    conectarRabbitMQ,
    EXCHANGE
} = require("./config/rabbitmq");

function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function publicarConfirmado(canal, fila) {
    return new Promise((resolve, reject) => {
        let terminado = false;

        const temporizador = setTimeout(() => {
            finalizar(new Error(
                "Se agotó la espera de confirmación de RabbitMQ."
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
                `No hay una cola para ${fila.routing_key}.`
            ));
        }

        canal.on("return", devuelto);

        try {
            // MySQL/MariaDB puede devolver JSON como texto u objeto.
            const mensaje = typeof fila.payload === "string"
                ? JSON.parse(fila.payload)
                : fila.payload;

            if (
                !mensaje
                || mensaje.message_id !== fila.message_id
                || mensaje.tipo !== fila.tipo
            ) {
                throw new Error(
                    "El contenido de outbox es inconsistente."
                );
            }

            canal.publish(
                EXCHANGE,
                fila.routing_key,
                Buffer.from(JSON.stringify(mensaje)),
                {
                    persistent: true,
                    mandatory: true,
                    contentType: "application/json",
                    messageId: fila.message_id,
                    type: fila.tipo
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
    let detener = false;

    process.once("SIGINT", () => {
        detener = true;
        console.log("Terminando la publicación actual...");
    });

    try {
        await pool.execute("SELECT 1");

        const recursos = await conectarRabbitMQ();
        conexion = recursos.conexion;
        canal = recursos.canal;

        conexion.once("close", () => {
            if (!detener) {
                console.error(
                    "RabbitMQ se desconectó. Reinicia el publicador."
                );
                process.exitCode = 1;
            }

            detener = true;
        });

        canal.once("close", () => {
            if (!detener) {
                console.error(
                    "El canal se cerró. Reinicia el publicador."
                );
                process.exitCode = 1;
            }

            detener = true;
        });

        console.log("Publicador de outbox iniciado.");

        while (!detener) {
            const [filas] = await pool.execute(`
                SELECT
                    id_outbox,
                    message_id,
                    tipo,
                    routing_key,
                    payload
                FROM outbox
                WHERE estado_publicacion = 'PENDIENTE'
                  AND (
                      proximo_intento_en IS NULL
                      OR proximo_intento_en <= UTC_TIMESTAMP(3)
                  )
                ORDER BY id_outbox
                LIMIT 1
            `);

            if (filas.length === 0) {
                await esperar(1000);
                continue;
            }

            const fila = filas[0];

            await pool.execute(`
                UPDATE outbox
                SET intentos = intentos + 1
                WHERE id_outbox = ?
                  AND estado_publicacion = 'PENDIENTE'
            `, [fila.id_outbox]);

            await publicarConfirmado(canal, fila);

            const [actualizacion] = await pool.execute(`
                UPDATE outbox
                SET estado_publicacion = 'PUBLICADO',
                    publicado_en = UTC_TIMESTAMP(3),
                    proximo_intento_en = NULL
                WHERE id_outbox = ?
                  AND estado_publicacion = 'PENDIENTE'
            `, [fila.id_outbox]);

            if (actualizacion.affectedRows !== 1) {
                throw new Error(
                    "No se pudo registrar la publicación en MySQL."
                );
            }

            console.log(
                "Publicado:",
                fila.tipo,
                "| message_id:",
                fila.message_id
            );
        }
    } finally {
        detener = true;

        if (canal) {
            await canal.close().catch(() => {});
        }

        if (conexion) {
            await conexion.close().catch(() => {});
        }

        await pool.end();
    }
}

iniciar().catch((error) => {
    console.error(
        "Publicador detenido:",
        error.code || error.message
    );

    console.error(
        "Los mensajes sin publicación registrada permanecen PENDIENTE."
    );

    process.exitCode = 1;
});