const pool = require("../config/db");

async function buscarPedidoDeUsuario(idPedido, idUsuario) {
    const [filas] = await pool.execute(
        `SELECT
             p.id_pedido,
             p.fecha_creacion,
             p.estado,
             p.fase_saga,
             p.total,
             p.moneda,
             p.motivo_cancelacion,
             d.id_producto,
             d.cantidad,
             d.nombre_producto,
             d.precio_unitario
         FROM pedido p
         LEFT JOIN detalle_pedido d
             ON d.id_pedido = p.id_pedido
         WHERE p.id_pedido = ?
           AND p.id_usuario = ?
         ORDER BY d.id_producto`,
        [idPedido, idUsuario]
    );

    if (filas.length === 0) {
        return null;
    }

    const primera = filas[0];

    return {
        id_pedido: primera.id_pedido,
        fecha_creacion: primera.fecha_creacion,
        estado: primera.estado,
        fase_saga: primera.fase_saga,
        total: primera.total,
        moneda: primera.moneda,
        motivo_cancelacion: primera.motivo_cancelacion,
        productos: filas
            .filter(fila => fila.id_producto !== null)
            .map(fila => ({
                id_producto: fila.id_producto,
                cantidad: fila.cantidad,
                nombre_producto: fila.nombre_producto,
                precio_unitario: fila.precio_unitario
            }))
    };
}

async function listarPedidosDeUsuario(idUsuario, limite, antesDe) {
    const parametros = [idUsuario];

    let filtro = "WHERE id_usuario = ?";

    if (antesDe !== null) {
        filtro += " AND id_pedido < ?";
        parametros.push(antesDe);
    }

    // limite es un entero validado por la ruta.
    const [filas] = await pool.execute(
        `SELECT
             id_pedido,
             fecha_creacion,
             estado,
             total,
             moneda
         FROM pedido
         ${filtro}
         ORDER BY id_pedido DESC
         LIMIT ${limite + 1}`,
        parametros
    );

    const hayMas = filas.length > limite;
    const pedidos = filas.slice(0, limite);

    return {
        pedidos,
        siguiente_antes_de: hayMas
            ? pedidos[pedidos.length - 1].id_pedido
            : null
    };
}

module.exports = {
    buscarPedidoDeUsuario,
    listarPedidosDeUsuario
};