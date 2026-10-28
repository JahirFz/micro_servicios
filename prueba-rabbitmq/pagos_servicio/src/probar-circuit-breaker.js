const assert = require("node:assert/strict");

const {
    crearCircuitBreaker
} = require("./servicios/circuitBreaker");

async function probar() {
    const circuito = crearCircuitBreaker({
        limiteFallos: 3,
        esperaMs: 100
    });

    let llamadas = 0;

    async function bancoConFallo() {
        llamadas++;

        const error = new Error("Timeout simulado.");
        error.code = "BANCO_TIMEOUT";
        throw error;
    }

    for (let intento = 1; intento <= 3; intento++) {
        await assert.rejects(
            () => circuito.ejecutar(bancoConFallo),
            { code: "BANCO_TIMEOUT" }
        );
    }

    assert.equal(llamadas, 3);
    console.log("Tres fallos técnicos registrados: OK.");

    await assert.rejects(
        () => circuito.ejecutar(bancoConFallo),
        { code: "BANCO_CIRCUITO_ABIERTO" }
    );

    assert.equal(llamadas, 3);
    console.log("Cobro bloqueado sin llamar al banco: OK.");

    await new Promise(resolve => setTimeout(resolve, 150));

    let completarPrueba;

    const pruebaEnCurso = circuito.ejecutar(() =>
        new Promise(resolve => {
            completarPrueba = resolve;
        })
    );

    await assert.rejects(
        () => circuito.ejecutar(async () => "otro cobro"),
        { code: "BANCO_CIRCUITO_ABIERTO" }
    );

    console.log("Solo una prueba simultánea: OK.");

    completarPrueba({ estado: "APROBADO" });
    await pruebaEnCurso;

    const resultado = await circuito.ejecutar(
        async () => ({ estado: "APROBADO" })
    );

    assert.equal(resultado.estado, "APROBADO");
    console.log("Circuito recuperado: OK.");

    for (let intento = 1; intento <= 4; intento++) {
        const rechazo = await circuito.ejecutar(
            async () => ({ estado: "RECHAZADO" })
        );

        assert.equal(rechazo.estado, "RECHAZADO");
    }

    console.log("Rechazos comerciales no abren el circuito: OK.");
    console.log("Todas las comprobaciones pasaron.");
}

probar().catch(error => {
    console.error("Falló la prueba:", error);
    process.exitCode = 1;
});