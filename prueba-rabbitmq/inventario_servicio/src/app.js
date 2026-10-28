const express = require("express");
const rutasProductos = require("./rutas/productos");
const adminProductos = require("./rutas/adminProductos");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));

app.use("/productos", rutasProductos);
app.use("/admin/productos", adminProductos);

app.use((req, res) => {
    res.status(404).json({
        error: {
            codigo: "RUTA_NO_ENCONTRADA",
            mensaje: "La ruta solicitada no existe."
        }
    });
});

module.exports = app;