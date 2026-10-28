const express = require("express");
const repositorio = require("../repositorios/productoRepositorio");

const router = express.Router();

function responderErrorCatalogo(res, error) {
    console.error(
        "Error de catálogo:",
        error.code || error.message
    );

    return res.status(503).json({
        error: {
            codigo: "CATALOGO_NO_DISPONIBLE",
            mensaje: "No pudimos consultar los productos."
        }
    });
}

router.get("/", async (req, res) => {
    try {
        const productos = await repositorio.listarActivos();

        res.json({ productos });
    } catch (error) {
        responderErrorCatalogo(res, error);
    }
});

router.get("/:id", async (req, res) => {
    const valor = req.params.id;
    const id = Number(valor);

    if (
        !/^[1-9]\d*$/.test(valor) ||
        !Number.isSafeInteger(id) ||
        id > 2147483647
    ) {
        return res.status(400).json({
            error: {
                codigo: "ID_INVALIDO",
                mensaje: "El identificador debe ser un entero positivo válido."
            }
        });
    }

    try {
        const producto = await repositorio.buscarActivoPorId(id);

        if (!producto) {
            return res.status(404).json({
                error: {
                    codigo: "PRODUCTO_NO_ENCONTRADO",
                    mensaje: "El producto no está disponible."
                }
            });
        }

        res.json({ producto });
    } catch (error) {
        responderErrorCatalogo(res, error);
    }
});

module.exports = router;