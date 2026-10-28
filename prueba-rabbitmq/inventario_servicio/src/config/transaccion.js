const pool = require("./db");

async function ejecutarTransaccion(operacion) {
    const conexion = await pool.getConnection();

    try {
        // Las fechas generadas por MySQL se manejarán en UTC.
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
                "No se pudo confirmar el rollback:",
                errorRollback.code || errorRollback.message
            );

            // Evitar devolver al pool una conexión dudosa.
            conexion.destroy();
        }

        throw error;
    } finally {
        conexion.release();
    }
}

module.exports = ejecutarTransaccion;