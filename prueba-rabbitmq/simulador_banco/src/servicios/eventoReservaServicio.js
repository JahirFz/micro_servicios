const ejecutarTransaccion = require("../config/transaccion");

const {
    registrarMensajeRecibido
} = require("../repositorios/mensajeriaRepositorio");

function validarMensaje(mensaje) {
    const uuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
        !mensaje ||
        typeof mensaje !== "object" ||
        typeof mensaje.message_id !== "string" ||
        !uuid.test(mensaje.message_id) ||
        mensaje.version !== 1 ||
        typeof mensaje.fecha !== "string" ||
        !Number.isFinite(Date.parse(mensaje.fecha)) ||
        !Number.isInteger(mensaje.id_pedido) ||
        mensaje.id_pedido < 1 ||
        mensaje.id_pedido > 2147483647 ||
        !["ReservaConfirmada", "ReservaLiberada"].includes(
            mensaje.tipo
        ) ||
        !mensaje.datos ||
        typeof mensaje.datos !== "object" ||
        Array.isArray(mensaje.datos)
    ) {
        throw new Error("Evento de reserva inválido.");
    }
}

async function procesarEventoReserva(mensaje) {
    validarMensaje(mensaje);

    return ejecutarTransaccion(async (conexion) => {
        const [filas] = await conexion.execute(
            `SELECT
                 id_pedido,
                 estado,
                 fase_saga,
                 pago_resuelto_sin_cargo
             FROM pedido
             WHERE id_pedido = ?
             FOR UPDATE`,
            [mensaje.id_pedido]
        );

        if (filas.length === 0) {
            const error = new Error("El pedido no existe.");
            error.code = "PEDIDO_DESCONOCIDO";
            throw error;
        }

        const registro = await registrarMensajeRecibido(
            conexion,
            mensaje
        );

        if (registro.duplicado) {
            return {
                duplicado: true,
                id_pedido: mensaje.id_pedido
            };
        }

        const pedido = filas[0];

        if (pedido.estado !== "PENDING") {
            return {
                ignorado: true,
                id_pedido: mensaje.id_pedido
            };
        }

        if (mensaje.tipo === "ReservaConfirmada") {
            if (pedido.fase_saga !== "CONFIRMANDO") {
                throw new Error(
                    "El pedido no está esperando confirmar la reserva."
                );
            }

            await conexion.execute(
                `UPDATE pedido
                 SET estado = 'CONFIRMED',
                     fase_saga = 'FINALIZADA'
                 WHERE id_pedido = ?`,
                [mensaje.id_pedido]
            );

            return {
                id_pedido: mensaje.id_pedido,
                estado: "CONFIRMED"
            };
        }

        if (
            pedido.fase_saga !== "COMPENSANDO" ||
            !pedido.pago_resuelto_sin_cargo
        ) {
            throw new Error(
                "No se puede cancelar sin resolver antes el pago."
            );
        }

        await conexion.execute(
            `UPDATE pedido
             SET estado = 'CANCELLED',
                 fase_saga = 'FINALIZADA',
                 inventario_liberado = TRUE
             WHERE id_pedido = ?`,
            [mensaje.id_pedido]
        );

        return {
            id_pedido: mensaje.id_pedido,
            estado: "CANCELLED"
        };
    });
}

module.exports = { procesarEventoReserva };