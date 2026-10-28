const pool = require("../config/db");

async function buscarPorCorreo(correo) {
    const [usuarios] = await pool.execute(`
        SELECT
            u.id_usuario,
            u.nombre,
            u.correo,
            u.password_hash,
            u.activo,
            r.nombre AS rol
        FROM usuario AS u
        JOIN rol AS r ON r.id_rol = u.id_rol
        WHERE u.correo = ?
        LIMIT 1
    `, [correo]);

    return usuarios[0] || null;
}

async function buscarPorId(id) {
    const [usuarios] = await pool.execute(`
        SELECT
            u.id_usuario,
            u.nombre,
            u.correo,
            u.activo,
            r.nombre AS rol
        FROM usuario AS u
        JOIN rol AS r ON r.id_rol = u.id_rol
        WHERE u.id_usuario = ?
        LIMIT 1
    `, [id]);

    return usuarios[0] || null;
}

module.exports = {
    buscarPorCorreo,
    buscarPorId
};