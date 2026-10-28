const { createHash } = require("node:crypto");
const pool = require("../config/db");
const ejecutarTransaccion = require("../config/transaccion");

const {
    guardarReservaSolicitada
} = require("../repositorios/outboxRepositorio");

function errorSolicitud(codigo, mensaje, estadoHttp = 400) {
    const error = new Error(mensaje);
    error.codigo = codigo;
    error.estadoHttp = estadoHttp;
    return error;
}

function enteroPositivo(valor) {
    return Number.isInteger(valor)
        && valor > 0
        && valor <= 2147483647;
}

function validarSeleccion(cuerpo) {
    if (
        !cuerpo
        || cuerpo.metodo_pago !== "TARJETA_PRUEBA"
    ) {
        throw errorSolicitud(
            "METODO_PAGO_INVALIDO",
            "El método permitido es TARJETA_PRUEBA."
        );
    }

    if (
        !Array.isArray(cuerpo.productos)
        || cuerpo.productos.length === 0
        || cuerpo.productos.length > 100
    ) {
        throw errorSolicitud(
            "PRODUCTOS_INVALIDOS",
            "Selecciona entre 1 y 100 productos."
        );
    }

    const ids = new Set();

    const productos = cuerpo.productos.map((producto) => {
        if (
            !producto
            || !enteroPositivo(producto.id_producto)
            || !enteroPositivo(producto.cantidad)
        ) {
            throw errorSolicitud(
                "PRODUCTO_O_CANTIDAD_INVALIDOS",
                "Los identificadores y cantidades deben ser enteros positivos."
            );
        }

        if (ids.has(producto.id_producto)) {
            throw errorSolicitud(
                "PRODUCTO_REPETIDO",
                "Cada producto debe aparecer una sola vez."
            );
        }

        ids.add(producto.id_producto);

        return {
            id_producto: producto.id_producto,
            cantidad: producto.cantidad
        };
    });

    productos.sort((a, b) => a.id_producto - b.id_producto);

    return {
        metodo_pago: "TARJETA_PRUEBA",
        productos
    };
}

async function buscarSolicitud(idUsuario, clave) {
    const [filas] = await pool.execute(`
        SELECT
            s.hash_solicitud,
            p.id_pedido,
            p.estado,
            p.total,
            p.moneda
        FROM solicitud_idempotente AS s
        JOIN pedido AS p ON p.id_pedido = s.id_pedido
        WHERE s.id_usuario = ?
          AND s.clave = ?
    `, [idUsuario, clave]);

    return filas[0] || null;
}

function respuestaExistente(existente, hash) {
    if (existente.hash_solicitud !== hash) {
        throw errorSolicitud(
            "CLAVE_IDEMPOTENCIA_EN_CONFLICTO",
            "La clave ya fue utilizada para otra selección.",
            409
        );
    }

    return {
        reutilizado: true,
        pedido: {
            id_pedido: existente.id_pedido,
            estado: existente.estado,
            total: existente.total,
            moneda: existente.moneda
        }
    };
}

async function crearPedido(idUsuario, clave, cuerpo) {
    if (!enteroPositivo(idUsuario)) {
        throw errorSolicitud(
            "USUARIO_INVALIDO",
            "La identidad del usuario no es válida.",
            401
        );
    }

    if (
        typeof clave !== "string"
        || !/^[A-Za-z0-9._:-]{1,128}$/.test(clave)
    ) {
        throw errorSolicitud(
            "CLAVE_IDEMPOTENCIA_INVALIDA",
            "Envía Idempotency-Key de hasta 128 caracteres: "
            + "letras, números, punto, guion, guion bajo o dos puntos."
        );
    }

    const seleccion = validarSeleccion(cuerpo);

    const hash = createHash("sha256")
        .update(JSON.stringify(seleccion))
        .digest("hex");

    const existente = await buscarSolicitud(idUsuario, clave);

    if (existente) {
        return respuestaExistente(existente, hash);
    }

    try {
        return await ejecutarTransaccion(async (conexion) => {
            const [alta] = await conexion.execute(`
                INSERT INTO pedido (id_usuario)
                VALUES (?)
            `, [idUsuario]);

            const idPedido = alta.insertId;

            await conexion.execute(`
                INSERT INTO solicitud_idempotente (
                    id_usuario,
                    clave,
                    hash_solicitud,
                    id_pedido
                )
                VALUES (?, ?, ?, ?)
            `, [idUsuario, clave, hash, idPedido]);

            for (const producto of seleccion.productos) {
                await conexion.execute(`
                    INSERT INTO detalle_pedido (
                        id_pedido,
                        id_producto,
                        cantidad
                    )
                    VALUES (?, ?, ?)
                `, [
                    idPedido,
                    producto.id_producto,
                    producto.cantidad
                ]);
            }

            await guardarReservaSolicitada(
                conexion,
                idPedido,
                seleccion.productos
            );

            return {
                reutilizado: false,
                pedido: {
                    id_pedido: idPedido,
                    estado: "PENDING",
                    total: null,
                    moneda: "MXN"
                }
            };
        });
    } catch (error) {
        // Otra solicitud pudo registrar la misma clave
        // mientras esta intentaba crear el pedido.
        // ejecutarTransaccion ya revirtió nuestros cambios.
        if (error.code === "ER_DUP_ENTRY") {
            const registrada = await buscarSolicitud(
                idUsuario,
                clave
            );

            if (registrada) {
                return respuestaExistente(registrada, hash);
            }
        }

        throw error;
    }
}

module.exports = { crearPedido };