const express = require("express");
const rutasPedidos = require("./rutas/pedidos");

const app = express();

const adminPedidos = require("./rutas/adminPedidos");

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));

app.use("/pedidos", rutasPedidos);

app.use("/admin/pedidos", adminPedidos);

app.use((req, res) => {
    res.status(404).json({
        error: {
            codigo: "RUTA_NO_ENCONTRADA",
            mensaje: "La ruta solicitada no existe."
        }
    });
});

app.use((error, req, res, next) => {
    const errores = {
        "entity.parse.failed": {
            estado: 400,
            codigo: "JSON_INVALIDO",
            mensaje: "El cuerpo debe contener JSON válido."
        },
        "entity.too.large": {
            estado: 413,
            codigo: "SOLICITUD_DEMASIADO_GRANDE",
            mensaje: "La solicitud supera el tamaño permitido."
        }
    };

    const conocido = errores[error.type];

    if (conocido) {
        return res.status(conocido.estado).json({
            error: {
                codigo: conocido.codigo,
                mensaje: conocido.mensaje
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