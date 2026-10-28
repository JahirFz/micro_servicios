const express = require("express");
const autenticar = require("../middlewares/autenticar");
const { crearPedido } = require("../servicios/pedidoServicio");
const {
    buscarPedidoDeUsuario,
    listarPedidosDeUsuario
} = require("../repositorios/consultaPedidoRepositorio");

const router = express.Router();

router.post("/", autenticar, async (req, res) => {
    res.set("Cache-Control", "no-store");

    try {
        const resultado = await crearPedido(
            req.autenticacion.id_usuario,
            req.get("Idempotency-Key"),
            req.body
        );

        res
            .status(resultado.reutilizado ? 200 : 202)
            .location(`/pedidos/${resultado.pedido.id_pedido}`)
            .json({
                ...resultado.pedido,
                reutilizado: resultado.reutilizado
            });
    } catch (error) {
        if (error.estadoHttp) {
            return res.status(error.estadoHttp).json({
                error: {
                    codigo: error.codigo,
                    mensaje: error.message
                }
            });
        }

        console.error(
            "Error al crear pedido:",
            error.code || error.name
        );

        res.status(503).json({
            error: {
                codigo: "PEDIDOS_NO_DISPONIBLES",
                mensaje: "No pudimos confirmar la creación del pedido. "
                    + "Reintenta con la misma Idempotency-Key."
            }
        });
    }
});

router.get("/:id", autenticar, async (req, res) => {
    res.set("Cache-Control", "no-store");

    const valor = req.params.id;
    const idPedido = Number(valor);

    if (
        !/^[1-9]\d*$/.test(valor) ||
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
        const pedido = await buscarPedidoDeUsuario(
            idPedido,
            req.autenticacion.id_usuario
        );

        if (!pedido) {
            return res.status(404).json({
                error: {
                    codigo: "PEDIDO_NO_ENCONTRADO",
                    mensaje: "No encontramos ese pedido."
                }
            });
        }

        return res.json(pedido);
    } catch (error) {
        console.error(
            "No se pudo consultar el pedido:",
            error.code || error.name
        );

        return res.status(503).json({
            error: {
                codigo: "PEDIDOS_NO_DISPONIBLES",
                mensaje: "No pudimos consultar el pedido. Intenta nuevamente."
            }
        });
    }
});

router.get("/", autenticar, async (req, res) => {
    res.set("Cache-Control", "no-store");

    const limiteTexto = req.query.limite ?? "10";
    const antesTexto = req.query.antes_de;

    const limite = Number(limiteTexto);
    const antesDe = antesTexto === undefined
        ? null
        : Number(antesTexto);

    const limiteValido =
        typeof limiteTexto === "string" &&
        /^[1-9]\d*$/.test(limiteTexto) &&
        Number.isSafeInteger(limite) &&
        limite <= 50;

    const cursorValido =
        antesTexto === undefined ||
        (
            typeof antesTexto === "string" &&
            /^[1-9]\d*$/.test(antesTexto) &&
            Number.isSafeInteger(antesDe) &&
            antesDe <= 2147483647
        );

    if (!limiteValido || !cursorValido) {
        return res.status(400).json({
            error: {
                codigo: "PAGINACION_INVALIDA",
                mensaje:
                    "Usa un límite entre 1 y 50 y un cursor válido."
            }
        });
    }

    try {
        const resultado = await listarPedidosDeUsuario(
            req.autenticacion.id_usuario,
            limite,
            antesDe
        );

        return res.json(resultado);
    } catch (error) {
        console.error(
            "No se pudo consultar el historial:",
            error.code || error.name
        );

        return res.status(503).json({
            error: {
                codigo: "PEDIDOS_NO_DISPONIBLES",
                mensaje:
                    "No pudimos consultar tus pedidos. Intenta nuevamente."
            }
        });
    }
});

module.exports = router;