const pool = require("./config/db");

async function probarConexion() {
    try {
        const [roles] = await pool.execute(`
            SELECT id_rol, nombre, descripcion
            FROM rol
            ORDER BY id_rol
        `);

        const [usuarios] = await pool.execute(`
            SELECT COUNT(*) AS cantidad
            FROM usuario
        `);

        console.log("Conexión correcta con autenticacion_db.");
        console.table(roles);
        console.log(
            "Usuarios registrados:",
            usuarios[0].cantidad
        );
    } finally {
        await pool.end();
    }
}

probarConexion().catch((error) => {
    console.error(
        "Falló la conexión o consulta:",
        error.code || error.message
    );

    process.exitCode = 1;
});