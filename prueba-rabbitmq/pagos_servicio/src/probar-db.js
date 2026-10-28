const {
    conectarMongoDB,
    ejecutarTransaccion,
    cerrarMongoDB
} = require("./config/db");

async function probar() {
    try {
        const db = await conectarMongoDB();

        console.log("MongoDB conectado.");
        console.log("Base de datos:", db.databaseName);

        const colecciones = await db
            .listCollections({}, { nameOnly: true })
            .toArray();

        console.log(
            "Colecciones:",
            colecciones.map(coleccion => coleccion.name)
        );

        await ejecutarTransaccion(async (db, sesion) => {
            await db.collection("pagos").findOne(
                {},
                {
                    session: sesion,
                    projection: { _id: 1 }
                }
            );
        });

        console.log("Lectura en transacción: OK.");
    } catch (error) {
        console.error("Falló la prueba:", error.message);
        process.exitCode = 1;
    } finally {
        await cerrarMongoDB();
    }
}

probar();