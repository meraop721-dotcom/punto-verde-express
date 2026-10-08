# Punto Verde Express v4.1 — Panel de pedidos

Incluye:
- Menú actualizado según el informe.
- Pedidos reales contra la API.
- Panel `/?modo=admin` para ver pedidos recibidos.
- Actualización de estados desde el panel.
- Notificación en tiempo real de nuevos pedidos con Socket.IO.
- Dirección obligatoria para delivery.
- Seguimiento del repartidor cuando haya GPS conectado.

IMPORTANTE:
Esta versión mantiene los pedidos en memoria del servidor; si Render reinicia el servicio, los pedidos se pierden.
Para operación real se debe conectar una base de datos persistente, autenticación del administrador/repartidor, seguridad y pagos.
