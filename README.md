# Punto Verde Express — Guadalupe + Chepén

MVP funcional de delivery local.

## Incluye
- Cliente: catálogo, carrito y pedidos.
- Restricción de cobertura: Guadalupe y Chepén.
- Administrador: pedidos y estados.
- Repartidor: conexión y GPS del navegador.
- Socket.IO: actualizaciones en tiempo real.
- Leaflet + OpenStreetMap: mapas.

## Ejecutar
1. Instalar Node.js 18+.
2. `npm install`
3. `npm start`
4. Abrir `http://localhost:3000`.

Para GPS en producción, usar HTTPS. Esta versión usa memoria del servidor para los pedidos; para operación real hay que conectar una base de datos, autenticación, pagos y despliegue seguro.
