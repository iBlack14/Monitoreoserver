# Monitox Pro - Server

Este es el backend del sistema de monitoreo Monitox Pro, diseñado para ser desplegado en **Easypanel** o cualquier servidor Node.js.

## 🚀 Despliegue en Easypanel

1. Crea una nueva **App** en Easypanel.
2. Selecciona **Github** o sube estos archivos.
3. El `Dockerfile` incluido configurará automáticamente el entorno.
4. **Variables de Entorno (.env):**
   - `PORT`: 3000
   - `JWT_SECRET`: (Tu clave secreta para el panel admin)
   - `ADMIN_USERNAME`: Tu usuario de admin
   - `ADMIN_PASSWORD`: Tu contraseña de admin

## 🛠️ Tecnologías
- Node.js
- Express
- Socket.io (Comunicación en tiempo real)
- JWT (Autenticación segura)
