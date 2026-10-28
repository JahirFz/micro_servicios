const {
    conectarMongoDB,
    cerrarMongoDB
} = require("./config/db");

const {
    procesarPagoPendiente
} = require("./servicios/procesarPagoServicio");

async function iniciar() {
    try {
        const idPedido = Number(process.argv[2]);

        if (
            !Number.isInteger(idPedido) ||
            idPedido < 1 ||
            idPedido > 2147483647
        ) {
            throw new Error(
                "Indica un pedido válido: node src/procesar-pedido.js 1"
            );
        }

        await conectarMongoDB();

        const resultado = await procesarPagoPendiente(idPedido);

        console.log("Resultado:", resultado);
    } catch (error) {
        console.error(
            "No se completó el procesamiento:",
            error.code || error.message
        );

        process.exitCode = 1;
    } finally {
        await cerrarMongoDB();
    }
}

iniciar();