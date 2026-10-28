const ejecutarTransaccion = require("../config/transaccion");

const {
    registrarMensajeRecibido,
    guardarMensajeSalida
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
        !["PagoAprobado", "PagoFallido"].includes(mensaje.tipo) ||
        !mensaje.datos ||
        typeof mensaje.datos !== "object" ||
        Array.isArray(mensaje.datos)
    ) {
        throw new Error("Evento de pago inválido.");
    }

    const datos = mensaje.datos;

    if (
        typeof datos.id_pago !== "string" ||
        !/^[0-9a-f]{24}$/i.test(datos.id_pago) ||
        typeof datos.id_operacion_pago !== "string" ||
        !uuid.test(datos.id_operacion_pago) ||
        typeof datos.total !== "string" ||
        !/^\d{1,10}\.\d{2}$/.test(datos.total) ||
        BigInt(datos.total.replace(".", "")) <= 0n ||
        datos.moneda !== "MXN"
    ) {
        throw new Error("Datos del pago inválidos.");
    }

    if (
        mensaje.tipo === "PagoAprobado" &&
        (
            typeof datos.referencia_simulada !== "string" ||
            datos.referencia_simulada.length === 0 ||
            datos.pago_resuelto_sin_cargo !== false
        )
    ) {
        throw new Error("La aprobación del pago es inválida.");
    }

    if (
        mensaje.tipo === "PagoFallido" &&
        (
            datos.pago_resuelto_sin_cargo !== true ||
            typeof datos.motivo !== "string" ||
            datos.motivo.trim().length === 0 ||
            datos.motivo.length > 255
        )
    ) {
        throw new Error(
            "El fallo debe confirmar que no queda un cargo."
        );
    }
}

async function procesarEventoPago(mensaje) {
    validarMensaje(mensaje);

    return ejecutarTransaccion(async (conexion) => {
        const [filas] = await conexion.execute(
            `SELECT id_pedido, estado, fase_saga, total, moneda
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

        if (
            pedido.estado !== "PENDING" ||
            pedido.fase_saga !== "PAGANDO"
        ) {
            return {
                ignorado: true,
                id_pedido: mensaje.id_pedido
            };
        }

        if (
            pedido.total !== mensaje.datos.total ||
            pedido.moneda !== mensaje.datos.moneda
        ) {
            throw new Error(
                "El monto del pago no coincide con el pedido."
            );
        }

        const aprobado = mensaje.tipo === "PagoAprobado";

        if (aprobado) {
            await conexion.execute(
                `UPDATE pedido
                 SET fase_saga = 'CONFIRMANDO'
                 WHERE id_pedido = ?`,
                [mensaje.id_pedido]
            );
        } else {
            await conexion.execute(
                `UPDATE pedido
                 SET fase_saga = 'COMPENSANDO',
                     motivo_cancelacion = ?,
                     pago_resuelto_sin_cargo = TRUE
                 WHERE id_pedido = ?`,
                [
                    mensaje.datos.motivo,
                    mensaje.id_pedido
                ]
            );
        }

        await guardarMensajeSalida(conexion, {
            tipo: aprobado
                ? "ConfirmarReserva"
                : "LiberarReserva",
            routingKey: "inventario.comandos",
            idPedido: mensaje.id_pedido,
            datos: {}
        });

        return {
            id_pedido: mensaje.id_pedido,
            estado: "PENDING",
            fase_saga: aprobado
                ? "CONFIRMANDO"
                : "COMPENSANDO"
        };
    });
}

module.exports = { procesarEventoPago };