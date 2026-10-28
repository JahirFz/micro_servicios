const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { iniciarSesion } = require("../servicios/authServicio");
const autenticar = require("../middlewares/autenticar");

const {
    buscarPorId
} = require("../repositorios/usuarioRepositorio");

const router = express.Router();

const limitarLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
        error: {
            codigo: "DEMASIADOS_INTENTOS",
            mensaje: "Demasiados intentos. Inténtalo más tarde."
        }
    }
});

router.post("/login", limitarLogin, async (req, res) => {
    res.set("Cache-Control", "no-store");

    const { correo, password } = req.body || {};

    if (
        typeof correo !== "string"
        || correo.trim().length > 254
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())
    ) {
        return res.status(400).json({
            error: {
                codigo: "CORREO_INVALIDO",
                mensaje: "Escribe un correo válido.",
                campo: "correo"
            }
        });
    }

    if (
        typeof password !== "string"
        || password.length === 0
        || Buffer.byteLength(password, "utf8") > 72
    ) {
        return res.status(400).json({
            error: {
                codigo: "PASSWORD_INVALIDA",
                mensaje: "Ingresa una contraseña de hasta 72 bytes.",
                campo: "password"
            }
        });
    }

    try {
        const resultado = await iniciarSesion(
            correo.trim().toLowerCase(),
            password
        );

        if (!resultado) {
            return res.status(401).json({
                error: {
                    codigo: "CREDENCIALES_INVALIDAS",
                    mensaje: "Correo o contraseña incorrectos."
                }
            });
        }

        res.json(resultado);
    } catch (error) {
        console.error(
            "Error durante Login:",
            error.code || error.name
        );

        res.status(503).json({
            error: {
                codigo: "AUTENTICACION_NO_DISPONIBLE",
                mensaje: "No pudimos iniciar sesión. Inténtalo después."
            }
        });
    }
});

router.get("/me", autenticar, async (req, res) => {
    res.set("Cache-Control", "no-store");

    try {
        const usuario = await buscarPorId(
            req.autenticacion.id_usuario
        );

        if (!usuario || !usuario.activo) {
            return res.status(401).json({
                error: {
                    codigo: "SESION_NO_VALIDA",
                    mensaje: "Debes iniciar sesión nuevamente."
                }
            });
        }

        res.json({
            usuario: {
                id_usuario: usuario.id_usuario,
                nombre: usuario.nombre,
                correo: usuario.correo,
                rol: usuario.rol
            }
        });
    } catch (error) {
        console.error(
            "Error al consultar usuario:",
            error.code || error.name
        );

        res.status(503).json({
            error: {
                codigo: "AUTENTICACION_NO_DISPONIBLE",
                mensaje: "No pudimos consultar tu sesión."
            }
        });
    }
});

module.exports = router;