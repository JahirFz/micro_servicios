const pool = require("../config/db");

async function listarActivos() {
    const [productos] = await pool.execute(`
        SELECT
            id_producto,
            nombre,
            descripcion,
            precio,
            moneda,
            stock_disponible
        FROM producto
        WHERE activo = TRUE
        ORDER BY id_producto
    `);

    return productos;
}

async function buscarActivoPorId(id) {
    const [productos] = await pool.execute(`
        SELECT
            id_producto,
            nombre,
            descripcion,
            precio,
            moneda,
            stock_disponible
        FROM producto
        WHERE id_producto = ?
          AND activo = TRUE
    `, [id]);

    return productos[0] || null;
}

module.exports = {
    listarActivos,
    buscarActivoPorId
};