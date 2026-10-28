const pool = require("../config/db");

async function listarPedidos(limite, antesDe) {
    const parametros = [];
    let filtro = "";

    if (antesDe !== null) {
        filtro = "WHERE id_pedido < ?";
        parametros.push(antesDe);
    }

    const [filas] = await pool.execute(
        `SELECT
             id_pedido,
             id_usuario,
             fecha_creacion,
             estado,
             fase_saga,
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

async function obtenerResumenPedidos() {
    const [filas] = await pool.execute(
        `SELECT COUNT(*) AS pendientes
         FROM pedido
         WHERE estado = 'PENDING'`
    );

    return {
        pendientes: Number(filas[0].pendientes)
    };
}

async function buscarDetallePedido(idPedido) {
    const [filas] = await pool.execute(
        `SELECT
             p.id_pedido,
             p.id_usuario,
             p.fecha_creacion,
             p.estado,
             p.fase_saga,
             p.total,
             p.moneda,
             p.motivo_cancelacion,
             p.inventario_liberado,
             p.pago_resuelto_sin_cargo,
             d.id_producto,
             d.cantidad,
             d.nombre_producto,
             d.precio_unitario
         FROM pedido p
         LEFT JOIN detalle_pedido d
             ON d.id_pedido = p.id_pedido
         WHERE p.id_pedido = ?
         ORDER BY d.id_producto`,
        [idPedido]
    );

    if (filas.length === 0) return null;

    const pedido = filas[0];

    return {
        id_pedido: pedido.id_pedido,
        id_usuario: pedido.id_usuario,
        fecha_creacion: pedido.fecha_creacion,
        estado: pedido.estado,
        fase_saga: pedido.fase_saga,
        total: pedido.total,
        moneda: pedido.moneda,
        motivo_cancelacion: pedido.motivo_cancelacion,
        inventario_liberado: Boolean(pedido.inventario_liberado),
        pago_resuelto_sin_cargo: Boolean(
            pedido.pago_resuelto_sin_cargo
        ),
        productos: filas
            .filter(fila => fila.id_producto !== null)
            .map(fila => ({
                id_producto: fila.id_producto,
                nombre_producto: fila.nombre_producto,
                cantidad: fila.cantidad,
                precio_unitario: fila.precio_unitario
            }))
    };
}

module.exports = { listarPedidos, obtenerResumenPedidos, buscarDetallePedido };