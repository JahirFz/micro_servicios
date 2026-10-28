const {
    conectarMongoDB,
    cerrarMongoDB
} = require("./config/db");

const {
    procesarPagoPendiente
} = require("./servicios/procesarPagoServicio");

let detener = false;

function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function iniciar() {
    try {
        const db = await conectarMongoDB();

        console.log("Trabajador de pagos iniciado.");

        while (!detener) {
            const pendientes = await db.collection("pagos")
                .find({
                    $or: [
                        { estado: "PENDIENTE" },
                        { requiere_resolucion: true }
                    ]
                })
                .sort({ actualizado_en: 1, _id: 1 })
                .limit(20)
                .toArray();

            for (const pago of pendientes) {
                if (detener) break;

                try {
                    const resultado = await procesarPagoPendiente(
                        Number(pago.id_pedido)
                    );

                    console.log("Pago procesado:", resultado);
                } catch (error) {
                    console.error(
                        "Pago pendiente de resolución. Pedido:",
                        Number(pago.id_pedido),
                        "Error:",
                        error.code || error.message
                    );
                }
            }

            if (!detener) {
                await esperar(2000);
            }
        }
    } finally {
        await cerrarMongoDB();
    }
}

process.once("SIGINT", () => {
    console.log("Terminando la operación actual...");
    detener = true;
});

iniciar().catch(error => {
    console.error(
        "Trabajador detenido:",
        error.code || error.message
    );

    process.exitCode = 1;
});