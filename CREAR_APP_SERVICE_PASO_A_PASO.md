# 🚀 Crear App Service - Paso a Paso

## ❌ Tu Error Actual

```
curl: (6) Could not resolve host: webcontrolhoras-api.azurewebsites.net
```

**Significado:** El App Service `webcontrolhoras-api` **aún no existe** en Azure.

## ✅ Solución: Crear el App Service

### Paso 1: Ir a Azure Portal

1. Abre tu navegador
2. Ve a: https://portal.azure.com
3. Inicia sesión con tu cuenta de Azure

### Paso 2: Crear App Service

1. **Clic en "Crear un recurso"** (arriba izquierda, botón verde)

2. **Buscar "App Service"**
   - En el buscador, escribe: `App Service`
   - Selecciona "App Service" (el primero)

3. **Clic en "Crear"**

### Paso 3: Configurar el App Service

#### Pestaña "Básico":

- **Suscripción**: Selecciona tu suscripción
- **Grupo de recursos**: 
  - Si ya tienes uno para este proyecto, selecciónalo
  - Si no, haz clic en "Crear nuevo" y pon: `webcontrolhoras-rg`
  
- **Nombre**: `webcontrolhoras-api`
  - ⚠️ **IMPORTANTE**: Este nombre debe ser único globalmente
  - Si dice "El nombre no está disponible", prueba:
    - `webcontrolhoras-api-2025`
    - `webcontrolhoras-logicalis-api`
    - `webcontrolhoras-backend-2025`
    - Cualquier variación única
  
- **Publicar**: **Código**
- **Runtime stack**: **Node.js 18 LTS** (o la versión más reciente disponible)
- **Sistema operativo**: **Linux** (recomendado, más barato) o Windows
- **Región**: La misma donde está tu SQL Database (para mejor rendimiento)

#### Pestaña "Plan de App Service":

- **Plan de App Service**: **Crear nuevo**
- **Nombre del plan**: `webcontrolhoras-plan`
- **SKU y tamaño**: 
  - **F1 Gratis** (solo para pruebas, tiene limitaciones)
  - **B1 Básico** (recomendado para producción, ~$13/mes)
  - Selecciona según tus necesidades

#### Pestaña "Revisar y crear":

- Revisa la configuración
- Clic en **"Crear"**
- Espera 2-3 minutos mientras se crea

### Paso 4: Obtener la URL

Una vez creado:

1. Ve a "Todos los recursos" en Azure Portal
2. Busca `webcontrolhoras-api` (o el nombre que usaste)
3. Abre el App Service
4. En la parte superior verás la **URL**: `https://NOMBRE-APP.azurewebsites.net`

**Ejemplo:** `https://webcontrolhoras-api.azurewebsites.net`

### Paso 5: Verificar que Existe

```bash
# Probar (debería dar respuesta, aunque sea 404)
curl https://webcontrolhoras-api.azurewebsites.net
```

Si funciona, verás una respuesta (aunque sea un error 404).
Si sigue dando "Could not resolve host", espera 2-3 minutos más.

## 📝 Después de Crear el App Service

### 1. Configurar Variables de Entorno

Azure Portal → App Service → **Configuración** → **Variables de aplicación**:

Agregar:
```
DB_USER = administrador
DB_PASSWORD = l0g1C4l1S2025
DB_SERVER = controlhoraslogicalis.database.windows.net
DB_NAME = bbddcontrolhoras
ALLOWED_ORIGIN = https://webcontrolhoras.z6.web.core.windows.net
NODE_ENV = production
```

**Guardar** (esto reiniciará el App Service)

### 2. Desplegar el Código

**Opción A: ZIP Deploy (Más Fácil)**

1. Ejecutar script:
   ```powershell
   powershell -ExecutionPolicy Bypass -File prepare-deploy.ps1
   ```

2. Azure Portal → App Service → **Centro de implementación**
3. **ZIP Deploy**
4. Subir `backend.zip`

**Opción B: Desde Visual Studio Code**

1. Instalar extensión "Azure App Service"
2. Clic derecho en carpeta → "Deploy to Web App"
3. Seleccionar el App Service creado

### 3. Actualizar URL en el HTML

Editar `informe_completo.html` línea ~662:

```javascript
const API_BASE_URL = isDevelopment 
    ? 'http://localhost:3000'
    : 'https://webcontrolhoras-api.azurewebsites.net'; // ⚠️ Tu URL real aquí
```

### 4. Configurar Firewall de SQL Database

1. **Obtener IP de salida:**
   - App Service → **Propiedades** → Copiar **"IP de salida"**

2. **Agregar regla de firewall:**
   - SQL Server → **Seguridad** → **Redes**
   - Agregar regla con la IP de salida del App Service

## ✅ Verificar que Todo Funciona

```bash
# Probar API
curl https://webcontrolhoras-api.azurewebsites.net/api/registros
```

Deberías recibir un JSON con los registros de la base de datos.

## 🆘 Si el Nombre No Está Disponible

Si `webcontrolhoras-api` ya está en uso, prueba estos nombres:

- `webcontrolhoras-api-2025`
- `webcontrolhoras-logicalis-api`
- `webcontrolhoras-backend`
- `webcontrolhoras-rest-api`
- `wh-api-logicalis`
- Cualquier combinación única

**Nota:** El nombre debe ser único en **todo Azure**, no solo en tu suscripción.

## 📋 Checklist Rápido

- [ ] App Service creado en Azure Portal
- [ ] URL obtenida (ej: `https://webcontrolhoras-api.azurewebsites.net`)
- [ ] Variables de entorno configuradas
- [ ] Código desplegado (ZIP)
- [ ] URL actualizada en `informe_completo.html`
- [ ] Firewall de SQL Database configurado
- [ ] API probada con curl

