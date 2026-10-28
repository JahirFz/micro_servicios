(() => {
    const CLAVE = "fertech.tema";
    const preferenciaSistema = window.matchMedia(
        "(prefers-color-scheme: dark)"
    );

    let preferenciaGuardada = null;

    try {
        const valor = localStorage.getItem(CLAVE);

        if (valor === "claro" || valor === "oscuro") {
            preferenciaGuardada = valor;
        }
    } catch {
        // El tema funciona aunque el almacenamiento no esté disponible.
    }

    function actualizarBotones() {
        const oscuro =
            document.documentElement.dataset.tema === "oscuro";

        document.querySelectorAll("#cambiar-tema").forEach(boton => {
            boton.textContent = oscuro ? "Tema claro" : "Tema oscuro";
            boton.setAttribute(
                "aria-label",
                oscuro ? "Activar tema claro" : "Activar tema oscuro"
            );
        });
    }

    function aplicarTema(tema) {
        document.documentElement.dataset.tema = tema;
        actualizarBotones();
    }

    aplicarTema(
        preferenciaGuardada ||
        (preferenciaSistema.matches ? "oscuro" : "claro")
    );

    document.addEventListener("DOMContentLoaded", () => {
        actualizarBotones();

        document.querySelectorAll("#cambiar-tema").forEach(boton => {
            boton.addEventListener("click", () => {
                const nuevoTema =
                    document.documentElement.dataset.tema === "oscuro"
                        ? "claro"
                        : "oscuro";

                preferenciaGuardada = nuevoTema;
                aplicarTema(nuevoTema);

                try {
                    localStorage.setItem(CLAVE, nuevoTema);
                } catch {
                    // Mantener el cambio al menos en la página actual.
                }
            });
        });
    });

    preferenciaSistema.addEventListener("change", evento => {
        if (!preferenciaGuardada) {
            aplicarTema(evento.matches ? "oscuro" : "claro");
        }
    });

    window.addEventListener("storage", evento => {
        if (evento.key !== CLAVE && evento.key !== null) return;

        preferenciaGuardada =
            evento.newValue === "claro" || evento.newValue === "oscuro"
                ? evento.newValue
                : null;

        aplicarTema(
            preferenciaGuardada ||
            (preferenciaSistema.matches ? "oscuro" : "claro")
        );
    });
})();