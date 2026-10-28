const assert = require("node:assert/strict");
const { randomUUID, randomInt } = require("node:crypto");

const pool = require("./config/db");
const ejecutarTransaccion = require("./config/transaccion");
const {
    reservarInventario
} = require("./servicios/reservaServicio");

async function probarReservas() {
    const marca = `PRUEBA_${randomUUID()}`;
    const finalizarPrueba = new Error("ROLLBACK_DE_PRUEBA");
    const pedidosPrueba = [];

    try {
        try {
            await ejecutarTransaccion(async (conexion) => {
                // Buscar identificadores de pedido libres.
                while (pedidosPrueba.length < 2) {
                    const candidato = randomInt(1000000000, 2000000000);

                    const [filas] = await conexion.execute(`
                        SELECT id_pedido
                        FROM reserva_pedido
                        WHERE id_pedido = ?
                    `, [candidato]);

                    if (
                        filas.length === 0
                        && !pedidosPrueba.includes(candidato)
                    ) {
                        pedidosPrueba.push(candidato);
                    }
                }

                // Productos independientes del catálogo original.
                const [altaA] = await conexion.execute(`
                    INSERT INTO producto (
                        nombre, precio, stock_disponible
                    )
                    VALUES (?, '100.00', 5)
                `, [`${marca}_A`]);

                const [altaB] = await conexion.execute(`
                    INSERT INTO producto (
                        nombre, precio, stock_disponible
                    )
                    VALUES (?, '200.00', 6)
                `, [`${marca}_B`]);

                const idA = altaA.insertId;
                const idB = altaB.insertId;

                async function consultarStock() {
                    const [filas] = await conexion.execute(`
                        SELECT id_producto, stock_disponible
                        FROM producto
                        WHERE id_producto IN (?, ?)
                        ORDER BY id_producto
                    `, [idA, idB]);

                    return filas.map(p => p.stock_disponible);
                }

                // 1. Reserva exitosa.
                const seleccion = [
                    { id_producto: idA, cantidad: 2 },
                    { id_producto: idB, cantidad: 1 }
                ];

                const exitosa = await reservarInventario(
                    conexion,
                    pedidosPrueba[0],
                    seleccion
                );

                assert.equal(exitosa.resultado, "RESERVADO");
                assert.equal(exitosa.duplicado, false);
                assert.equal(exitosa.productos.length, 2);

                assert.ok(
                    exitosa.productos.every(
                        p => p.estado === "ACTIVA"
                    )
                );

                assert.deepEqual(await consultarStock(), [3, 5]);

                console.log("OK: reserva completa y stock correcto.");

                // 2. Misma selección en distinto orden.
                const duplicada = await reservarInventario(
                    conexion,
                    pedidosPrueba[0],
                    [...seleccion].reverse()
                );

                assert.equal(duplicada.duplicado, true);
                assert.equal(duplicada.productos.length, 2);
                assert.deepEqual(await consultarStock(), [3, 5]);

                console.log("OK: duplicado sin descontar nuevamente.");

                // 3. Mismo pedido con contenido diferente.
                await assert.rejects(
                    () => reservarInventario(
                        conexion,
                        pedidosPrueba[0],
                        [
                            { id_producto: idA, cantidad: 1 },
                            { id_producto: idB, cantidad: 1 }
                        ]
                    ),
                    /otra selección/
                );

                assert.deepEqual(await consultarStock(), [3, 5]);

                console.log("OK: conflicto de selección rechazado.");

                // 4. A tiene stock, pero B no.
                const rechazada = await reservarInventario(
                    conexion,
                    pedidosPrueba[1],
                    [
                        { id_producto: idA, cantidad: 1 },
                        { id_producto: idB, cantidad: 100 }
                    ]
                );

                assert.equal(rechazada.resultado, "RECHAZADO");
                assert.match(
                    rechazada.motivo,
                    /^STOCK_INSUFICIENTE:/
                );
                assert.equal(rechazada.productos.length, 0);

                // Tampoco debe descontarse la unidad de A.
                assert.deepEqual(await consultarStock(), [3, 5]);

                console.log("OK: rechazo sin reserva parcial.");

                // Revertir incluso si todas las pruebas pasan.
                throw finalizarPrueba;
            });
        } catch (error) {
            if (error !== finalizarPrueba) {
                throw error;
            }
        }

        // Comprobar desde fuera de la transacción.
        const [productos] = await pool.execute(`
            SELECT COUNT(*) AS cantidad
            FROM producto
            WHERE nombre IN (?, ?)
        `, [`${marca}_A`, `${marca}_B`]);

        const [reservas] = await pool.execute(`
            SELECT COUNT(*) AS cantidad
            FROM reserva_pedido
            WHERE id_pedido IN (?, ?)
        `, pedidosPrueba);

        assert.equal(Number(productos[0].cantidad), 0);
        assert.equal(Number(reservas[0].cantidad), 0);

        console.log("OK: rollback comprobado; no quedaron datos de prueba.");
    } finally {
        await pool.end();
    }
}

probarReservas().catch((error) => {
    console.error(
        "PRUEBA FALLIDA:",
        error.code || error.message
    );

    process.exitCode = 1;
});