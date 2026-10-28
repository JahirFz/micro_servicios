const pool = require("./config/db");

async function probar() {
    try {
        const [conexion] = await pool.execute(`
            SELECT
                DATABASE() AS base_actual,
                CURRENT_USER() AS cuenta_mysql
        `);

        console.table(conexion);

        const tablas = [
            "pedido",
            "detalle_pedido",
            "solicitud_idempotente",
            "outbox",
            "mensaje_procesado"
        ];

        // Los nombres proceden de esta lista fija, no del usuario.
        for (const tabla of tablas) {
            const [filas] = await pool.execute(
                `SELECT COUNT(*) AS cantidad FROM ${tabla}`
            );

            console.log(
                `${tabla}: ${filas[0].cantidad} registros`
            );
        }

        console.log("Conexión de Orders comprobada.");
    } finally {
        await pool.end();
    }
}

probar().catch((error) => {
    console.error(
        "Falló la prueba:",
        error.code || error.message
    );

    process.exitCode = 1;
});