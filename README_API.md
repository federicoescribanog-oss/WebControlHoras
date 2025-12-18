# API Backend - Gestión de Recursos Logicalis

## 📋 Descripción

Backend API en Node.js que conecta la aplicación web con Azure SQL Database. Reemplaza el acceso directo a JSON por operaciones CRUD sobre la base de datos.

## 🚀 Instalación

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Copia el archivo `.env.example` a `.env` y configura las credenciales:

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:
```
DB_USER=administrador
DB_PASSWORD=l0g1C4l1S2025
DB_SERVER=controlhoraslogicalis.database.windows.net
DB_NAME=bbddcontrolhoras
PORT=3000
```

### 3. Iniciar el servidor

```bash
# Desarrollo (con auto-reload)
npm run dev

# Producción
npm start
```

El servidor estará disponible en `http://localhost:3000`

## 📡 Endpoints API

### GET /api/registros
Obtiene todos los registros de la tabla `controlhorario`

**Respuesta:**
```json
[
  {
    "id": 1,
    "phase": "Codere",
    "task": "Servicio",
    "milestone": null,
    "start": "01/06/2024",
    "end": "31/12/2026",
    "completion": 0,
    "dependencies": null,
    "assignee": "Daniel Marquez",
    "time": 8
  }
]
```

### POST /api/registros
Inserta un nuevo registro

**Body:**
```json
{
  "phase": "Codere",
  "task": "Servicio",
  "milestone": null,
  "start": "01/06/2024",
  "end": "31/12/2026",
  "completion": 0,
  "dependencies": null,
  "assignee": "Daniel Marquez",
  "time": 8
}
```

**Respuesta:**
```json
{
  "id": 123,
  "message": "Registro insertado correctamente"
}
```

### PUT /api/registros/:id
Actualiza un registro existente

**Body:** (mismo formato que POST)

**Respuesta:**
```json
{
  "message": "Registro actualizado correctamente"
}
```

### DELETE /api/registros/:id
Elimina un registro

**Respuesta:**
```json
{
  "message": "Registro eliminado correctamente"
}
```

## 🔒 Configuración de Seguridad en Azure

### Configurar Firewall de SQL Database

**IMPORTANTE**: Para que solo se pueda acceder desde tu aplicación web:

1. **Obtener IP del servidor:**
   ```bash
   curl ifconfig.me
   ```

2. **Agregar regla en Azure Portal:**
   - Azure Portal → SQL Server → `controlhoraslogicalis`
   - Menú: "Seguridad" → "Redes"
   - "Agregar regla de firewall del cliente"
   - Nombre: `WebServer`
   - IP inicial y final: `TU_IP_AQUI`
   - Guardar

3. **Verificar conexión:**
   ```bash
   node -e "require('mssql').connect('Server=controlhoraslogicalis.database.windows.net;Database=bbddcontrolhoras;User Id=administrador;Password=l0g1C4l1S2025;Encrypt=true').then(() => console.log('OK')).catch(e => console.error(e))"
   ```

Ver documentación completa en `CONFIGURACION_AZURE_SQL.md`

## 🌐 Despliegue en Azure

### Opción 1: Azure App Service

1. Crear App Service en Azure Portal
2. Configurar variables de entorno en "Configuración" → "Variables de aplicación"
3. Agregar IP de salida del App Service a las reglas de firewall de SQL Database
4. Desplegar código (Git, ZIP, etc.)

### Opción 2: Azure Container Instances

1. Crear Dockerfile
2. Publicar imagen en Azure Container Registry
3. Crear Container Instance
4. Configurar variables de entorno
5. Agregar IP a firewall de SQL Database

## 🧪 Pruebas

### Probar endpoints con curl:

```bash
# Obtener todos los registros
curl http://localhost:3000/api/registros

# Insertar nuevo registro
curl -X POST http://localhost:3000/api/registros \
  -H "Content-Type: application/json" \
  -d '{
    "phase": "Test",
    "task": "Prueba",
    "assignee": "Usuario Test",
    "start": "01/01/2025",
    "end": "31/01/2025",
    "time": 8
  }'

# Actualizar registro
curl -X PUT http://localhost:3000/api/registros/1 \
  -H "Content-Type: application/json" \
  -d '{
    "phase": "Test",
    "task": "Prueba Actualizada",
    "assignee": "Usuario Test",
    "start": "01/01/2025",
    "end": "31/01/2025",
    "time": 8
  }'

# Eliminar registro
curl -X DELETE http://localhost:3000/api/registros/1
```

## 📝 Notas

- Las fechas se manejan en formato `DD/MM/YYYY` en el frontend y se convierten a `DATE` en SQL Server
- El campo `id` se genera automáticamente con `IDENTITY(1,1)`
- Los campos `fecha_creacion` y `fecha_actualizacion` se actualizan automáticamente
- El servidor maneja errores de conexión y los devuelve en formato JSON

## 🔧 Troubleshooting

### Error: "Cannot connect to SQL Server"
- Verifica que el firewall de Azure SQL Database permita tu IP
- Verifica las credenciales en `.env`
- Verifica que el servidor SQL esté activo

### Error: "Login failed for user"
- Verifica usuario y contraseña
- Asegúrate de que el usuario tenga permisos en la base de datos

### Error: "Connection timeout"
- Verifica la configuración de red
- Verifica que el servidor SQL Database esté accesible desde tu ubicación

