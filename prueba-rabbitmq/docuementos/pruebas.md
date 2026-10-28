# Fertech — Registro de pruebas

## Entorno

- Windows, Node.js y navegador web.
- MySQL/MariaDB mediante XAMPP.
- RabbitMQ y MongoDB mediante Docker.
- Banco simulado local.
- Una sola instancia del trabajador de Pagos.

## Resultados

Las siguientes pruebas fueron ejecutadas durante el desarrollo.
Las evidencias visuales deben adjuntarse antes de la entrega.

| ID | Prueba | Resultado esperado | Resultado obtenido |
|---|---|---|---|
| P01 | Acceso correcto | Iniciar sesión y mostrar el nombre del usuario | Correcto |
| P02 | Credenciales incorrectas | Mostrar error sin iniciar sesión | Correcto |
| P03 | Compra aprobada | Pedido CONFIRMED y reserva CONFIRMADA | Correcto |
| P04 | Pago rechazado | Pedido CANCELLED y reserva LIBERADA | Correcto |
| P05 | Timeout bancario | Cancelación con BANCO_TIMEOUT y operación sin cargo | Correcto |
| P06 | Procesamiento automático | Completar la compra sin ejecutar el pago manualmente | Correcto |
| P07 | Historial paginado | Mostrar pedidos propios sin repetir registros entre páginas | Correcto |
| P08 | Acceso a pedido ajeno | Negar la consulta y responder 404 | Correcto |
| P09 | Rutas administrativas | ADMIN recibe 200 y CLIENTE recibe 403 | Correcto |
| P10 | Error de conexión del catálogo | Mostrar error y permitir recuperar los productos | Correcto |
| P11 | Sesión inválida en checkout | Regresar a Acceso y permitir continuar la compra | Correcto |
| P12 | Temas | Conservar claro/oscuro al navegar y recargar | Correcto |
| P13 | Teclado | Controles accesibles y foco visible | Correcto |
| P14 | Diseño adaptable y zoom | Contenido utilizable sin desbordamiento horizontal | Correcto |
| P15 | Resumen administrativo | Indicadores coincidentes con las consultas SQL | Correcto |
| P16 | Detalle administrativo | ADMIN consulta pedidos y CLIENTE no puede acceder | Correcto |
| P17 | Circuit breaker | Abrir, bloquear, permitir una prueba y recuperarse | Correcto |

## Procedimientos principales

### P03 — Compra aprobada

1. Configurar el banco en APROBADO con demora de 200 ms.
2. Reiniciar el banco.
3. Iniciar sesión como cliente.
4. Agregar un producto con existencias.
5. Confirmar la compra desde el checkout.
6. Esperar el resultado en el detalle.

Resultado esperado:
Pedido CONFIRMED, fase FINALIZADA y reserva CONFIRMADA.

### P04 — Pago rechazado

1. Anotar el stock disponible del producto.
2. Configurar el banco en RECHAZADO con demora de 200 ms.
3. Reiniciar el banco.
4. Crear una compra nueva.
5. Esperar la cancelación.
6. Comprobar la reserva y el stock.

Resultado esperado:
Pedido CANCELLED, reserva LIBERADA y stock devuelto
al valor previo, si no hubo otras compras concurrentes.

### P05 — Timeout

1. Configurar el banco en APROBADO con demora de 3000 ms.
2. Mantener BANCO_TIMEOUT_MS=2000 en Pagos.
3. Reiniciar el banco.
4. Crear una compra nueva.
5. Esperar la cancelación.
6. Esperar a que transcurran los 3000 ms y consultar nuevamente.

Resultado esperado:
Pedido CANCELLED con motivo BANCO_TIMEOUT.
Pago resuelto sin cargo y reserva LIBERADA.
El pedido permanece cancelado después de la demora bancaria.

### P08 — Separación entre cuentas

1. Iniciar sesión con un cliente sin pedidos.
2. Comprobar que su historial está vacío.
3. Abrir la dirección de un pedido de otro cliente.

Resultado esperado:
El pedido ajeno no se muestra y la API responde 404.

### P09 — Autorización administrativa

1. Consultar los endpoints administrativos con una cuenta ADMIN.
2. Repetir las consultas con una cuenta CLIENTE.

Resultado esperado:
ADMIN recibe 200.
CLIENTE recibe 403 con ACCESO_DENEGADO.

### P17 — Circuit breaker

Ejecutar desde pagos_servicio:

node src/probar-circuit-breaker.js

Resultado esperado:
Todas las comprobaciones pasan.
Esta prueba utiliza operaciones simuladas en el script;
no realiza cobros ni modifica pagos.

## Incidencias encontradas

### Dos trabajadores de Pagos simultáneos

Se observaron cancelaciones con OPERACION_RECUPERADA
al ejecutar varios procesadores simultáneamente.

Medida aplicada:
Mantener un solo trabajador y no ejecutar el comando manual
mientras esté activo.

Estado:
Limitación operativa vigente. No se implementó un bloqueo
automático ni coordinación distribuida.

## Evidencias pendientes de adjuntar

- E01: compra confirmada y registro de reserva.
- E02: compra rechazada, reserva liberada y stock.
- E03: timeout con motivo BANCO_TIMEOUT y resultado sin cargo.
- E04: historial y rechazo de un pedido ajeno.
- E05: respuestas 200 y 403 de rutas administrativas.
- E06: panel y comprobación SQL de los indicadores.
- E07: interfaz móvil y escritorio.
- E08: tema oscuro y foco visible.
- E09: salida de la prueba del circuit breaker.

No incluir contraseñas, tokens, JWT_SECRET ni archivos .env
en las evidencias.

## Configuración después de las pruebas

Restaurar el banco:

BANCO_ESCENARIO=APROBADO
BANCO_DEMORA_MS=200

Reiniciar el banco después del cambio.