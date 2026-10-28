const path = require("node:path");
const express = require("express");

require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const app = express();
const puerto = Number(process.env.PORT || 3000);

if (
    !Number.isInteger(puerto) ||
    puerto < 1 ||
    puerto > 65535
) {
    throw new Error("PORT inválido.");
}

const servicios = {
    auth: process.env.AUTH_URL,
    inventario: process.env.INVENTARIO_URL,
    pedidos: process.env.PEDIDOS_URL
};

for (const [nombre, direccion] of Object.entries(servicios)) {
    if (!direccion) {
        throw new Error(`Falta configurar la URL de ${nombre}.`);
    }

    const url = new URL(direccion);

    if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error(`URL de ${nombre} inválida.`);
    }

    servicios[nombre] = url.origin;
}

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));

function reenviar(servicio, obtenerRuta) {
    return async (req, res) => {
        res.set("Cache-Control", "no-store");

        const controlador = new AbortController();
        const temporizador = setTimeout(
            () => controlador.abort(),
            10000
        );

        try {
            const headers = {
                Accept: "application/json"
            };

            for (const nombre of [
                "authorization",
                "idempotency-key"
            ]) {
                const valor = req.get(nombre);

                if (valor) {
                    headers[nombre] = valor;
                }
            }

            const tieneCuerpo = req.method === "POST";

            if (tieneCuerpo) {
                headers["Content-Type"] = "application/json";
            }

            const respuesta = await fetch(
                `${servicios[servicio]}${obtenerRuta(req)}`,
                {
                    method: req.method,
                    headers,
                    body: tieneCuerpo
                        ? JSON.stringify(req.body ?? {})
                        : undefined,
                    signal: controlador.signal,
                    redirect: "error"
                }
            );

            const contenido = await respuesta.text();

            for (const nombre of [
                "content-type",
                "retry-after",
                "location"
            ]) {
                const valor = respuesta.headers.get(nombre);

                if (valor) {
                    res.set(nombre, valor);
                }
            }

            res.status(respuesta.status).send(contenido);
        } catch (error) {
            console.error(
                `No se pudo contactar con ${servicio}:`,
                error.message
            );

            res.status(
                controlador.signal.aborted ? 504 : 502
            ).json({
                error: {
                    codigo: "SERVICIO_NO_DISPONIBLE",
                    mensaje:
                        "No pudimos completar la solicitud. Intenta nuevamente."
                }
            });
        } finally {
            clearTimeout(temporizador);
        }
    };
}

app.post(
    "/api/auth/login",
    reenviar("auth", () => "/auth/login")
);

app.get(
    "/api/auth/me",
    reenviar("auth", () => "/auth/me")
);

app.get(
    "/api/productos",
    reenviar("inventario", () => "/productos")
);

app.get(
    "/api/productos/:id",
    reenviar(
        "inventario",
        req => `/productos/${encodeURIComponent(req.params.id)}`
    )
);

app.post(
    "/api/pedidos",
    reenviar("pedidos", () => "/pedidos")
);

app.get(
    "/api/pedidos",
    reenviar("pedidos", req => {
        const parametros = new URLSearchParams();

        for (const nombre of ["limite", "antes_de"]) {
            if (req.query[nombre] !== undefined) {
                if (typeof req.query[nombre] !== "string") {
                    // El servicio rechazará el valor inválido.
                    parametros.set(nombre, "invalido");
                } else {
                    parametros.set(nombre, req.query[nombre]);
                }
            }
        }

        return `/pedidos?${parametros.toString()}`;
    })
);

app.get(
    "/api/pedidos/:id",
    reenviar(
        "pedidos",
        req => `/pedidos/${encodeURIComponent(req.params.id)}`
    )
);

app.get(
    "/api/admin/pedidos",
    reenviar("pedidos", req => {
        const parametros = new URLSearchParams();

        for (const nombre of ["limite", "antes_de"]) {
            if (req.query[nombre] !== undefined) {
                parametros.set(
                    nombre,
                    typeof req.query[nombre] === "string"
                        ? req.query[nombre]
                        : "invalido"
                );
            }
        }

        return `/admin/pedidos?${parametros.toString()}`;
    })
);

app.get(
    "/api/admin/productos",
    reenviar("inventario", req => {
        const parametros = new URLSearchParams();

        if (req.query.antes_de !== undefined) {
            parametros.set(
                "antes_de",
                typeof req.query.antes_de === "string"
                    ? req.query.antes_de
                    : "invalido"
            );
        }

        return `/admin/productos?${parametros.toString()}`;
    })
);

app.use(
    express.static(path.resolve(__dirname, "../public"))
);

app.get(
    "/api/admin/pedidos/resumen",
    reenviar("pedidos", () => "/admin/pedidos/resumen")
);

app.get(
    "/api/admin/productos/resumen",
    reenviar("inventario", () => "/admin/productos/resumen")
);

app.get(
    "/api/admin/pedidos/:id",
    reenviar(
        "pedidos",
        req => `/admin/pedidos/${encodeURIComponent(req.params.id)}`
    )
);

app.use((req, res) => {
    res.status(404).json({
        error: {
            codigo: "RUTA_NO_ENCONTRADA",
            mensaje: "La dirección solicitada no existe."
        }
    });
});


app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    const estado = error.type === "entity.parse.failed"
        ? 400
        : error.type === "entity.too.large"
            ? 413
            : 500;

    res.status(estado).json({
        error: {
            codigo: "SOLICITUD_INVALIDA",
            mensaje: "No pudimos procesar la solicitud."
        }
    });
});

const servidor = app.listen(puerto, "127.0.0.1", () => {
    console.log(
        `Frontend disponible en http://127.0.0.1:${puerto}`
    );
});

servidor.on("error", error => {
    console.error(
        "No se pudo iniciar el frontend:",
        error.message
    );

    process.exitCode = 1;
});