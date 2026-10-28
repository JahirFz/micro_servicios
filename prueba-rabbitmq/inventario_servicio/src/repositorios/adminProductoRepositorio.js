const pool = require("../config/db");

async function listarProductos(antesDe) {
    const parametros = [];
    let filtro = "";

    if (antesDe !== null) {
        filtro = "WHERE id_producto < ?";
        parametros.push(antesDe);
    }

    const [filas] = await pool.execute(
        `SELECT
             id_producto,
             nombre,
             descripcion,
             precio,
             moneda,
             stock_disponible,
             activo
         FROM producto
         ${filtro}
         ORDER BY id_producto DESC
         LIMIT 21`,
        parametros
    );

    const hayMas = filas.length > 20;
    const productos = filas.slice(0, 20);

    return {
        productos,
        siguiente_antes_de: hayMas
            ? productos[productos.length - 1].id_producto
            : null
    };
}

async function obtenerResumenInventario() {
    const [filas] = await pool.execute(
        `SELECT COUNT(*) AS productos_poco_stock
         FROM producto
         WHERE activo = TRUE
           AND stock_disponible <= ?`,
        [5]
    );

    return {
        productos_poco_stock: Number(filas[0].productos_poco_stock),
        umbral: 5
    };
}

module.exports = { listarProductos, obtenerResumenInventario };