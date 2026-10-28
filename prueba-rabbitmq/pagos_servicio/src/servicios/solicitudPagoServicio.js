const {
    ejecutarTransaccion
} = require("../config/db");

const {
    obtenerOCrearPago
} = require("../repositorios/pagoRepositorio");

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
        mensaje.tipo !== "ProcesarPago" ||
        mensaje.version !== 1 ||
        typeof mensaje.fecha !== "string" ||
        !Number.isFinite(Date.parse(mensaje.fecha)) ||
        !Number.isInteger(mensaje.id_pedido) ||
        mensaje.id_pedido < 1 ||
        mensaje.id_pedido > 2147483647 ||
        !mensaje.datos ||
        typeof mensaje.datos !== "object" ||
        Array.isArray(mensaje.datos)
    ) {
        throw new Error("Solicitud de pago inválida.");
    }

    if (
        mensaje.datos.metodo_pago !== "TARJETA_PRUEBA"
    ) {
        throw new Error("Método de pago no admitido.");
    }

    if (
        mensaje.datos.moneda !== "MXN" ||
        typeof mensaje.datos.total !== "string" ||
        !/^\d{1,10}\.\d{2}$/.test(mensaje.datos.total) ||
        BigInt(mensaje.datos.total.replace(".", "")) <= 0n
    ) {
        throw new Error("Monto o moneda inválidos.");
    }
}

async function registrarSolicitudPago(mensaje) {
    validarMensaje(mensaje);

    return ejecutarTransaccion(async (db, sesion) => {
        const registro = await registrarMensajeRecibido(
            db,
            sesion,
            mensaje
        );

        if (registro.duplicado) {
            return {
                duplicado: true,
                id_pedido: mensaje.id_pedido
            };
        }

        const resultado = await obtenerOCrearPago(
            db,
            sesion,
            {
                idPedido: mensaje.id_pedido,
                monto: mensaje.datos.total,
                moneda: mensaje.datos.moneda
            }
        );

        return {
            duplicado: !resultado.creado,
            id_pedido: mensaje.id_pedido,
            id_pago: resultado.pago._id.toString(),
            estado: resultado.pago.estado
        };
    });
}

module.exports = { registrarSolicitudPago };