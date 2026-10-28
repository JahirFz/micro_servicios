const pool = require("./db");

async function ejecutarTransaccion(operacion) {
    const conexion = await pool.getConnection();

    try {
        await conexion.query("SET time_zone = '+00:00'");
        await conexion.beginTransaction();

        const resultado = await operacion(conexion);

        await conexion.commit();

        return resultado;
    } catch (error) {
        try {
            await conexion.rollback();
        } catch (errorRollback) {
            console.error(
                "No se pudo revertir la transacción:",
                errorRollback.message
            );
        }

        throw error;
    } finally {
        conexion.release();
    }
}

module.exports = ejecutarTransaccion;