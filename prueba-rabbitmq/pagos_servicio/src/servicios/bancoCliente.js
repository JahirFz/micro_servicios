const path = require("node:path");

require("dotenv").config({
    path: path.resolve(__dirname, "../../.env")
});

const {
    crearCircuitBreaker
} = require("./circuitBreaker");

const circuitoCobros = crearCircuitBreaker({
    limiteFallos: 3,
    esperaMs: 10000
});

const bancoUrl = (
    process.env.BANCO_URL || "http://127.0.0.1:3005"
).replace(/\/$/, "");

const timeout = Number(
    process.env.BANCO_TIMEOUT_MS || 2000
);

if (!Number.isInteger(timeout) || timeout < 1) {
    throw new Error("BANCO_TIMEOUT_MS inválido.");
}

const ESTADOS = new Set([
    "PENDIENTE",
    "APROBADO",
    "RECHAZADO",
    "ANULADO",
    "SIN_CARGO"
]);

async function solicitar(ruta, metodo, cuerpo, idOperacion) {
    const controlador = new AbortController();

    const temporizador = setTimeout(() => {
        controlador.abort();
    }, timeout);

    try {
        const respuesta = await fetch(`${bancoUrl}${ruta}`, {
            method: metodo,
            headers: cuerpo
                ? { "Content-Type": "application/json" }
                : {},
            body: cuerpo ? JSON.stringify(cuerpo) : undefined,
            signal: controlador.signal,
            redirect: "error"
        });

        if (!respuesta.ok) {
            const error = new Error(
                `El banco respondió HTTP ${respuesta.status}.`
            );

            error.code = "BANCO_HTTP";
            error.status = respuesta.status;

            throw error;
        }

        const operacion = await respuesta.json();

        if (
            !operacion ||
            operacion.id_operacion_pago !== idOperacion ||
            !ESTADOS.has(operacion.estado)
        ) {
            const error = new Error(
                "El banco devolvió una respuesta inválida."
            );

            error.code = "BANCO_RESPUESTA_INVALIDA";
            throw error;
        }

        return operacion;
    } catch (error) {
        if (controlador.signal.aborted) {
            const fallo = new Error(
                "El banco superó el tiempo máximo de respuesta."
            );

            fallo.code = "BANCO_TIMEOUT";
            throw fallo;
        }

        if (error.code) {
            throw error;
        }

        const fallo = new Error(
            "No se pudo completar la comunicación con el banco."
        );

        fallo.code = "BANCO_COMUNICACION";
        throw fallo;
    } finally {
        clearTimeout(temporizador);
    }
}

function procesarPago({ idOperacion, monto, moneda }) {
    return circuitoCobros.ejecutar(() =>
        solicitar(
            "/operaciones",
            "POST",
            {
                id_operacion_pago: idOperacion,
                monto,
                moneda
            },
            idOperacion
        )
    );
}

function consultarOperacion(idOperacion) {
    return solicitar(
        `/operaciones/${encodeURIComponent(idOperacion)}`,
        "GET",
        undefined,
        idOperacion
    );
}

function anularOperacion(idOperacion) {
    return solicitar(
        `/operaciones/${encodeURIComponent(idOperacion)}/anular`,
        "POST",
        undefined,
        idOperacion
    );
}

module.exports = {
    procesarPago,
    consultarOperacion,
    anularOperacion
};