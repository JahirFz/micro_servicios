const { randomUUID } = require("node:crypto");
const pool = require("./config/db");
const ejecutarTransaccion = require("./config/transaccion");

async function probarRollback() {
    const nombre = `PRUEBA_ROLLBACK_${randomUUID()}`;
    const falloEsperado = new Error("Fallo intencional de prueba");

    try {
        try {
            await ejecutarTransaccion(async (conexion) => {
                await conexion.execute(`
                    INSERT INTO producto (
                        nombre,
                        descripcion,
                        precio,
                        moneda,
                        stock_disponible,
                        activo
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    nombre,
                    "Producto temporal para comprobar rollback.",
                    "1.00",
                    "MXN",
                    1,
                    true
                ]);

                console.log("Producto insertado dentro de la transacción.");

                throw falloEsperado;
            });
        } catch (error) {
            if (error !== falloEsperado) {
                throw error;
            }

            console.log("Fallo intencional recibido.");
        }

        const [filas] = await pool.execute(`
            SELECT COUNT(*) AS cantidad
            FROM producto
            WHERE nombre = ?
        `, [nombre]);

        if (Number(filas[0].cantidad) !== 0) {
            throw new Error(
                "La prueba falló: el producto temporal quedó guardado."
            );
        }

        console.log("Rollback correcto: el producto temporal no existe.");
    } finally {
        await pool.end();
    }
}

probarRollback().catch((error) => {
    console.error(
        "Error en la prueba:",
        error.code || error.message
    );

    process.exitCode = 1;
});