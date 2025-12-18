# ⚡ Quick Start - Despliegue Backend

## 📦 Archivos Mínimos Necesarios

Para desplegar el backend API en Azure App Service, solo necesitas **2 archivos**:

```
✅ server.js       (REQUERIDO)
✅ package.json    (REQUERIDO)
```

## 🚀 Despliegue Rápido

### Opción A: Usar Script Automático (Más Fácil)

```powershell
# Ejecutar script de preparación
powershell -ExecutionPolicy Bypass -File prepare-deploy.ps1
```

Esto creará `backend.zip` con solo los archivos necesarios.

### Opción B: Manual

1. **Crear carpeta:**
   ```powershell
   mkdir deploy-backend
   ```

2. **Copiar archivos:**
   ```powershell
   Copy-Item server.js deploy-backend\
   Copy-Item package.json deploy-backend\
   ```

3. **Crear ZIP:**
   ```powershell
   Compress-Archive -Path deploy-backend\* -DestinationPath backend.zip
   ```

4. **Desplegar en Azure:**
   - Azure Portal → App Service → "Centro de implementación" → "ZIP Deploy"
   - Subir `backend.zip`

## 📋 Estructura del ZIP

El ZIP debe contener solo:

```
backend.zip
├── server.js
└── package.json
```

**NO incluir:**
- ❌ `informe_completo.html` (frontend)
- ❌ `*.md` (documentación)
- ❌ `*.sql` (scripts SQL)
- ❌ `node_modules/` (Azure lo instala)
- ❌ `.env` (usar variables de entorno de Azure)

## ⚙️ Configuración en Azure App Service

Después del despliegue, configurar variables de entorno:

```
DB_USER = administrador
DB_PASSWORD = l0g1C4l1S2025
DB_SERVER = controlhoraslogicalis.database.windows.net
DB_NAME = bbddcontrolhoras
ALLOWED_ORIGIN = https://webcontrolhoras.z6.web.core.windows.net
NODE_ENV = production
```

## ✅ Verificar Despliegue

```bash
curl https://tu-app-service.azurewebsites.net/api/registros
```

Deberías recibir un array JSON con los registros.

