function requerirAdmin(req, res, next) {
    if (!req.autenticacion) {
        return res.status(401).json({
            error: {
                codigo: "TOKEN_REQUERIDO",
                mensaje: "Debes iniciar sesión."
            }
        });
    }

    if (req.autenticacion.rol !== "ADMIN") {
        return res.status(403).json({
            error: {
                codigo: "ACCESO_DENEGADO",
                mensaje: "No tienes permisos para acceder a esta sección."
            }
        });
    }

    next();
}

module.exports = requerirAdmin;