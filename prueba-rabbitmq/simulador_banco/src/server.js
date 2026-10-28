const path = require("node:path");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const express = require("express");

require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const puerto = Number(process.env.PORT || 3005);
const escenario = process.env.BANCO_ESCENARIO || "APROBADO";
const demora = Number(process.env.BANCO_DEMORA_MS || 200);

if (
    !Number.isInteger(puerto) ||
    puerto < 1 ||
    puerto > 65535 ||
    !["APROBADO", "RECHAZADO"].includes(escenario) ||
    !Number.isInteger(demora) ||
    demora < 0 ||
    demora > 60000
) {
    throw new Error("Configuración del banco inválida.");
}

const carpeta = path.resolve(__dirname, "../datos");
const archivo = path.join(carpeta, "operaciones.json");

fs.mkdirSync(carpeta, { recursive: true });

let operaciones = fs.existsSync(archivo)
    ? JSON.parse(fs.readFileSync(archivo, "utf8"))
    : {};

function guardar(id, operacion) {
    const nuevas = { ...operaciones, [id]: operacion };
    const temporal = `${archivo}.tmp`;

    fs.writeFileSync(
        temporal,
        JSON.stringify(nuevas, null, 2),
        "utf8"
    );

    fs.renameSync(temporal, archivo);
    operaciones = nuevas;
}

const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validarId(req, res, next) {
    if (!uuid.test(req.params.id)) {
        return res.status(400).json({
            error: "Identificador de operación inválido."
        });
    }

    next();
}

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});

app.post("/operaciones", (req, res, next) => {
    try {
        const {
            id_operacion_pago: id,
            monto,
            moneda
        } = req.body || {};

        if (
            typeof id !== "string" ||
            !uuid.test(id) ||
            typeof monto !== "string" ||
            !/^\d{1,10}\.\d{2}$/.test(monto) ||
            BigInt(monto.replace(".", "")) <= 0n ||
            moneda !== "MXN"
        ) {
            return res.status(400).json({
                error: "Solicitud de operación inválida."
            });
        }

        const existente = operaciones[id];

        if (existente) {
            if (
                existente.monto !== null &&
                (
                    existente.monto !== monto ||
                    existente.moneda !== moneda
                )
            ) {
                return res.status(409).json({
                    error: "La operación ya tiene otro monto o moneda."
                });
            }

            // Repetir la solicitud nunca crea otro cobro.
            return res.json(existente);
        }

        const ahora = new Date().toISOString();

        guardar(id, {
            id_operacion_pago: id,
            monto,
            moneda,
            estado: "PENDIENTE",
            referencia_simulada: null,
            creado_en: ahora,
            actualizado_en: ahora
        });

        setTimeout(() => {
            try {
                const actual = operaciones[id];

                // Una anulación previa impide aprobar el cobro.
                if (actual.estado === "PENDIENTE") {
                    guardar(id, {
                        ...actual,
                        estado: escenario,
                        referencia_simulada:
                            escenario === "APROBADO"
                                ? `SIM-${randomUUID()}`
                                : null,
                        actualizado_en: new Date().toISOString()
                    });
                }

                if (!res.destroyed && !res.writableEnded) {
                    res.json(operaciones[id]);
                }
            } catch (error) {
                next(error);
            }
        }, demora);
    } catch (error) {
        next(error);
    }
});

app.get("/operaciones/:id", validarId, (req, res) => {
    const operacion = operaciones[req.params.id];

    if (!operacion) {
        return res.status(404).json({
            error: "Operación no encontrada."
        });
    }

    res.json(operacion);
});

app.post("/operaciones/:id/anular", validarId, (req, res, next) => {
    try {
        const id = req.params.id;
        const actual = operaciones[id];
        const ahora = new Date().toISOString();

        if (!actual) {
            // Bloquear también una solicitud que llegue tarde.
            guardar(id, {
                id_operacion_pago: id,
                monto: null,
                moneda: "MXN",
                estado: "SIN_CARGO",
                referencia_simulada: null,
                creado_en: ahora,
                actualizado_en: ahora
            });
        } else if (actual.estado === "APROBADO") {
            guardar(id, {
                ...actual,
                estado: "ANULADO",
                actualizado_en: ahora
            });
        } else if (actual.estado === "PENDIENTE") {
            guardar(id, {
                ...actual,
                estado: "SIN_CARGO",
                actualizado_en: ahora
            });
        }

        res.json(operaciones[id]);
    } catch (error) {
        next(error);
    }
});

// Tras un reinicio, los temporizadores anteriores ya no existen.
// Las operaciones pendientes se cierran sin cargo.
for (const [id, operacion] of Object.entries(operaciones)) {
    if (operacion.estado === "PENDIENTE") {
        guardar(id, {
            ...operacion,
            estado: "SIN_CARGO",
            actualizado_en: new Date().toISOString()
        });
    }
}

app.use((req, res) => {
    res.status(404).json({ error: "Ruta no encontrada." });
});

app.use((error, req, res, next) => {
    console.error("Error del banco:", error.message);

    if (res.headersSent) return next(error);

    const estado = error.status === 400
        ? 400
        : error.status === 413
            ? 413
            : 500;

    res.status(estado).json({
        error: estado === 500
            ? "No se pudo completar la operación."
            : "Solicitud inválida o demasiado grande."
    });
});

const servidor = app.listen(puerto, "127.0.0.1", () => {
    console.log(`Banco simulado en http://127.0.0.1:${puerto}`);
    console.log(`Escenario: ${escenario}. Demora: ${demora} ms.`);
});

servidor.on("error", (error) => {
    console.error("No se pudo iniciar el banco:", error.message);
    process.exitCode = 1;
});