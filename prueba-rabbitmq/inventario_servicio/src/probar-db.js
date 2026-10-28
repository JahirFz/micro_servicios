const pool = require("./config/db");

async function probarConexion() {
    try {
        const [productos] = await pool.execute(`
            SELECT
                id_producto,
                nombre,
                precio,
                moneda,
                stock_disponible
            FROM producto
            ORDER BY id_producto
        `);

        console.log("Conexión correcta con inventario_db.");
        console.table(productos);
    } catch (error) {
        console.error(
            "Falló la consulta:",
            error.code || error.message
        );

        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

probarConexion();