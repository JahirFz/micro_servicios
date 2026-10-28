const ejecutarTransaccion = require("../config/transaccion");

const {
    registrarMensajeRecibido,
    guardarMensajeSalida
} = require("../repositorios/mensajeriaRepositorio");

const {
    reservarInventario
} = require("./reservaServicio");

const {
    confirmarReserva,
    liberarReserva
} = require("./estadoReservaServicio");

const TIPOS_ADMITIDOS = new Set([
    "ReservarInventario",
    "ConfirmarReserva",
    "LiberarReserva"
]);

function validarMensaje(mensaje) {
    if (
        !mensaje
        || typeof mensaje !== "object"
        || Array.isArray(mensaje)
    ) {
        throw new Error("El mensaje debe ser un objeto.");
    }

    const formatoUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
        typeof mensaje.message_id !== "string"
        || !formatoUuid.test(mensaje.message_id)
    ) {
        throw new Error("message_id debe tener formato UUID.");
    }

    if (!TIPOS_ADMITIDOS.has(mensaje.tipo)) {
        throw new Error("Tipo de mensaje no admitido.");
    }

    if (mensaje.version !== 1) {
        throw new Error("Versión de mensaje no admitida.");
    }

    if (
        typeof mensaje.fecha !== "string"
        || !Number.isFinite(Date.parse(mensaje.fecha))
    ) {
        throw new Error("La fecha del mensaje es inválida.");
    }

    if (
        !Number.isInteger(mensaje.id_pedido)
        || mensaje.id_pedido <= 0
        || mensaje.id_pedido > 2147483647
    ) {
        throw new Error("El identificador del pedido es inválido.");
    }

    if (
        !mensaje.datos
        || typeof mensaje.datos !== "object"
        || Array.isArray(mensaje.datos)
    ) {
        throw new Error("datos debe ser un objeto.");
    }
}

async function manejarMensajeInventario(mensaje) {
    validarMensaje(mensaje);

    return ejecutarTransaccion(async (conexion) => {
        const recibido = await registrarMensajeRecibido(
            conexion,
            mensaje.message_id,
            mensaje.tipo
        );

        if (recibido.duplicado) {
            return {
                duplicado: true,
                id_pedido: mensaje.id_pedido
            };
        }

        let resultado;
        let tipoRespuesta;
        let datosRespuesta;

        switch (mensaje.tipo) {
            case "ReservarInventario":
                resultado = await reservarInventario(
                    conexion,
                    mensaje.id_pedido,
                    mensaje.datos.productos
                );

                if (resultado.resultado === "RESERVADO") {
                    tipoRespuesta = "InventarioReservado";

                    datosRespuesta = {
                        moneda: "MXN",
                        productos: resultado.productos.map(
                            (producto) => ({
                                id_producto: producto.id_producto,
                                cantidad: producto.cantidad,
                                nombre_producto: producto.nombre_producto,
                                precio_unitario: producto.precio_unitario
                            })
                        )
                    };
                } else {
                    tipoRespuesta = "InventarioRechazado";

                    datosRespuesta = {
                        motivo: resultado.motivo
                    };
                }

                break;

            case "ConfirmarReserva":
                resultado = await confirmarReserva(
                    conexion,
                    mensaje.id_pedido
                );

                tipoRespuesta = "ReservaConfirmada";
                datosRespuesta = {};
                break;

            case "LiberarReserva":
                resultado = await liberarReserva(
                    conexion,
                    mensaje.id_pedido
                );

                tipoRespuesta = "ReservaLiberada";

                datosRespuesta = {
                    sin_reservas: resultado.sin_reservas === true
                };

                break;
        }

        // Mismo pedido y operación, pero con otro message_id.
        // La primera ejecución ya dejó su respuesta en outbox.
        if (resultado.duplicado) {
            return {
                duplicado: true,
                id_pedido: mensaje.id_pedido,
                operacion_ya_realizada: true
            };
        }

        const respuesta = await guardarMensajeSalida(
            conexion,
            tipoRespuesta,
            mensaje.id_pedido,
            datosRespuesta
        );

        return {
            duplicado: false,
            id_pedido: mensaje.id_pedido,
            respuesta
        };
    });
}

module.exports = {
    manejarMensajeInventario
};