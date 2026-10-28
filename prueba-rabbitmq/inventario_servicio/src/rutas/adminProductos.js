const express = require("express");
const autenticar = require("../middlewares/autenticar");
const requerirAdmin = require("../middlewares/requerirAdmin");

const {
    listarProductos,
    obtenerResumenInventario
} = require("../repositorios/adminProductoRepositorio");

const router = express.Router();

router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});

router.use(autenticar, requerirAdmin);

router.get("/resumen", async (req, res) => {
    try {
        res.json(await obtenerResumenInventario());
    } catch (error) {
        console.error(
            "No se pudo consultar el resumen de inventario:",
            error.code || error.name
        );

        res.status(503).json({
            error: {
                codigo: "RESUMEN_NO_DISPONIBLE",
                mensaje: "No pudimos consultar el resumen de inventario."
            }
        });
    }
});

router.get("/", async (req, res) => {
    const texto = req.query.antes_de;
    const antesDe = texto === undefined ? null : Number(texto);

    if (
        texto !== undefined &&
        (
            typeof texto !== "string" ||
            !/^[1-9]\d*$/.test(texto) ||
            !Number.isSafeInteger(antesDe) ||
            antesDe > 2147483647
        )
    ) {
        return res.status(400).json({
            error: {
                codigo: "PAGINACION_INVALIDA",
                mensaje: "El cursor de productos no es válido."
            }
        });
    }

    try {
        res.json(await listarProductos(antesDe));
    } catch (error) {
        console.error(
            "No se pudo consultar el inventario:",
            error.code || error.name
        );

        res.status(503).json({
            error: {
                codigo: "INVENTARIO_NO_DISPONIBLE",
                mensaje: "No pudimos consultar el inventario."
            }
        });
    }
});

module.exports = router;