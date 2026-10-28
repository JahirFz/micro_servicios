const path = require("node:path");
const { MongoClient } = require("mongodb");

require("dotenv").config({
    path: path.resolve(__dirname, "../../.env")
});

if (!process.env.MONGODB_URI || !process.env.MONGODB_DB) {
    throw new Error(
        "Falta configurar MONGODB_URI o MONGODB_DB."
    );
}

const cliente = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    maxPoolSize: 5
});

async function conectarMongoDB() {
    await cliente.connect();

    const db = cliente.db(process.env.MONGODB_DB);

    await db.command({ ping: 1 });

    return db;
}

async function ejecutarTransaccion(operacion) {
    const sesion = cliente.startSession();

    try {
        return await sesion.withTransaction(
            () => operacion(
                cliente.db(process.env.MONGODB_DB),
                sesion
            ),
            {
                readConcern: { level: "snapshot" },
                writeConcern: { w: "majority" },
                readPreference: "primary"
            }
        );
    } finally {
        await sesion.endSession();
    }
}

async function cerrarMongoDB() {
    await cliente.close();
}

module.exports = {
    conectarMongoDB,
    ejecutarTransaccion,
    cerrarMongoDB
};