# Punto Verde Express — versión con accesos privados y GPS en tiempo real

Esta versión separa completamente **Cliente**, **Administración** y **Repartidor**.

## Accesos
- Cliente: `/`
- Administración: `/?modo=admin` → requiere usuario y contraseña de administrador.
- Repartidor: `/?modo=repartidor` → requiere una cuenta de repartidor.

Los paneles internos no se protegen solamente ocultando botones: las APIs y el canal Socket.IO también validan el rol y el token de sesión.

## GPS
1. Administración asigna un pedido a un repartidor.
2. El repartidor inicia sesión y solo ve sus pedidos asignados.
3. Al seleccionar una entrega, el navegador solicita permiso de ubicación.
4. El teléfono del repartidor envía la ubicación por Socket.IO en tiempo real.
5. El cliente ve al repartidor en el mapa de su pedido.
6. Administración también puede ver el GPS del pedido.

El GPS requiere HTTPS y permiso de ubicación. Render proporciona HTTPS.

## Variables de entorno para Render
Configura estas variables en **Render → Environment** antes de usar el sistema:

`ADMIN_USER` = usuario del administrador

`ADMIN_PASSWORD` = contraseña segura del administrador

`DRIVERS_JSON` = lista JSON de repartidores. Ejemplo:

```json
[{"username":"delivery1","password":"CLAVE_SEGURA_1","name":"Repartidor 1"},{"username":"delivery2","password":"CLAVE_SEGURA_2","name":"Repartidor 2"}]
```

No publiques estas contraseñas en GitHub. Cambia las claves antes de poner el proyecto en uso real.

## Importante
Los pedidos, sesiones y ubicaciones están almacenados en memoria en esta versión. Si Render reinicia el servicio, esos datos se pierden. Para operación comercial real se recomienda conectar una base de datos, autenticación persistente y almacenamiento de pedidos.

## Despliegue
- Build: `npm install`
- Start: `npm start`
