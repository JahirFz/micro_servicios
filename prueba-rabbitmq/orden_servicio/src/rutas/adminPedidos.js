const express = require("express");
const autenticar = require("../middlewares/autenticar");
const requerirAdmin = require("../middlewares/requerirAdmin");

const {
    listarPedidos,
    obtenerResumenPedidos,
    buscarDetallePedido
} = require("../repositorios/adminPedidoRepositorio");

const router = express.Router();

router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});

router.use(autenticar, requerirAdmin);

router.get("/resumen", async (req, res) => {
    try {
        res.json(await obtenerResumenPedidos());
    } catch (error) {
        console.error(
            "No se pudo consultar el resumen:",
            error.code || error.name
        );

        res.status(503).json({
            error: {
                codigo: "RESUMEN_NO_DISPONIBLE",
                mensaje: "No pudimos consultar el resumen de pedidos."
            }
        });
    }
});

router.get("/", async (req, res) => {
    const limiteTexto = req.query.limite ?? "10";
    const antesTexto = req.query.antes_de;

    const limite = Number(limiteTexto);
    const antesDe = antesTexto === undefined
        ? null
        : Number(antesTexto);

    if (
        typeof limiteTexto !== "string" ||
        !/^[1-9]\d*$/.test(limiteTexto) ||
        !Number.isSafeInteger(limite) ||
        limite > 50 ||
        (
            antesTexto !== undefined &&
            (
                typeof antesTexto !== "string" ||
                !/^[1-9]\d*$/.test(antesTexto) ||
                !Number.isSafeInteger(antesDe) ||
                antesDe > 2147483647
            )
        )
    ) {
        return res.status(400).json({
            error: {
                codigo: "PAGINACION_INVALIDA",
                mensaje: "Usa un límite entre 1 y 50 y un cursor válido."
            }
        });
    }

    try {
        res.json(await listarPedidos(limite, antesDe));
    } catch (error) {
        console.error(
            "No se pudieron consultar los pedidos:",
            error.code || error.name
        );

        res.status(503).json({
            error: {
                codigo: "PEDIDOS_NO_DISPONIBLES",
                mensaje: "No pudimos consultar los pedidos."
            }
        });
    }
});

router.get("/:id", async (req, res) => {
    const texto = req.params.id;
    const idPedido = Number(texto);

    if (
        !/^[1-9]\d*$/.test(texto) ||
        !Number.isSafeInteger(idPedido) ||
        idPedido > 2147483647
    ) {
        return res.status(400).json({
            error: {
                codigo: "ID_PEDIDO_INVALIDO",
                mensaje: "El identificador del pedido no es válido."
            }
        });
    }

    try {
        const pedido = await buscarDetallePedido(idPedido);

        if (!pedido) {
            return res.status(404).json({
                error: {
                    codigo: "PEDIDO_NO_ENCONTRADO",
                    mensaje: "No encontramos ese pedido."
                }
            });
        }

        res.json(pedido);
    } catch (error) {
        console.error(
            "No se pudo consultar el detalle administrativo:",
            error.code || error.name
        );

        res.status(503).json({
            error: {
                codigo: "PEDIDOS_NO_DISPONIBLES",
                mensaje: "No pudimos consultar el pedido."
            }
        });
    }
});

module.exports = router;