# 🚀 Crear Azure App Service para la API

## ❌ Error: "Could not resolve host"

Este error significa que el App Service **aún no existe** o el nombre es incorrecto.

## 📋 Pasos para Crear el App Service

### Opción 1: Azure Portal (Interfaz Web)

1. **Ir a Azure Portal:**
   - https://portal.azure.com

2. **Crear nuevo recurso:**
   - Clic en "Crear un recurso" (arriba izquierda)
   - Buscar "App Service"
   - Clic en "Crear"

3. **Configurar App Service:**
   
   **Pestaña "Básico":**
   - **Suscripción**: Tu suscripción
   - **Grupo de recursos**: Crear nuevo o usar existente
   - **Nombre**: `webcontrolhoras-api` (debe ser único globalmente)
     - ⚠️ Si el nombre ya existe, prueba: `webcontrolhoras-api-2025`, `webcontrolhoras-logicalis-api`, etc.
   - **Publicar**: Código
   - **Runtime stack**: Node.js 18 LTS (o la versión más reciente)
   - **Sistema operativo**: Linux (recomendado) o Windows
   - **Región**: La misma que tu SQL Database (para mejor rendimiento)
   - **Plan de App Service**: 
     - Crear nuevo plan
     - Nombre: `webcontrolhoras-plan`
     - SKU y tamaño: **Básico B1** (mínimo para producción, ~$13/mes)
     - O **F1 Gratis** (solo para pruebas, limitado)

4. **Revisar y crear:**
   - Revisar configuración
   - Clic en "Revisar y crear"
   - Clic en "Crear"
   - Esperar 2-3 minutos

5. **Obtener URL:**
   - Una vez creado, la URL será: `https://NOMBRE-APP-SERVICE.azurewebsites.net`
   - Ejemplo: `https://webcontrolhoras-api.azurewebsites.net`

### Opción 2: Azure CLI (Línea de Comandos)

```bash
# Instalar Azure CLI si no lo tienes:
# https://aka.ms/installazurecliwindows

# Login
az login

# Crear grupo de recursos (si no existe)
az group create --name webcontrolhoras-rg --location westeurope

# Crear App Service Plan
az appservice plan create \
  --name webcontrolhoras-plan \
  --resource-group webcontrolhoras-rg \
  --sku B1 \
  --is-linux

# Crear App Service
az webapp create \
  --name webcontrolhoras-api \
  --resource-group webcontrolhoras-rg \
  --plan webcontrolhoras-plan \
  --runtime "NODE:18-lts"
```

## ✅ Verificar que el App Service Existe

Después de crearlo, verifica la URL:

```bash
# Probar que existe (debería dar 404, no error de DNS)
curl https://webcontrolhoras-api.azurewebsites.net
```

Si el App Service existe, recibirás una respuesta (aunque sea un error 404).
Si no existe, recibirás "Could not resolve host".

## 🔧 Configurar Variables de Entorno

Una vez creado el App Service:

1. **Azure Portal** → App Service → `webcontrolhoras-api`
2. **Configuración** → **Variables de aplicación**
3. **Agregar** las siguientes variables:

```
DB_USER = administrador
DB_PASSWORD = l0g1C4l1S2025
DB_SERVER = controlhoraslogicalis.database.windows.net
DB_NAME = bbddcontrolhoras
ALLOWED_ORIGIN = https://webcontrolhoras.z6.web.core.windows.net
NODE_ENV = production
```

4. **Guardar** (esto reiniciará el App Service)

## 📦 Desplegar el Código

### Opción A: ZIP Deploy

1. **Preparar ZIP:**
   ```powershell
   powershell -ExecutionPolicy Bypass -File prepare-deploy.ps1
   ```

2. **Azure Portal** → App Service → **Centro de implementación**
3. **ZIP Deploy**
4. **Subir** `backend.zip`

### Opción B: Git Deployment

```bash
# Configurar Git remote
az webapp deployment source config-local-git \
  --name webcontrolhoras-api \
  --resource-group webcontrolhoras-rg

# Obtener URL de Git
az webapp deployment list-publishing-credentials \
  --name webcontrolhoras-api \
  --resource-group webcontrolhoras-rg

# Agregar remote
git remote add azure https://webcontrolhoras-api.scm.azurewebsites.net:443/webcontrolhoras-api.git

# Desplegar
git push azure main
```

## 🧪 Probar la API

Una vez desplegado:

```bash
# Probar endpoint
curl https://webcontrolhoras-api.azurewebsites.net/api/registros
```

Deberías recibir un array JSON con los registros de la base de datos.

## 🔍 Troubleshooting

### Error: "The name is not available"

**Solución:** El nombre ya está en uso. Prueba con:
- `webcontrolhoras-api-2025`
- `webcontrolhoras-logicalis-api`
- `webcontrolhoras-backend`
- Cualquier variación única

### Error: "Could not resolve host" después de crear

**Solución:**
1. Esperar 2-3 minutos (DNS puede tardar)
2. Verificar que el App Service esté "Running" en Azure Portal
3. Probar con el nombre exacto que aparece en Azure Portal

### Verificar Estado del App Service

```bash
# Ver estado
az webapp show --name webcontrolhoras-api --resource-group webcontrolhoras-rg --query state
```

Debería mostrar: `"Running"`

## 📝 Checklist

- [ ] App Service creado en Azure Portal
- [ ] URL verificada (no da error de DNS)
- [ ] Variables de entorno configuradas
- [ ] Código desplegado (ZIP o Git)
- [ ] API responde correctamente
- [ ] Firewall de SQL Database configurado con IP del App Service

