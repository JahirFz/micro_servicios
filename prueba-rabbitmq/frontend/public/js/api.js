export async function solicitarAPI(
    ruta,
    { metodo = "GET", cuerpo, token, claveIdempotencia } = {}
) {
    const controlador = new AbortController();
    const temporizador = setTimeout(
        () => controlador.abort(),
        15000
    );

    try {
        const headers = { Accept: "application/json" };

        if (cuerpo !== undefined) {
            headers["Content-Type"] = "application/json";
        }

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        if (claveIdempotencia) {
            headers["Idempotency-Key"] = claveIdempotencia;
        }
        
        const respuesta = await fetch(`/api${ruta}`, {
            method: metodo,
            headers,
            body: cuerpo === undefined
                ? undefined
                : JSON.stringify(cuerpo),
            signal: controlador.signal,
            cache: "no-store"
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            const error = new Error(
                datos.error?.mensaje ||
                "No pudimos completar la solicitud."
            );

            error.status = respuesta.status;
            throw error;
        }

        return datos;
    } catch (error) {
        if (controlador.signal.aborted) {
            throw new Error(
                "La solicitud tardó demasiado. Intenta nuevamente."
            );
        }

        if (error instanceof TypeError) {
            throw new Error(
                "No pudimos conectar. Intenta nuevamente."
            );
        }

        throw error;
    } finally {
        clearTimeout(temporizador);
    }
}