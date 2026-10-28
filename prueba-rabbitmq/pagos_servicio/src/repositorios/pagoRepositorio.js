const { randomUUID } = require("node:crypto");
const { Decimal128, Int32 } = require("mongodb");

function validarSolicitud(idPedido, monto, moneda) {
    if (
        !Number.isInteger(idPedido) ||
        idPedido < 1 ||
        idPedido > 2147483647
    ) {
        throw new Error("Identificador de pedido inválido.");
    }

    if (
        typeof monto !== "string" ||
        !/^\d{1,10}\.\d{2}$/.test(monto)
    ) {
        throw new Error("Monto de pago inválido.");
    }

    const centavos = BigInt(monto.replace(".", ""));

    if (centavos <= 0n) {
        throw new Error("El monto debe ser mayor que cero.");
    }

    if (moneda !== "MXN") {
        throw new Error("Moneda de pago no admitida.");
    }

    return Decimal128.fromString(monto);
}

async function obtenerOCrearPago(
    db,
    sesion,
    { idPedido, monto, moneda }
) {
    const montoDecimal = validarSolicitud(
        idPedido,
        monto,
        moneda
    );

    const filtro = {
        id_pedido: new Int32(idPedido)
    };

    const existente = await db.collection("pagos").findOne(
        filtro,
        { session: sesion }
    );

    if (existente) {
        if (
            existente.monto.toString() !== montoDecimal.toString() ||
            existente.moneda !== moneda
        ) {
            throw new Error(
                "El pedido ya tiene un pago con otro monto o moneda."
            );
        }

        return {
            creado: false,
            pago: existente
        };
    }

    const ahora = new Date();

    const pago = {
        id_pedido: new Int32(idPedido),
        id_operacion_pago: randomUUID(),
        monto: montoDecimal,
        moneda,
        estado: "PENDIENTE",
        requiere_resolucion: false,
        referencia_simulada: null,
        motivo_fallo: null,
        creado_en: ahora,
        actualizado_en: ahora
    };

    const resultado = await db.collection("pagos").insertOne(
        pago,
        { session: sesion }
    );

    return {
        creado: true,
        pago: {
            ...pago,
            _id: resultado.insertedId
        }
    };
}

module.exports = { obtenerOCrearPago };