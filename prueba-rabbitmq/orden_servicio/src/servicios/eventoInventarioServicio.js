const ejecutarTransaccion = require("../config/transaccion");
const {
    registrarMensajeRecibido,
    guardarMensajeSalida
} = require("../repositorios/mensajeriaRepositorio");

function validarMensaje(mensaje) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
        !mensaje ||
        typeof mensaje !== "object" ||
        !uuid.test(mensaje.message_id) ||
        mensaje.version !== 1 ||
        typeof mensaje.fecha !== "string" ||
        !Number.isFinite(Date.parse(mensaje.fecha)) ||
        !Number.isInteger(mensaje.id_pedido) ||
        mensaje.id_pedido < 1 ||
        mensaje.id_pedido > 2147483647 ||
        !mensaje.datos ||
        typeof mensaje.datos !== "object" ||
        Array.isArray(mensaje.datos)
    ) {
        throw new Error("Mensaje de inventario inválido.");
    }

    if (
        mensaje.tipo !== "InventarioReservado" &&
        mensaje.tipo !== "InventarioRechazado"
    ) {
        throw new Error("Tipo de evento de inventario no admitido.");
    }
}

function precioACentavos(precio) {
    if (
        typeof precio !== "string" ||
        !/^\d{1,10}\.\d{2}$/.test(precio)
    ) {
        throw new Error("El precio recibido no es válido.");
    }

    const [entero, decimales] = precio.split(".");
    const centavos = BigInt(entero) * 100n + BigInt(decimales);

    if (centavos <= 0n) {
        throw new Error("El precio debe ser mayor que cero.");
    }

    return centavos;
}

function centavosADecimal(centavos) {
    const entero = centavos / 100n;
    const decimales = (centavos % 100n).toString().padStart(2, "0");

    return `${entero}.${decimales}`;
}

async function procesarEventoInventario(mensaje) {
    validarMensaje(mensaje);

    return ejecutarTransaccion(async (conexion) => {
        const [pedidos] = await conexion.execute(
            `SELECT id_pedido, estado, fase_saga
             FROM pedido
             WHERE id_pedido = ?
             FOR UPDATE`,
            [mensaje.id_pedido]
        );

        if (pedidos.length === 0) {
            const error = new Error(
                "El evento corresponde a un pedido inexistente."
            );

            error.code = "PEDIDO_DESCONOCIDO";
            throw error;
        }

        const registro = await registrarMensajeRecibido(
            conexion,
            mensaje
        );

        if (registro.duplicado) {
            return { duplicado: true };
        }

        const pedido = pedidos[0];

        // Un evento tardío no debe reiniciar una fase ya completada.
        if (
            pedido.estado !== "PENDING" ||
            pedido.fase_saga !== "RESERVANDO"
        ) {
            return { ignorado: true };
        }

        if (mensaje.tipo === "InventarioRechazado") {
            const motivo = mensaje.datos.motivo;

            if (
                typeof motivo !== "string" ||
                motivo.trim().length === 0 ||
                motivo.length > 255
            ) {
                throw new Error("Motivo de rechazo inválido.");
            }

            await conexion.execute(
                `UPDATE pedido
                 SET estado = 'CANCELLED',
                     fase_saga = 'FINALIZADA',
                     motivo_cancelacion = ?,
                     inventario_liberado = TRUE,
                     pago_resuelto_sin_cargo = TRUE
                 WHERE id_pedido = ?`,
                [motivo, mensaje.id_pedido]
            );

            return { estado: "CANCELLED" };
        }

        const productos = mensaje.datos.productos;

        if (mensaje.datos.moneda !== "MXN") {
            throw new Error("Moneda de la reserva inválida.");
        }

        const [detalles] = await conexion.execute(
            `SELECT id_producto, cantidad
             FROM detalle_pedido
             WHERE id_pedido = ?
             ORDER BY id_producto
             FOR UPDATE`,
            [mensaje.id_pedido]
        );

        if (
            !Array.isArray(productos) ||
            productos.length === 0 ||
            productos.length !== detalles.length
        ) {
            throw new Error(
                "Los productos reservados no coinciden con el pedido."
            );
        }

        const productosPorId = new Map();

        for (const producto of productos) {
            if (
                !producto ||
                !Number.isInteger(producto.id_producto) ||
                productosPorId.has(producto.id_producto) ||
                !Number.isInteger(producto.cantidad) ||
                producto.cantidad < 1 ||
                typeof producto.nombre_producto !== "string" ||
                producto.nombre_producto.trim().length === 0 ||
                producto.nombre_producto.length > 150
            ) {
                throw new Error("Producto reservado inválido.");
            }

            productosPorId.set(producto.id_producto, producto);
        }

        let totalCentavos = 0n;

        // Validar todo antes de guardar los precios.
        for (const detalle of detalles) {
            const producto = productosPorId.get(detalle.id_producto);

            if (!producto || producto.cantidad !== detalle.cantidad) {
                throw new Error(
                    "La reserva no coincide con las cantidades solicitadas."
                );
            }

            const precioCentavos = precioACentavos(
                producto.precio_unitario
            );

            totalCentavos +=
                precioCentavos * BigInt(detalle.cantidad);
        }

        // Límite de la columna DECIMAL(12,2).
        if (totalCentavos > 999999999999n) {
            throw new Error("El total supera el límite permitido.");
        }

        for (const detalle of detalles) {
            const producto = productosPorId.get(detalle.id_producto);

            await conexion.execute(
                `UPDATE detalle_pedido
                 SET nombre_producto = ?,
                     precio_unitario = ?
                 WHERE id_pedido = ?
                   AND id_producto = ?`,
                [
                    producto.nombre_producto,
                    producto.precio_unitario,
                    mensaje.id_pedido,
                    detalle.id_producto
                ]
            );
        }

        const total = centavosADecimal(totalCentavos);

        await conexion.execute(
            `UPDATE pedido
             SET total = ?,
                 moneda = 'MXN',
                 fase_saga = 'PAGANDO'
             WHERE id_pedido = ?`,
            [total, mensaje.id_pedido]
        );

        await guardarMensajeSalida(conexion, {
            tipo: "ProcesarPago",
            routingKey: "pagos.comandos",
            idPedido: mensaje.id_pedido,
            datos: {
                total,
                moneda: "MXN",
                metodo_pago: "TARJETA_PRUEBA"
            }
        });

        return {
            estado: "PENDING",
            fase_saga: "PAGANDO",
            total
        };
    });
}


module.exports = { procesarEventoInventario };