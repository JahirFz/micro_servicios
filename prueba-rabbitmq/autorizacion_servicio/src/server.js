// Carga la configuración de entorno antes de iniciar el servidor.
const pool = require("./config/db");
const app = require("./app");

const {
    prepararAutenticacion
} = require("./servicios/authServicio");

async function iniciar() {
    const puerto = Number(process.env.PORT || 3001);

    if (
        !Number.isInteger(puerto)
        || puerto < 1
        || puerto > 65535
    ) {
        throw new Error("PORT debe ser un puerto válido.");
    }

    await pool.execute("SELECT 1");
    await prepararAutenticacion();

    const servidor = app.listen(puerto, "127.0.0.1", () => {
        console.log(
            `Autenticación disponible en http://127.0.0.1:${puerto}`
        );
    });

    servidor.on("error", async (error) => {
        console.error("Error del servidor:", error.code);
        await pool.end();
        process.exitCode = 1;
    });
}

iniciar().catch(async (error) => {
    console.error(
        "No se pudo iniciar:",
        error.code || error.message
    );

    await pool.end();
    process.exitCode = 1;
});