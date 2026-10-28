const {
    procesarEventoInventario
} = require("./eventoInventarioServicio");

const {
    procesarEventoPago
} = require("./eventoPagoServicio");

const {
    procesarEventoReserva
} = require("./eventoReservaServicio");

async function manejarEvento(mensaje) {
    switch (mensaje?.tipo) {
        case "InventarioReservado":
        case "InventarioRechazado":
            return procesarEventoInventario(mensaje);

        case "PagoAprobado":
        case "PagoFallido":
            return procesarEventoPago(mensaje);

        case "ReservaConfirmada":
        case "ReservaLiberada":
            return procesarEventoReserva(mensaje);

        default:
            throw new Error("Tipo de evento no admitido.");
    }
}

module.exports = { manejarEvento };