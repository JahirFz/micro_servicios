const jwt = require("jsonwebtoken");

function autenticar(req, res, next) {
    const encabezado = req.get("Authorization") || "";
    const coincidencia = /^Bearer ([^\s]+)$/i.exec(encabezado);

    if (!coincidencia) {
        return res.status(401).json({
            error: {
                codigo: "TOKEN_REQUERIDO",
                mensaje: "Debes iniciar sesión."
            }
        });
    }

    try {
        const contenido = jwt.verify(
            coincidencia[1],
            process.env.JWT_SECRET,
            {
                algorithms: ["HS256"],
                issuer: "fertech-auth",
                audience: "fertech-api"
            }
        );

        if (
            typeof contenido !== "object"
            || typeof contenido.sub !== "string"
            || !/^[1-9]\d*$/.test(contenido.sub)
            || !Number.isInteger(contenido.exp)
        ) {
            throw new Error("Contenido de token inválido.");
        }

        const idUsuario = Number(contenido.sub);

        if (
            !Number.isSafeInteger(idUsuario)
            || idUsuario > 2147483647
        ) {
            throw new Error("Identificador inválido.");
        }

        const rolesPermitidos = ["CLIENTE", "ADMIN"];

        if (!rolesPermitidos.includes(contenido.rol)) {
            throw new Error("Rol de usuario inválido.");
        }

        req.autenticacion = {
            id_usuario: idUsuario,
            rol: contenido.rol
        };

        next();
    } catch {
        return res.status(401).json({
            error: {
                codigo: "TOKEN_INVALIDO",
                mensaje: "Tu sesión no es válida o expiró."
            }
        });
    }
}

module.exports = autenticar;