const assert = require("node:assert/strict");
const { randomUUID, randomInt } = require("node:crypto");

const pool = require("./config/db");
const ejecutarTransaccion = require("./config/transaccion");

const {
    reservarInventario
} = require("./servicios/reservaServicio");

const {
    confirmarReserva,
    liberarReserva
} = require("./servicios/estadoReservaServicio");

async function probar() {
    const marca = `PRUEBA_ESTADOS_${randomUUID()}`;
    const terminar = new Error("ROLLBACK_DE_PRUEBA");
    const idsPedidos = [];
    let idProducto;

    try {
        try {
            await ejecutarTransaccion(async (conexion) => {
                // Elegir dos identificadores de pedido libres.
                while (idsPedidos.length < 2) {
                    const candidato = randomInt(
                        1000000000,
                        2000000000
                    );

                    const [filas] = await conexion.execute(`
                        SELECT id_pedido
                        FROM reserva_pedido
                        WHERE id_pedido = ?
                    `, [candidato]);

                    if (
                        filas.length === 0
                        && !idsPedidos.includes(candidato)
                    ) {
                        idsPedidos.push(candidato);
                    }
                }

                const [alta] = await conexion.execute(`
                    INSERT INTO producto (
                        nombre,
                        precio,
                        stock_disponible
                    )
                    VALUES (?, '100.00', 10)
                `, [marca]);

                idProducto = alta.insertId;

                async function stock() {
                    const [filas] = await conexion.execute(`
                        SELECT stock_disponible
                        FROM producto
                        WHERE id_producto = ?
                    `, [idProducto]);

                    return filas[0].stock_disponible;
                }

                const seleccion = [
                    {
                        id_producto: idProducto,
                        cantidad: 2
                    }
                ];

                // 1. Confirmar: 10 → 8 → 8.
                await reservarInventario(
                    conexion,
                    idsPedidos[0],
                    seleccion
                );

                assert.equal(await stock(), 8);

                const confirmada = await confirmarReserva(
                    conexion,
                    idsPedidos[0]
                );

                assert.equal(confirmada.estado, "CONFIRMADA");
                assert.equal(confirmada.duplicado, false);
                assert.equal(await stock(), 8);

                const confirmadaOtraVez = await confirmarReserva(
                    conexion,
                    idsPedidos[0]
                );

                assert.equal(confirmadaOtraVez.duplicado, true);
                assert.equal(await stock(), 8);

                console.log(
                    "OK: confirmar y repetir no descuentan más stock."
                );

                // No liberar una venta confirmada.
                await assert.rejects(
                    () => liberarReserva(conexion, idsPedidos[0]),
                    /No se puede pasar/
                );

                assert.equal(await stock(), 8);

                console.log(
                    "OK: no se libera una reserva confirmada."
                );

                // 2. Otra reserva: 8 → 6 → 8.
                await reservarInventario(
                    conexion,
                    idsPedidos[1],
                    seleccion
                );

                assert.equal(await stock(), 6);

                const liberada = await liberarReserva(
                    conexion,
                    idsPedidos[1]
                );

                assert.equal(liberada.estado, "LIBERADA");
                assert.equal(liberada.duplicado, false);
                assert.equal(await stock(), 8);

                const liberadaOtraVez = await liberarReserva(
                    conexion,
                    idsPedidos[1]
                );

                assert.equal(liberadaOtraVez.duplicado, true);
                assert.equal(await stock(), 8);

                console.log(
                    "OK: liberar devuelve las unidades una sola vez."
                );

                // No confirmar una reserva ya liberada.
                await assert.rejects(
                    () => confirmarReserva(conexion, idsPedidos[1]),
                    /No se puede pasar/
                );

                assert.equal(await stock(), 8);

                const [estados] = await conexion.execute(`
                    SELECT id_pedido, estado
                    FROM reserva_inventario
                    WHERE id_pedido IN (?, ?)
                    ORDER BY id_pedido
                `, idsPedidos);

                const porPedido = new Map(
                    estados.map(r => [r.id_pedido, r.estado])
                );

                assert.equal(
                    porPedido.get(idsPedidos[0]),
                    "CONFIRMADA"
                );

                assert.equal(
                    porPedido.get(idsPedidos[1]),
                    "LIBERADA"
                );

                console.log(
                    "OK: estados finales correctos y transiciones protegidas."
                );

                // Revertir todos los datos temporales.
                throw terminar;
            });
        } catch (error) {
            if (error !== terminar) {
                throw error;
            }
        }

        const [productos] = await pool.execute(`
            SELECT COUNT(*) AS cantidad
            FROM producto
            WHERE id_producto = ?
        `, [idProducto]);

        const [reservas] = await pool.execute(`
            SELECT COUNT(*) AS cantidad
            FROM reserva_pedido
            WHERE id_pedido IN (?, ?)
        `, idsPedidos);

        assert.equal(Number(productos[0].cantidad), 0);
        assert.equal(Number(reservas[0].cantidad), 0);

        console.log(
            "OK: rollback comprobado; no quedaron datos temporales."
        );
    } finally {
        await pool.end();
    }
}

probar().catch((error) => {
    console.error(
        "PRUEBA FALLIDA:",
        error.code || error.message
    );

    process.exitCode = 1;
});