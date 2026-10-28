const { randomUUID, randomInt } = require("node:crypto");

const pool = require("./config/db");

const {
    conectarRabbitMQ,
    EXCHANGE,
    COLA_INVENTARIO
} = require("./config/rabbitmq");

async function enviarPrueba() {
    let conexion;
    let canal;

    try {
        const [productos] = await pool.execute(`
            SELECT id_producto, nombre, stock_disponible
            FROM producto
            WHERE activo = TRUE
              AND moneda = 'MXN'
              AND stock_disponible >= 1
            ORDER BY id_producto
            LIMIT 1
        `);

        if (productos.length === 0) {
            throw new Error("No hay productos disponibles para la prueba.");
        }

        const producto = productos[0];

        let idPedido;

        while (true) {
            const candidato = randomInt(1000000000, 2000000000);

            const [reservas] = await pool.execute(`
                SELECT id_pedido
                FROM reserva_pedido
                WHERE id_pedido = ?
            `, [candidato]);

            if (reservas.length === 0) {
                idPedido = candidato;
                break;
            }
        }

        const mensaje = {
            message_id: randomUUID(),
            tipo: "ReservarInventario",
            version: 1,
            fecha: new Date().toISOString(),
            id_pedido: idPedido,
            datos: {
                productos: [
                    {
                        id_producto: producto.id_producto,
                        cantidad: 1
                    }
                ]
            }
        };

        const recursos = await conectarRabbitMQ();
        conexion = recursos.conexion;
        canal = recursos.canal;

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

        console.log("RabbitMQ aceptó el comando.");
        console.log("ID del pedido de prueba:", idPedido);
        console.log("ID del producto:", producto.id_producto);
        console.log("Producto:", producto.nombre);
        console.log(
            "Stock observado antes del envío:",
            producto.stock_disponible
        );
        console.log("Cantidad solicitada: 1");
    } finally {
        if (canal) {
            await canal.close().catch(() => {});
        }

        if (conexion) {
            await conexion.close().catch(() => {});
        }

        await pool.end();
    }
}

enviarPrueba().catch((error) => {
    console.error(
        "Falló el envío:",
        error.code || error.message
    );

    process.exitCode = 1;
});