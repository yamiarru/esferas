# esferas

Ecommerce demo con calendario de turnos, manejo de sesión y confirmaciones simuladas por correo. No requiere dependencias externas (usa solo Node.js estándar) para facilitar la ejecución en entornos sin internet.

## Cómo ejecutar
1. Instala Node.js 18+.
2. Ejecuta:
   ```bash
   npm install   # no instala paquetes externos, deja preparado npm
   npm start
   ```
3. Abre `http://localhost:3000` en el navegador.

Variables de entorno opcionales:
- `PORT`: Puerto del servidor (por defecto 3000).
- `OWNER_EMAIL`: Correo del dueño que recibirá notificaciones simuladas.

## Funcionalidades clave
- **Manejo de sesión**: inicio/cierre de sesión con cookie propia.
- **Calendario**: cambio de mes, selección de fecha, formulario de datos, elección de pago (MercadoPago o en persona) y simulación de envío de correos con archivo ICS.
- **Carrusel**: destacado de productos/servicios.
- **Pastillas**: fichas con foto y descripción agregadas desde el formulario.
- **Mapa y navegación**: botón de ubicación con anclaje a la sección y descripción de la dirección.
- **Footer**: Calle Wallaby, copyright 2026 y accesos a redes.

## Notas sobre los correos
Los correos no se envían realmente: se registran en `email-log.txt` y se generan archivos `.ics` de ejemplo en la raíz del proyecto, mostrando el contenido que se enviaría tanto al cliente como al dueño del local.
