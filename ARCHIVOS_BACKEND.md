# 📦 Archivos Necesarios para Desplegar el Backend API

## ✅ Archivos REQUERIDOS para el Backend

### Archivos Esenciales (Mínimo):

1. **`server.js`** ⭐ - El servidor principal de la API
2. **`package.json`** ⭐ - Dependencias y scripts de Node.js

### Archivos Opcionales pero Recomendados:

3. **`.deploymentignore`** - Para excluir archivos del frontend
4. **`.gitignore`** - Si usas Git deployment

## 📋 Estructura Mínima del Backend

```
backend/
├── server.js          ← Servidor API (REQUERIDO)
├── package.json       ← Dependencias (REQUERIDO)
└── .deploymentignore  ← Excluir frontend (RECOMENDADO)
```

## ❌ Archivos a EXCLUIR del Backend

### Frontend (NO incluir):
- `informe_completo.html`
- `404.html`
- `favicon.svg`
- Cualquier archivo HTML/CSS/JS del frontend

### Documentación (NO necesaria):
- `*.md` (todos los archivos Markdown)
- `README.md`
- `DEPLOY.md`
- etc.

### Scripts y SQL (NO necesarios):
- `*.sql` (scripts SQL)
- `*.py` (scripts Python)
- `generar_sql_desde_json.py`

### Configuración Local (NO incluir):
- `.env` (usar variables de entorno de Azure)
- `config-api.js`

## 🚀 Opciones de Despliegue

### Opción 1: ZIP Deploy (Solo Backend)

1. **Crear carpeta temporal:**
   ```bash
   mkdir backend-deploy
   cd backend-deploy
   ```

2. **Copiar archivos necesarios:**
   ```bash
   # Windows PowerShell
   Copy-Item ..\server.js .
   Copy-Item ..\package.json .
   Copy-Item ..\.deploymentignore .
   ```

3. **Crear ZIP:**
   ```bash
   # Windows
   Compress-Archive -Path * -DestinationPath ../backend.zip
   ```

4. **Desplegar en Azure:**
   - Azure Portal → App Service → "Centro de implementación" → "ZIP Deploy"
   - Subir `backend.zip`

### Opción 2: Git Deployment (Recomendado)

Azure App Service puede usar `.deploymentignore` automáticamente si despliegas desde Git.

1. **Configurar Git remote:**
   ```bash
   git remote add azure https://tu-app.scm.azurewebsites.net:443/tu-app.git
   ```

2. **Azure usará `.deploymentignore` automáticamente**
   - Solo desplegará los archivos necesarios
   - Excluirá los archivos listados en `.deploymentignore`

3. **Desplegar:**
   ```bash
   git push azure main
   ```

### Opción 3: Carpeta Separada (Más Organizado)

Crear una estructura separada:

```
proyecto/
├── frontend/
│   ├── informe_completo.html
│   └── ...
└── backend/
    ├── server.js
    ├── package.json
    └── .deploymentignore
```

## 📝 Checklist de Archivos para Despliegue

Antes de desplegar, verifica que tengas:

- [x] `server.js` (archivo principal)
- [x] `package.json` (con todas las dependencias)
- [x] `.deploymentignore` (para excluir frontend)
- [ ] `.env` NO incluido (usar variables de entorno de Azure)
- [ ] `node_modules` NO incluido (Azure lo instala automáticamente)

## 🔍 Verificar Contenido del ZIP

Antes de desplegar, verifica que el ZIP contenga solo:

```
backend.zip
├── server.js
├── package.json
└── .deploymentignore
```

**NO debe contener:**
- ❌ `informe_completo.html`
- ❌ `*.md`
- ❌ `*.sql`
- ❌ `*.py`
- ❌ `node_modules/`
- ❌ `.env`

## 🛠️ Script de Preparación (Opcional)

Puedes crear un script para preparar el despliegue:

**`prepare-deploy.ps1` (PowerShell):**
```powershell
# Crear carpeta de despliegue
New-Item -ItemType Directory -Force -Path "deploy-backend"
Copy-Item "server.js" "deploy-backend\"
Copy-Item "package.json" "deploy-backend\"
Copy-Item ".deploymentignore" "deploy-backend\"

# Crear ZIP
Compress-Archive -Path "deploy-backend\*" -DestinationPath "backend.zip" -Force

Write-Host "✅ ZIP creado: backend.zip"
Write-Host "📦 Contenido:"
Get-ChildItem "deploy-backend" | Select-Object Name
```

Ejecutar:
```bash
powershell -ExecutionPolicy Bypass -File prepare-deploy.ps1
```

## ⚠️ Notas Importantes

1. **`node_modules`**: Azure App Service instala automáticamente las dependencias desde `package.json`
   - NO necesitas incluirlo en el ZIP
   - Si lo incluyes, el despliegue será más lento

2. **Variables de Entorno**: 
   - NO incluir `.env` en el despliegue
   - Configurar en Azure Portal → App Service → Variables de aplicación

3. **Puerto**:
   - Azure App Service usa la variable `PORT` automáticamente
   - No necesitas configurarlo manualmente

4. **Logs**:
   - Los logs se pueden ver en Azure Portal → App Service → "Registros"
   - Habilitar "Application Logging" para ver logs de Node.js

