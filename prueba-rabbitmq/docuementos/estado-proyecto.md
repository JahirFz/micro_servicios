# Fertech — Estado del proyecto

## Objetivo

Tienda web académica con pagos simulados, servicios separados
y comunicación asíncrona mediante RabbitMQ.

## Tecnologías

- Frontend: HTML, CSS y JavaScript con módulos.
- Servidor del frontend y servicios: Node.js y Express.
- Autenticación, Pedidos e Inventario: MySQL/MariaDB en XAMPP.
- Pagos: MongoDB con replica set.
- Mensajería: RabbitMQ.
- Banco: simulador local con operaciones persistidas en archivo JSON.

## Funciones implementadas

### Cliente

- Iniciar y cerrar sesión.
- Consultar productos.
- Administrar el carrito.
- Revisar y confirmar una compra.
- Consultar el estado del pedido con actualización automática.
- Consultar el historial con paginación.
- Recuperar el acceso cuando expira la sesión.
- Cambiar y conservar el tema claro u oscuro.

### Administrador

- Consultar pedidos de todos los clientes.
- Consultar el detalle administrativo de un pedido.
- Consultar inventario, incluidos productos inactivos.
- Consultar cantidad de pedidos pendientes.
- Consultar productos activos con cinco unidades disponibles o menos.

El panel administrativo es de consulta: no modifica precios,
existencias, productos ni estados de pedidos.

## Procesamiento de compras

1. Pedidos registra la compra y una solicitud en su outbox.
2. Inventario valida y reserva los productos.
3. Pedidos recibe los precios y solicita el pago.
4. Pagos registra y procesa la operación con el banco simulado.
5. Si el pago se aprueba, se confirma la reserva.
6. Si falla y se resuelve sin cargo, se libera la reserva.
7. El pedido termina en CONFIRMED o CANCELLED.

Los mensajes recibidos se registran para evitar repetir operaciones.
Los resultados de salida se guardan mediante outbox.

## Pruebas realizadas

- Compra aprobada y pedido confirmado.
- Pago rechazado y reserva liberada.
- Timeout bancario, resolución sin cargo y cancelación.
- Procesamiento automático de pagos pendientes.
- Circuit breaker: apertura, bloqueo y recuperación.
- Rechazos comerciales que no abren el circuito.
- Historial y paginación.
- Separación de pedidos entre cuentas.
- ADMIN autorizado y CLIENTE rechazado en rutas administrativas.
- Error de conexión del catálogo y recuperación mediante reintento.
- Sesión inválida durante el checkout y recuperación del acceso.
- Navegación por teclado.
- Tema claro y oscuro.
- Revisión adaptable en móvil, tablet y escritorio, y zoom al 200 %.

Las pruebas funcionales se ejecutaron manualmente.
El circuit breaker también cuenta con un script de comprobación.

## Limitaciones conocidas

- Solo debe ejecutarse un trabajador de Pagos.
- No debe ejecutarse el procesamiento manual mientras el trabajador
  automático esté activo.
- Los publicadores de outbox se ejecutan con una instancia por servicio.
- El circuit breaker mantiene su estado en memoria.
- El rol del JWT permanece vigente hasta su expiración.
- Cerrar sesión elimina el token local, pero no lo revoca en el servidor.
- La sesión se conserva en sessionStorage y el token es accesible
  al JavaScript del sitio.
- El banco es una simulación local; no realiza cobros reales.
- Los procesos requieren arranque manual.
- La comparación visual final con Figma sigue pendiente.
- La solución está preparada para demostración local, no para producción.