const app = require("./app");
const pool = require("./config/db");

const puerto = Number(process.env.PORT || 3002);

async function iniciar() {
    if (
        !Number.isInteger(puerto) ||
        puerto < 1 ||
        puerto > 65535
    ) {
        throw new Error("PORT debe ser un puerto válido.");
    }

    await pool.execute("SELECT 1");

    const servidor = app.listen(puerto, "127.0.0.1", () => {
        console.log(
            `Inventario disponible en http://127.0.0.1:${puerto}`
        );
    });

    servidor.on("error", async (error) => {
        console.error("No se pudo abrir el servidor:", error.code);
        await pool.end();
        process.exitCode = 1;
    });
}

iniciar().catch(async (error) => {
    console.error(
        "No se pudo iniciar inventario:",
        error.code || error.message
    );

    await pool.end();
    process.exitCode = 1;
});