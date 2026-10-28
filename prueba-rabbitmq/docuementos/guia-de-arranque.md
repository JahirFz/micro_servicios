# Fertech — Guía de arranque local

## 1. Servicios de infraestructura

### MySQL

Abrir XAMPP Control Panel e iniciar MySQL.

Apache solo es necesario para utilizar phpMyAdmin.

### RabbitMQ y MongoDB

Abrir Docker Desktop y esperar a que termine de iniciar.

Ejecutar en PowerShell:

docker start pasarela-rabbitmq fertech-mongodb

Comprobar los contenedores:

docker ps

## 2. Configuración normal del banco

Archivo: simulador_banco/.env

PORT=3005
BANCO_ESCENARIO=APROBADO
BANCO_DEMORA_MS=200

Archivo: pagos_servicio/.env

BANCO_URL=http://127.0.0.1:3005
BANCO_TIMEOUT_MS=2000

Después de cambiar el .env del banco, reiniciar su proceso.

## 3. Iniciar las aplicaciones

Abrir una terminal por proceso, dentro de la carpeta indicada.

| Carpeta | Comando |
|---|---|
| autorizacion_servicio | node src/server.js |
| inventario_servicio | node src/server.js |
| inventario_servicio | node src/consumidor.js |
| inventario_servicio | node src/publicador-outbox.js |
| orden_servicio | node src/server.js |
| orden_servicio | node src/consumidor.js |
| orden_servicio | node src/publicador-outbox.js |
| simulador_banco | node src/server.js |
| pagos_servicio | node src/consumidor.js |
| pagos_servicio | node src/publicador-outbox.js |
| pagos_servicio | node src/trabajador-pagos.js |
| frontend | node src/server.js |

Iniciar el banco antes del trabajador de Pagos.

Mantener una sola instancia de cada proceso.
No ejecutar procesar-pedido.js mientras el trabajador esté activo.

## 4. Direcciones

- Tienda: http://127.0.0.1:3000/
- Acceso: http://127.0.0.1:3000/acceso.html
- Historial: http://127.0.0.1:3000/mis-pedidos.html
- Administración: http://127.0.0.1:3000/admin.html
- RabbitMQ: http://127.0.0.1:15672/

Usar siempre 127.0.0.1:3000 para la tienda.
localhost y 127.0.0.1 tienen almacenamientos separados en el navegador.

No incluir contraseñas ni JWT_SECRET en esta documentación.

## 5. Comprobación rápida

1. Abrir la tienda y comprobar que carga productos.
2. Iniciar sesión como CLIENTE.
3. Agregar un producto con existencias.
4. Completar la compra.
5. Comprobar que el pedido termina en Confirmado.
6. Abrir el historial y consultar el detalle.
7. Cerrar sesión.
8. Entrar como ADMIN y comprobar el panel.

## 6. Diagnóstico

### ECONNREFUSED al iniciar una API con MySQL

Comprobar que MySQL esté encendido y que DB_HOST y DB_PORT
coincidan con la configuración de XAMPP.

### ER_DBACCESS_DENIED_ERROR

Comprobar DB_USER, DB_NAME y los permisos del usuario de MySQL.

### EADDRINUSE

El puerto está ocupado. Revisar si el proceso ya está ejecutándose
en otra terminal antes de iniciar otra instancia.

### TOKEN_INVALIDO

Iniciar sesión nuevamente. Si solo falla un servicio, comprobar
su JWT_SECRET y reiniciar la API después de corregir el .env.

### Pedido detenido en RESERVANDO o PAGANDO

Revisar consumidores, publicadores y sus errores.
No crear otro pedido para intentar desbloquear el anterior.

Comprobar las colas:

docker exec pasarela-rabbitmq rabbitmqctl list_queues name messages_ready messages_unacknowledged consumers

Comprobar el outbox del servicio que debe enviar el siguiente mensaje.

PUBLICADO significa que RabbitMQ confirmó la publicación;
no garantiza que el consumidor haya completado la operación.

### Cancelaciones con OPERACION_RECUPERADA

Comprobar que solo exista un trabajador de Pagos y que no se esté
ejecutando simultáneamente el procesamiento manual.

## 7. Finalizar una demostración

1. Dejar que los pedidos en curso terminen.
2. Detener el trabajador de Pagos con Ctrl+C.
3. Detener los demás procesos de Node.js con Ctrl+C.
4. Detener los contenedores si ya no se utilizarán:

docker stop pasarela-rabbitmq fertech-mongodb

5. Detener MySQL desde XAMPP.