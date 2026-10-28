const CLAVE = "fertech.sesion";

export function guardarSesion(datos) {
    if (
        typeof datos.access_token !== "string" ||
        !datos.access_token ||
        !Number.isFinite(datos.expires_in) ||
        datos.expires_in <= 0 ||
        !datos.usuario
    ) {
        throw new Error("La respuesta de acceso no es válida.");
    }

    const sesion = {
        token: datos.access_token,
        usuario: datos.usuario,
        expiraEn: Date.now() + datos.expires_in * 1000
    };

    sessionStorage.setItem(CLAVE, JSON.stringify(sesion));

    return sesion;
}

export function obtenerSesion() {
    try {
        const sesion = JSON.parse(
            sessionStorage.getItem(CLAVE) || "null"
        );

        if (
            !sesion ||
            typeof sesion.token !== "string" ||
            !sesion.token ||
            !sesion.usuario ||
            !Number.isFinite(sesion.expiraEn) ||
            sesion.expiraEn <= Date.now()
        ) {
            cerrarSesion();
            return null;
        }

        return sesion;
    } catch {
        return null;
    }
}

export function cerrarSesion() {
    sessionStorage.removeItem(CLAVE);
}