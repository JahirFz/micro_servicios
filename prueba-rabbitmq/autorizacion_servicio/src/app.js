const express = require("express");
const rutasAuth = require("./rutas/auth");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));

app.use("/auth", rutasAuth);

app.use((req, res) => {
    res.status(404).json({
        error: {
            codigo: "RUTA_NO_ENCONTRADA",
            mensaje: "La ruta solicitada no existe."
        }
    });
});

app.use((error, req, res, next) => {
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({
            error: {
                codigo: "JSON_INVALIDO",
                mensaje: "El cuerpo debe contener JSON válido."
            }
        });
    }

    if (error.type === "entity.too.large") {
        return res.status(413).json({
            error: {
                codigo: "SOLICITUD_DEMASIADO_GRANDE",
                mensaje: "La solicitud supera el tamaño permitido."
            }
        });
    }

    console.error("Error HTTP:", error.code || error.name);

    res.status(500).json({
        error: {
            codigo: "ERROR_INTERNO",
            mensaje: "No se pudo completar la solicitud."
        }
    });
});

module.exports = app;