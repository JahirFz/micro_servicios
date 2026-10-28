const bcrypt = require("bcryptjs");
const pool = require("./config/db");

async function crearUsuario() {
    try {
        const nombre = process.env.SEED_NOMBRE?.trim();
        const correo = process.env.SEED_CORREO
            ?.trim()
            .toLowerCase();

        const password = process.env.SEED_PASSWORD;

        const rol = process.env.SEED_ROL?.trim() || "CLIENTE";

        if (!["CLIENTE", "ADMIN"].includes(rol)) {
            throw new Error("SEED_ROL debe ser CLIENTE o ADMIN.");
        }

        if (
            !nombre
            || nombre.length > 100
            || !correo
            || correo.length > 254
            || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
        ) {
            throw new Error(
                "Revisa SEED_NOMBRE y SEED_CORREO en .env."
            );
        }

        if (
            !password
            || password.length < 12
            || Buffer.byteLength(password, "utf8") > 72
        ) {
            throw new Error(
                "La contraseña debe tener al menos 12 caracteres "
                + "y no superar 72 bytes."
            );
        }

        const [existentes] = await pool.execute(`
            SELECT id_usuario
            FROM usuario
            WHERE correo = ?
        `, [correo]);

        if (existentes.length > 0) {
            console.log(
                "El usuario ya existe. No se modificó su contraseña."
            );
            return;
        }

        const [roles] = await pool.execute(`
            SELECT id_rol
            FROM rol
            WHERE nombre = ?
        `, [rol]);

        if (roles.length !== 1) {
            throw new Error(`No se encontró el rol ${rol}.`);
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const [resultado] = await pool.execute(`
            INSERT INTO usuario (
                id_rol,
                nombre,
                correo,
                password_hash,
                activo
            )
            VALUES (?, ?, ?, ?, TRUE)
        `, [
            roles[0].id_rol,
            nombre,
            correo,
            passwordHash
        ]);

        console.log("Usuario de prueba creado.");
        console.log("ID:", resultado.insertId);
        console.log("Correo:", correo);
        console.log("Rol:", rol);
    } finally {
        await pool.end();
    }
}

crearUsuario().catch((error) => {
    console.error(
        "No se pudo crear el usuario:",
        error.code || error.message
    );

    process.exitCode = 1;
});