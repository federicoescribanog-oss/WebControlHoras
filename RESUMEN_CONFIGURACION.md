# 📋 Resumen de Configuración - Blob Storage + API Separada

## 🎯 Situación Actual

- ✅ **HTML**: Desplegado en Azure Blob Storage (sitio web estático)
- ⚠️ **API Backend**: Necesita desplegarse en Azure App Service (separado)
- ✅ **Base de Datos**: Azure SQL Database ya creada

## 🔧 Pasos de Configuración

### 1. Configurar URL de API en el HTML

**Archivo:** `informe_completo.html` (línea ~662)

```javascript
const API_BASE_URL = isDevelopment 
    ? 'http://localhost:3000'
    : 'https://TU-APP-SERVICE.azurewebsites.net'; // ⚠️ CAMBIAR ESTO
```

**Reemplazar** `TU-APP-SERVICE` con el nombre real de tu App Service.

### 2. Crear y Desplegar API en Azure App Service

#### A. Crear App Service
- Azure Portal → Crear recurso → App Service
- Runtime: Node.js 18 LTS
- Plan: Básico B1 (mínimo)

#### B. Configurar Variables de Entorno
En App Service → Configuración → Variables de aplicación:
```
DB_USER = administrador
DB_PASSWORD = l0g1C4l1S2025
DB_SERVER = controlhoraslogicalis.database.windows.net
DB_NAME = bbddcontrolhoras
ALLOWED_ORIGIN = https://webcontrolhoras.z6.web.core.windows.net
NODE_ENV = production
```

#### C. Desplegar Código
- Subir: `server.js`, `package.json`
- Azure instalará `node_modules` automáticamente
- O usar Git Deployment

### 3. Configurar Firewall de SQL Database

**IMPORTANTE**: Solo permitir IP del App Service, NO todas las IPs.

1. **Obtener IP de salida:**
   - App Service → Propiedades → "IP de salida"
   - Copiar esta IP (ejemplo: `20.123.45.67`)

2. **Agregar regla de firewall:**
   - SQL Server → Seguridad → Redes
   - Agregar regla con la IP del App Service
   - Nombre: `AppService-API`
   - IP inicial y final: `20.123.45.67`

3. **Verificar:**
   - Desactivar "Permitir servicios de Azure" si no es necesario
   - Solo el App Service debe poder conectarse

### 4. Configurar CORS en el Backend

El archivo `server.js` ya tiene CORS configurado. Solo verificar:

1. **Actualizar URL del Blob Storage** en `server.js` línea ~18:
   ```javascript
   const allowedOrigins = [
       'https://webcontrolhoras.z6.web.core.windows.net', // Tu URL real
   ];
   ```

2. **O usar variable `ALLOWED_ORIGIN`** (ya configurada en paso 2B)

### 5. Subir HTML Actualizado a Blob Storage

1. Actualizar `informe_completo.html` con la URL correcta de la API
2. Subir a Blob Storage → Contenedor `$web`
3. Verificar que funcione

## 🔒 Seguridad - Resumen

### SQL Database:
- ✅ **Solo IP del App Service** en firewall
- ❌ **NO** permitir 0.0.0.0 - 255.255.255.255
- ✅ Verificar que solo el App Service pueda conectarse

### CORS:
- ✅ **Solo origen del Blob Storage** permitido
- ✅ Variable `ALLOWED_ORIGIN` configurada
- ❌ **NO** usar `origin: '*'` en producción

### Credenciales:
- ✅ En variables de entorno de App Service
- ❌ **NO** en el código fuente

## 📝 Checklist

- [ ] HTML actualizado con URL de API correcta
- [ ] App Service creado y desplegado
- [ ] Variables de entorno configuradas en App Service
- [ ] CORS configurado para Blob Storage
- [ ] Firewall de SQL Database configurado con IP del App Service
- [ ] HTML subido a Blob Storage
- [ ] Pruebas realizadas desde el navegador
- [ ] Logs del App Service verificados

## 🚀 Orden de Ejecución Recomendado

1. **Primero**: Crear y desplegar App Service con la API
2. **Segundo**: Configurar firewall de SQL Database con IP del App Service
3. **Tercero**: Actualizar HTML con URL de API y subir a Blob Storage
4. **Cuarto**: Probar todo el flujo

## 📚 Documentación Adicional

- `DEPLOY.md` - Guía completa de despliegue
- `DESPLIEGUE_BLOB_STORAGE.md` - Detalles específicos de Blob Storage
- `CONFIGURACION_AZURE_SQL.md` - Configuración detallada de firewall
- `README_API.md` - Documentación de la API

