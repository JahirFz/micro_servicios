// Detalles visuales: marca estados, categorías y existencias con
// atributos data-* para que el CSS les dé color e ícono.
// No modifica textos, datos ni el comportamiento de las páginas.
(() => {
    const ESTADOS = {
        Pendiente: "pendiente",
        Confirmado: "confirmado",
        Cancelado: "cancelado",
        Activo: "activo",
        Inactivo: "inactivo"
    };

    const CATEGORIAS = [
        ["audifonos", /aud[ií]fono|auricular|headset|diadema|earbud/i],
        ["teclado", /teclado|keyboard/i],
        ["mouse", /mouse|rat[oó]n/i],
        ["laptop", /laptop|port[aá]til|notebook|computadora|macbook/i],
        ["monitor", /monitor|pantalla|display|televisi[oó]n|\btv\b/i],
        ["tableta", /tablet|tableta|ipad/i],
        ["celular", /celular|tel[eé]fono|smartphone|iphone|galaxy/i],
        ["reloj", /reloj|smartwatch|watch|pulsera/i],
        ["bocina", /bocina|altavoz|speaker|barra de sonido/i],
        ["camara", /c[aá]mara|webcam/i],
        ["memoria", /\busb\b|memoria|ssd|disco|almacenamiento|\bsd\b/i],
        ["cable", /cable|cargador|adaptador|\bhub\b|power ?bank|bater[ií]a/i],
        ["consola", /consola|control|gamepad|joystick|playstation|xbox|nintendo/i]
    ];

    const STOCK_BAJO = 5;

    function marcarEstado(elemento) {
        const texto = elemento.textContent
            .replace(/^Estado:\s*/, "")
            .trim();

        const estado = ESTADOS[texto];

        if (estado) {
            if (elemento.dataset.estado !== estado) {
                elemento.dataset.estado = estado;
            }
        } else if (elemento.dataset.estado) {
            delete elemento.dataset.estado;
        }
    }

    function categoria(nombre) {
        const encontrada = CATEGORIAS.find(([, patron]) =>
            patron.test(nombre)
        );

        return encontrada ? encontrada[0] : "general";
    }

    function marcarProducto(tarjeta, selectorNombre, selectorStock) {
        const nombre =
            tarjeta.querySelector(selectorNombre)?.textContent || "";

        if (!nombre) return;

        const tipo = categoria(nombre);

        if (tarjeta.dataset.categoria !== tipo) {
            tarjeta.dataset.categoria = tipo;
        }

        const stock = tarjeta.querySelector(selectorStock)?.textContent || "";
        const cantidad = Number(stock.match(/\d+/)?.[0]);

        let nivel = "";

        if (/sin existencias/i.test(stock) || cantidad === 0) {
            nivel = "agotado";
        } else if (cantidad > 0 && cantidad <= STOCK_BAJO) {
            nivel = "bajo";
        }

        if (nivel) {
            tarjeta.dataset.stock = nivel;
        } else {
            delete tarjeta.dataset.stock;
        }
    }

    function decorar() {
        document.querySelectorAll(
            ".pedido-historial__estado, #etiqueta-estado, " +
            ".admin__tarjeta p, #datos-pedido dd"
        ).forEach(marcarEstado);

        document.querySelectorAll(".tarjeta-producto").forEach(tarjeta =>
            marcarProducto(
                tarjeta,
                ".tarjeta-producto__nombre",
                ".tarjeta-producto__stock"
            )
        );

        document.querySelectorAll(".linea-carrito").forEach(linea =>
            marcarProducto(
                linea,
                ".linea-carrito__nombre",
                ".linea-carrito__stock"
            )
        );
    }

    let pendiente = false;

    function programar() {
        if (pendiente) return;

        pendiente = true;

        requestAnimationFrame(() => {
            pendiente = false;
            decorar();
        });
    }

    function resaltarContador() {
        const contador = document.querySelector(
            ".catalogo > #estado-carrito"
        );

        if (!contador) return;

        let anterior = contador.textContent;

        new MutationObserver(() => {
            if (contador.textContent === anterior) return;

            anterior = contador.textContent;

            // Reiniciar la animación en cada cambio.
            delete contador.dataset.resaltar;
            void contador.offsetWidth;
            contador.dataset.resaltar = "";
        }).observe(contador, {
            childList: true,
            characterData: true,
            subtree: true
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        decorar();
        resaltarContador();

        // Solo se observan cambios de contenido, no de atributos,
        // para no reaccionar a las marcas que pone este mismo script.
        new MutationObserver(programar).observe(document.body, {
            childList: true,
            characterData: true,
            subtree: true
        });
    });
})();
