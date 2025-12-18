# Guía de Despliegue Completa

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    USUARIO                              │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTPS
                     │
        ┌────────────▼────────────┐
        │  Azure Blob Storage     │
        │  (Sitio Web Estático)   │
        │  informe_completo.html  │
        └────────────┬────────────┘
                     │
                     │ API Calls (CORS)
                     │
        ┌────────────▼────────────┐
        │  Azure App Service      │
        │  (API Backend)          │
        │  server.js              │
        └────────────┬────────────┘
                     │
                     │ SQL Connection
                     │ (Firewall protegido)
                     │
        ┌────────────▼────────────┐
        │  Azure SQL Database     │
        │  bbddcontrolhoras       │
        │  tabla: controlhorario   │
        └─────────────────────────┘
```

## 📋 Pasos de Despliegue

### 1️⃣ Preparar el HTML

**Editar `informe_completo.html` línea ~662:**

```javascript
const API_BASE_URL = isDevelopment 
    ? 'http://localhost:3000'
    : 'https://TU-APP-SERVICE.azurewebsites.net'; // ⚠️ CAMBIAR ESTO
```

### 2️⃣ Crear y Desplegar la API en Azure App Service

#### A. Crear App Service

1. Azure Portal → "Crear un recurso"
2. Buscar "App Service"
3. Crear con:
   - **Nombre**: `webcontrolhoras-api` (debe ser único)
   - **Runtime stack**: Node.js 18 LTS
   - **Plan**: Básico B1 (mínimo para producción)

#### B. Configurar Variables de Entorno

En App Service → "Configuración" → "Variables de aplicación":

```
DB_USER = administrador
DB_PASSWORD = l0g1C4l1S2025
DB_SERVER = controlhoraslogicalis.database.windows.net
DB_NAME = bbddcontrolhoras
ALLOWED_ORIGIN = https://webcontrolhoras.z6.web.core.windows.net
NODE_ENV = production
PORT = 8080 (Azure usa este puerto por defecto)
```

#### C. Desplegar Código

**Opción 1: Git Deployment (Recomendado)**

```bash
# En tu repositorio local
cd c:\Proyectos\WebControlHoras

# Agregar remote de Azure
az webapp deployment source config-local-git --name webcontrolhoras-api --resource-group tu-resource-group

# Obtener URL de Git
az webapp deployment list-publishing-credentials --name webcontrolhoras-api --resource-group tu-resource-group

# Agregar remote
git remote add azure https://webcontrolhoras-api.scm.azurewebsites.net:443/webcontrolhoras-api.git

# Desplegar
git push azure main
```

**Opción 2: ZIP Deploy**

```bash
# Crear ZIP con los archivos necesarios
# Incluir: server.js, package.json, node_modules (o hacer npm install en Azure)

# Usar Azure CLI
az webapp deployment source config-zip \
  --resource-group tu-resource-group \
  --name webcontrolhoras-api \
  --src deploy.zip
```

**Opción 3: Desde Visual Studio Code**

1. Instalar extensión "Azure App Service"
2. Clic derecho en carpeta → "Deploy to Web App"
3. Seleccionar App Service creado

#### D. Verificar Despliegue

```bash
# Probar endpoint
curl https://webcontrolhoras-api.azurewebsites.net/api/registros
```

### 3️⃣ Configurar Firewall de SQL Database

1. **Obtener IP de salida del App Service:**
   - Azure Portal → App Service → "Propiedades"
   - Copiar "IP de salida" (ejemplo: `20.123.45.67`)

2. **Agregar regla de firewall:**
   - Azure Portal → SQL Server → `controlhoraslogicalis`
   - "Seguridad" → "Redes"
   - "Agregar regla de firewall del cliente"
   - Nombre: `AppService-API`
   - IP inicial: `20.123.45.67` (tu IP de salida)
   - IP final: `20.123.45.67`
   - Guardar

3. **Verificar:**
   - Desactivar temporalmente "Permitir servicios de Azure"
   - Probar conexión desde App Service
   - Si funciona, reactivar solo si necesitas otros servicios de Azure

### 4️⃣ Configurar CORS en el Backend

El archivo `server.js` ya tiene CORS configurado. Solo necesitas:

1. **Actualizar URL del Blob Storage en `server.js` línea ~18:**
   ```javascript
   const allowedOrigins = [
       'https://webcontrolhoras.z6.web.core.windows.net', // Tu URL real
   ];
   ```

2. **O usar variable de entorno `ALLOWED_ORIGIN`** (ya configurada en paso 2B)

### 5️⃣ Subir HTML a Blob Storage

1. **Azure Portal** → Storage Account → "Contenedores" → `$web`
2. **Subir** `informe_completo.html`
3. **Verificar URL:** `https://webcontrolhoras.z6.web.core.windows.net/informe_completo.html`

### 6️⃣ Probar Todo el Sistema

1. **Abrir la web:**
   ```
   https://webcontrolhoras.z6.web.core.windows.net/informe_completo.html
   ```

2. **Abrir consola del navegador (F12)**
   - Verificar que no haya errores CORS
   - Verificar que las peticiones a la API funcionen

3. **Probar funcionalidades:**
   - Cargar datos (debe venir de la base de datos)
   - Crear nueva entrada
   - Editar entrada
   - Eliminar entrada

## 🔒 Seguridad - Resumen

### SQL Database Firewall:
- ✅ **Solo IP del App Service** en las reglas
- ❌ **NO** permitir 0.0.0.0 - 255.255.255.255
- ✅ Verificar que solo el App Service pueda conectarse

### CORS:
- ✅ **Solo origen del Blob Storage** permitido
- ✅ Variable `ALLOWED_ORIGIN` configurada
- ❌ **NO** usar `origin: '*'` en producción

### Credenciales:
- ✅ En variables de entorno de App Service
- ❌ **NO** en el código fuente
- 🔐 Considerar Azure Key Vault para producción

## 🐛 Troubleshooting Común

### "CORS policy: No 'Access-Control-Allow-Origin'"

**Causa:** El origen del Blob Storage no está permitido en CORS

**Solución:**
1. Verificar URL exacta del Blob Storage
2. Agregar a `allowedOrigins` en `server.js`
3. O configurar `ALLOWED_ORIGIN` en App Service
4. Reiniciar App Service

### "Cannot connect to SQL Server"

**Causa:** Firewall bloquea la conexión

**Solución:**
1. Verificar IP de salida del App Service
2. Agregar regla de firewall con esa IP
3. Esperar 2-3 minutos para que se aplique
4. Verificar credenciales en variables de entorno

### "Failed to fetch" en navegador

**Causa:** URL de API incorrecta o App Service no responde

**Solución:**
1. Verificar URL en `informe_completo.html`
2. Probar API directamente: `curl https://tu-api.azurewebsites.net/api/registros`
3. Verificar logs del App Service
4. Verificar que el App Service esté "Running"

## 📊 Monitoreo

### Ver Logs del App Service:

1. Azure Portal → App Service → "Registros"
2. Habilitar "Application Logging"
3. Ver logs en tiempo real

### Verificar Conexión SQL:

En los logs deberías ver:
```
✅ Conectado a SQL Server
```

Si ves errores, revisar:
- Firewall de SQL Database
- Credenciales
- Estado del servidor SQL

## ✅ Checklist Final

- [ ] HTML actualizado con URL correcta de API
- [ ] API desplegada en Azure App Service
- [ ] Variables de entorno configuradas
- [ ] CORS configurado correctamente
- [ ] Firewall de SQL Database configurado
- [ ] HTML subido a Blob Storage
- [ ] Pruebas realizadas y funcionando
- [ ] Logs verificados sin errores

