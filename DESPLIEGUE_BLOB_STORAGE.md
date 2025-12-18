# Despliegue con HTML en Blob Storage y API Separada

## 📋 Arquitectura

```
┌─────────────────────┐
│  Azure Blob Storage │  ← HTML estático (informe_completo.html)
│  (Sitio Web)        │
└──────────┬──────────┘
           │
           │ HTTP Requests (CORS)
           │
┌──────────▼──────────┐
│  Azure App Service  │  ← API Backend (server.js)
│  o Azure Functions  │
└──────────┬──────────┘
           │
           │ SQL Connection
           │
┌──────────▼──────────┐
│  Azure SQL Database  │  ← Base de datos
└─────────────────────┘
```

## 🔧 Configuración Paso a Paso

### Paso 1: Configurar la URL de la API en el HTML

Edita `informe_completo.html` y configura la URL de tu API:

```javascript
// Línea ~659
const API_BASE_URL = 'https://tu-api-backend.azurewebsites.net'; // ⚠️ CONFIGURA ESTA URL
```

**Opciones:**
- **Azure App Service**: `https://nombre-app.azurewebsites.net`
- **Azure Functions**: `https://nombre-function-app.azurewebsites.net`
- **Desarrollo local**: `http://localhost:3000`

### Paso 2: Desplegar la API Backend

#### Opción A: Azure App Service (Recomendado)

1. **Crear App Service:**
   - Azure Portal → "Crear un recurso" → "App Service"
   - Nombre: `webcontrolhoras-api` (o el que prefieras)
   - Runtime stack: Node.js 18 LTS o superior
   - Plan: Básico o superior

2. **Configurar Variables de Entorno:**
   - App Service → "Configuración" → "Variables de aplicación"
   - Agregar:
     ```
     DB_USER = administrador
     DB_PASSWORD = l0g1C4l1S2025
     DB_SERVER = controlhoraslogicalis.database.windows.net
     DB_NAME = bbddcontrolhoras
     ALLOWED_ORIGIN = https://webcontrolhoras.z6.web.core.windows.net
     NODE_ENV = production
     ```

3. **Desplegar código:**
   ```bash
   # Opción 1: Git Deployment
   git remote add azure https://tu-app.scm.azurewebsites.net:443/tu-app.git
   git push azure main
   
   # Opción 2: ZIP Deploy
   # Comprimir: server.js, package.json, node_modules
   # Azure Portal → App Service → "Centro de implementación" → "ZIP Deploy"
   ```

4. **Obtener IP de salida:**
   - App Service → "Propiedades" → copiar "IP de salida"

#### Opción B: Azure Functions (Alternativa)

1. Crear Function App
2. Crear HTTP Trigger
3. Copiar código de `server.js` adaptado a Functions
4. Configurar variables de entorno

### Paso 3: Configurar CORS en el Backend

El archivo `server.js` ya tiene CORS configurado. Asegúrate de:

1. **Actualizar orígenes permitidos:**
   ```javascript
   const allowedOrigins = [
       'https://webcontrolhoras.z6.web.core.windows.net', // Tu URL de Blob Storage
       // Agregar más si es necesario
   ];
   ```

2. **O usar variable de entorno:**
   - En App Service, agregar: `ALLOWED_ORIGIN=https://webcontrolhoras.z6.web.core.windows.net`

### Paso 4: Configurar Firewall de SQL Database

**IMPORTANTE**: Solo permitir acceso desde la IP del servidor de la API, NO desde todas las IPs.

1. **Obtener IP de salida del App Service:**
   - Azure Portal → App Service → "Propiedades" → "IP de salida"
   - Copiar esta IP

2. **Agregar regla de firewall:**
   - Azure Portal → SQL Server → `controlhoraslogicalis`
   - "Seguridad" → "Redes"
   - "Agregar regla de firewall del cliente"
   - Nombre: `AppService-API`
   - IP inicial: `IP_DE_SALIDA_DEL_APP_SERVICE`
   - IP final: `IP_DE_SALIDA_DEL_APP_SERVICE`
   - Guardar

3. **Desactivar acceso público (opcional pero recomendado):**
   - Si usas Private Endpoint, desactiva el acceso público
   - Esto asegura que solo el App Service pueda conectarse

### Paso 5: Subir HTML a Blob Storage

1. **Subir `informe_completo.html`:**
   - Azure Portal → Storage Account → "Contenedores" → `$web`
   - Subir `informe_completo.html`
   - Asegúrate de que esté configurado como `index.html` o accesible directamente

2. **Verificar URL:**
   - La URL será: `https://webcontrolhoras.z6.web.core.windows.net/informe_completo.html`
   - O si está como index: `https://webcontrolhoras.z6.web.core.windows.net`

## 🔒 Seguridad

### Configuración Recomendada:

1. **SQL Database Firewall:**
   - ✅ Permitir solo IP del App Service
   - ❌ NO permitir 0.0.0.0 - 255.255.255.255
   - ❌ Desactivar "Permitir servicios de Azure" si no es necesario

2. **CORS en API:**
   - ✅ Permitir solo el origen de tu Blob Storage
   - ✅ Usar `ALLOWED_ORIGIN` en producción
   - ❌ NO usar `origin: '*'` en producción

3. **Variables de Entorno:**
   - ✅ Usar Azure App Service "Variables de aplicación"
   - ✅ NO hardcodear credenciales en el código
   - ✅ Considerar Azure Key Vault para producción

## 🧪 Pruebas

### 1. Probar API directamente:

```bash
curl https://tu-api-backend.azurewebsites.net/api/registros
```

### 2. Probar desde el navegador:

1. Abre la URL de tu Blob Storage
2. Abre la consola del navegador (F12)
3. Verifica que las peticiones a la API funcionen
4. Si hay errores CORS, verifica la configuración

### 3. Verificar conexión SQL:

En los logs del App Service, deberías ver:
```
✅ Conectado a SQL Server
```

## 📝 Checklist de Despliegue

- [ ] API desplegada en Azure App Service
- [ ] Variables de entorno configuradas en App Service
- [ ] CORS configurado para permitir origen del Blob Storage
- [ ] Firewall de SQL Database configurado con IP del App Service
- [ ] HTML actualizado con URL correcta de la API
- [ ] HTML subido a Blob Storage
- [ ] Pruebas realizadas desde el navegador
- [ ] Logs del App Service verificados

## 🔧 Troubleshooting

### Error: "CORS policy: No 'Access-Control-Allow-Origin'"

**Solución:**
1. Verifica que la URL del Blob Storage esté en `allowedOrigins` del servidor
2. Verifica la variable `ALLOWED_ORIGIN` en App Service
3. Revisa los logs del App Service para ver qué origen está intentando acceder

### Error: "Cannot connect to SQL Server"

**Solución:**
1. Verifica que la IP del App Service esté en las reglas de firewall
2. Verifica las credenciales en las variables de entorno
3. Verifica que el servidor SQL esté activo

### Error: "Failed to fetch" en el navegador

**Solución:**
1. Verifica que la URL de la API en el HTML sea correcta
2. Verifica que el App Service esté corriendo
3. Abre la consola del navegador para ver el error completo

## 🚀 Mejoras Futuras

1. **Usar Private Endpoint** para comunicación privada entre App Service y SQL Database
2. **Azure Key Vault** para almacenar credenciales de forma segura
3. **Azure AD Authentication** en lugar de usuario/contraseña
4. **Application Insights** para monitoreo y logs

