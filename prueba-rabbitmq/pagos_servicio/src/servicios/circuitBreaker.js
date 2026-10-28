function crearCircuitBreaker({
    limiteFallos = 3,
    esperaMs = 10000
} = {}) {
    let estado = "CERRADO";
    let fallos = 0;
    let proximaPrueba = 0;
    let pruebaActiva = false;
    let generacion = 0;

    function abrir() {
        estado = "ABIERTO";
        proximaPrueba = Date.now() + esperaMs;
        generacion++;
        console.warn("Circuit breaker: ABIERTO.");
    }

    function esFalloTecnico(error) {
        return (
            [
                "BANCO_TIMEOUT",
                "BANCO_COMUNICACION",
                "BANCO_RESPUESTA_INVALIDA"
            ].includes(error.code) ||
            (
                error.code === "BANCO_HTTP" &&
                (
                    error.status >= 500 ||
                    error.status === 408 ||
                    error.status === 429
                )
            )
        );
    }

    async function ejecutar(operacion) {
        if (estado === "ABIERTO") {
            if (Date.now() < proximaPrueba) {
                const error = new Error(
                    "Los nuevos cobros están suspendidos temporalmente."
                );

                error.code = "BANCO_CIRCUITO_ABIERTO";
                throw error;
            }

            estado = "SEMIABIERTO";
            console.log("Circuit breaker: SEMIABIERTO.");
        }

        const esPrueba = estado === "SEMIABIERTO";

        if (esPrueba && pruebaActiva) {
            const error = new Error(
                "Ya hay una prueba de conexión en curso."
            );

            error.code = "BANCO_CIRCUITO_ABIERTO";
            throw error;
        }

        if (esPrueba) {
            pruebaActiva = true;
        }

        const generacionInicial = generacion;

        try {
            const resultado = await operacion();

            if (generacionInicial === generacion) {
                fallos = 0;

                if (esPrueba) {
                    estado = "CERRADO";
                    console.log("Circuit breaker: CERRADO.");
                }
            }

            return resultado;
        } catch (error) {
            if (generacionInicial === generacion) {
                if (esFalloTecnico(error)) {
                    fallos++;

                    if (esPrueba || fallos >= limiteFallos) {
                        abrir();
                    }
                } else {
                    // Una respuesta comercial o un error HTTP
                    // no técnico indica que el banco respondió.
                    fallos = 0;

                    if (esPrueba) {
                        estado = "CERRADO";
                    }
                }
            }

            throw error;
        } finally {
            if (esPrueba) {
                pruebaActiva = false;
            }
        }
    }

    return { ejecutar };
}

module.exports = { crearCircuitBreaker };