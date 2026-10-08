# Punto Verde Express v4 — GPS en tiempo real

Versión enfocada en una experiencia de delivery para Guadalupe y Chepén.

## Incluye
- Menú del informe: lunes a viernes, 3 entradas + 3 segundos.
- Sábado: parrillas únicamente.
- Precio referencial S/12.
- Delivery referencial: S/3 Guadalupe / S/5 Chepén.
- Cliente: pedido, carrito/pedido simple, estado y mapa.
- Repartidor: panel independiente con activación de GPS.
- Geolocalización del navegador con `watchPosition`.
- Actualizaciones de ubicación en tiempo real mediante Socket.IO.
- Mapa con Leaflet + OpenStreetMap.

## Uso
Cliente:
- Abre `/`
- Hace un pedido y guarda el código `PV-xxxxxx`.
- En "Seguimiento de pedido" verá el mapa cuando el repartidor comparta ubicación.

Repartidor:
- Abre `/?modo=repartidor`
- Coloca el código del pedido.
- Pulsa "Iniciar GPS" y permite la ubicación.
- Cambia el estado del pedido desde el panel.

## Despliegue
En Render:
- Build Command: `npm install`
- Start Command: `npm start`
- Sin Root Directory si los archivos están en la raíz del repositorio.

El GPS del navegador requiere HTTPS (Render lo proporciona al publicar el servicio) y permiso de ubicación del usuario.

## Nota
Esta versión usa memoria del servidor para los pedidos y ubicaciones; al reiniciar el servicio se pierden. Para operar comercialmente se debe añadir una base de datos, autenticación de clientes/repartidores, control de acceso y un sistema de pagos.
