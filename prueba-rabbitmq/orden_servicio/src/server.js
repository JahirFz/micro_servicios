const pool = require("./config/db");
const app = require("./app");

async function iniciar() {
    const puerto = Number(process.env.PORT || 3003);

    if (
        !Number.isInteger(puerto)
        || puerto < 1
        || puerto > 65535
    ) {
        throw new Error("PORT debe ser un puerto válido.");
    }

    if (!/^[0-9a-f]{64}$/i.test(process.env.JWT_SECRET || "")) {
        throw new Error(
            "Configura el mismo JWT_SECRET de autenticación."
        );
    }

    await pool.execute("SELECT 1");

    const servidor = app.listen(puerto, "127.0.0.1", () => {
        console.log(
            `Orders disponible en http://127.0.0.1:${puerto}`
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
        "No se pudo iniciar Orders:",
        error.code || error.message
    );

    await pool.end();
    process.exitCode = 1;
});