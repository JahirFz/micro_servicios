const { Int32 } = require("mongodb");

const {
    ejecutarTransaccion
} = require("../config/db");

const {
    guardarMensajeSalida
} = require("../repositorios/mensajeriaRepositorio");

const banco = require("./bancoCliente");

async function prepararOperacion(idPedido) {
    return ejecutarTransaccion(async (db, sesion) => {
        const pagos = db.collection("pagos");

        const pago = await pagos.findOne(
            { id_pedido: new Int32(idPedido) },
            { session: sesion }
        );

        if (!pago) {
            throw new Error("El pago no existe.");
        }

        if (
            pago.estado !== "PENDIENTE" &&
            !pago.requiere_resolucion
        ) {
            return { finalizado: true, pago };
        }

        if (pago.requiere_resolucion) {
            return { resolver: true, pago };
        }

        await pagos.updateOne(
            { _id: pago._id },
            {
                $set: {
                    requiere_resolucion: true,
                    actualizado_en: new Date()
                }
            },
            { session: sesion }
        );

        return { resolver: false, pago };
    });
}

async function guardarResultado(idPedido, operacion, motivo) {
    return ejecutarTransaccion(async (db, sesion) => {
        const pagos = db.collection("pagos");

        const pago = await pagos.findOne(
            { id_pedido: new Int32(idPedido) },
            { session: sesion }
        );

        if (!pago) {
            throw new Error("El pago no existe.");
        }

        if (!pago.requiere_resolucion) {
            return {
                id_pedido: idPedido,
                estado: pago.estado,
                duplicado: true
            };
        }

        if (
            operacion.id_operacion_pago !==
            pago.id_operacion_pago
        ) {
            throw new Error("La referencia bancaria no coincide.");
        }

        const aprobado = operacion.estado === "APROBADO";

        if (
            ![
                "APROBADO",
                "RECHAZADO",
                "ANULADO",
                "SIN_CARGO"
            ].includes(operacion.estado)
        ) {
            throw new Error("La operación aún no está resuelta.");
        }

        if (
            aprobado &&
            (
                operacion.monto !== pago.monto.toString() ||
                operacion.moneda !== pago.moneda ||
                typeof operacion.referencia_simulada !== "string" ||
                operacion.referencia_simulada.length === 0
            )
        ) {
            throw new Error("Los datos del cobro no coinciden.");
        }

        const motivoFallo = aprobado
            ? null
            : motivo || `BANCO_${operacion.estado}`;

        await pagos.updateOne(
            { _id: pago._id },
            {
                $set: {
                    estado: operacion.estado,
                    requiere_resolucion: false,
                    referencia_simulada:
                        operacion.referencia_simulada || null,
                    motivo_fallo: motivoFallo,
                    actualizado_en: new Date()
                }
            },
            { session: sesion }
        );

        await guardarMensajeSalida(db, sesion, {
            tipo: aprobado ? "PagoAprobado" : "PagoFallido",
            routingKey: "pedidos.eventos",
            idPedido,
            datos: {
                id_pago: pago._id.toString(),
                id_operacion_pago: pago.id_operacion_pago,
                total: pago.monto.toString(),
                moneda: pago.moneda,
                referencia_simulada:
                    operacion.referencia_simulada || null,
                motivo: motivoFallo,
                pago_resuelto_sin_cargo: !aprobado
            }
        });

        return {
            id_pedido: idPedido,
            estado: operacion.estado,
            evento: aprobado ? "PagoAprobado" : "PagoFallido"
        };
    });
}

async function procesarPagoPendiente(idPedido) {
    if (
        !Number.isInteger(idPedido) ||
        idPedido < 1 ||
        idPedido > 2147483647
    ) {
        throw new Error("Identificador de pedido inválido.");
    }

    const preparacion = await prepararOperacion(idPedido);

    if (preparacion.finalizado) {
        return {
            id_pedido: idPedido,
            estado: preparacion.pago.estado,
            duplicado: true
        };
    }

    const pago = preparacion.pago;
    let operacion;
    let motivo = null;

    if (preparacion.resolver) {
        // Una ejecución anterior pudo haber enviado el cobro.
        // Cerrar esa operación antes de darla por fallida.
        motivo = "OPERACION_RECUPERADA";
        operacion = await banco.anularOperacion(
            pago.id_operacion_pago
        );
    } else {
        try {
            operacion = await banco.procesarPago({
                idOperacion: pago.id_operacion_pago,
                monto: pago.monto.toString(),
                moneda: pago.moneda
            });
        } catch (error) {
            motivo = error.code || "BANCO_COMUNICACION";
        }

        if (!operacion || operacion.estado === "PENDIENTE") {
            motivo = motivo || "BANCO_OPERACION_PENDIENTE";

            operacion = await banco.anularOperacion(
                pago.id_operacion_pago
            );
        }
    }

    // Una anulación debe garantizar que ya no hay un cargo.
    if (
        motivo &&
        !["ANULADO", "SIN_CARGO", "RECHAZADO"].includes(
            operacion.estado
        )
    ) {
        throw new Error(
            "El banco todavía no confirmó la resolución sin cargo."
        );
    }

    return guardarResultado(idPedido, operacion, motivo);
}

module.exports = { procesarPagoPendiente };