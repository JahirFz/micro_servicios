const { randomBytes } = require("node:crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const {
    buscarPorCorreo
} = require("../repositorios/usuarioRepositorio");

let hashFicticio;

async function prepararAutenticacion() {
    if (!/^[0-9a-f]{64}$/i.test(process.env.JWT_SECRET || "")) {
        throw new Error(
            "JWT_SECRET debe contener los 64 caracteres "
            + "hexadecimales generados."
        );
    }

    // Permite realizar una comparación incluso si no existe el correo.
    hashFicticio = await bcrypt.hash(
        randomBytes(32).toString("hex"),
        12
    );
}

async function iniciarSesion(correo, password) {
    const usuario = await buscarPorCorreo(correo);

    const coincide = await bcrypt.compare(
        password,
        usuario ? usuario.password_hash : hashFicticio
    );

    if (!usuario || !coincide || !usuario.activo) {
        return null;
    }

    const token = jwt.sign(
        { rol: usuario.rol },
        process.env.JWT_SECRET,
        {
            algorithm: "HS256",
            subject: String(usuario.id_usuario),
            issuer: "fertech-auth",
            audience: "fertech-api",
            expiresIn: 3600
        }
    );

    return {
        access_token: token,
        token_type: "Bearer",
        expires_in: 3600,
        usuario: {
            id_usuario: usuario.id_usuario,
            nombre: usuario.nombre,
            correo: usuario.correo,
            rol: usuario.rol
        }
    };
}

module.exports = {
    prepararAutenticacion,
    iniciarSesion
};