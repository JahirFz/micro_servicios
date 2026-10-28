# Revisión de diseño de Fertech

Alcance: refinamiento del catálogo y estilos compartidos mediante Impeccable (polish) y UX Heuristics. Se conservan contenido, estructura de compra y servicios.

## Evaluación heurística

Puntuación provisional del catálogo: **9/10**, basada en código, interacciones automatizadas con datos simulados y capturas del catálogo en escritorio (1440 px) y móvil (390 px), incluidos ambos temas. No equivale a una prueba del proceso de compra completo.

Diagnóstico: identidad, navegación, acción de recuperación, estado del sistema, etiquetas y alternativas a hover presentes. La búsqueda y la identificación visual por categoría ya están resueltas. La evaluación sigue siendo provisional: falta validar el recorrido de compra con servicios reales, teclado y lector de pantalla. No se asigna 10/10 sin esa validación.

- Severidad 3: los errores del catálogo podían mostrar detalles técnicos en inglés. Corregido con un mensaje en español y recuperación explícita.
- Severidad 2, corregida: búsqueda por nombre que ignora acentos y mayúsculas, contador de resultados, estado sin coincidencias y opción de limpiar que devuelve el foco al campo.
- Severidad 2, corregida: iconos de categoría para audífonos, teclados, mouse, portátiles, monitores, teléfonos y altavoces. Se eligen a partir del nombre; las categorías desconocidas usan una caja genérica. No se presentan como fotos del producto. No hay fotografías reales en el repositorio.
- Severidad 1: precios poco destacados y ubicación actual sin marcar. Corregidos con mayor jerarquía tipográfica y enlace Catálogo con aria-current.

Para aspirar a 10/10: verificar compra completa, teclado y lector de pantalla con servicios disponibles. Las fotos reales y categorías explícitas del catálogo serían una mejora adicional de precisión visual.

## Paleta recomendada y aplicada

| Uso | Claro | Oscuro |
| --- | --- | --- |
| Acción | #086477 | #85D3E3 |
| Fondo | #F7F9FA | #172B33 |
| Texto | #172B33 | #F1F6F7 |
| Texto secundario | #52636B | #BDCDD3 |
| Acento suave | #E4F1F4 | #233F49 |
| Error | #B42332 | #FFADB4 |

El azul petróleo concentra la atención en acciones y marca. Los fondos neutros mantienen legibilidad y el rojo identifica errores junto a un mensaje textual. Tokens: frontend/public/css/tokens.css.

## Validación

Contraste calculado de texto principal, secundario, botones normales y hover y errores contra sus fondos: todos superan 4.5:1 en ambos temas. Pruebas automatizadas en Chrome con API local simulada: búsqueda sin acentos, contador, ausencia de coincidencias, limpiar y devolver foco, iconos, producto agotado, agregar al carrito, reintento tras error, catálogo vacío, cambio de tema y ausencia de desbordamiento a 390 px. Capturas revisadas del catálogo de seis productos, incluido un nombre largo, en escritorio y móvil y en tema oscuro móvil. Datos simulados exclusivos de la verificación, sin modificar servicios ni inventario real. Compra completa con API real pendiente.

Detector de Impeccable ejecutado una vez: sin hallazgos por expresiones regulares, pero degradado por ausencia de htmlparser2, css-select, css-tree y domutils. No evaluó selectores ni contraste calculado. No hay pruebas frontend configuradas.
