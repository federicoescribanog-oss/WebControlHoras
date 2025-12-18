# Configuración de Azure SQL Database - Firewall y Seguridad

## 🔒 Configurar Firewall para Permitir Solo Acceso desde la API Backend

**IMPORTANTE**: Si tu HTML está en Azure Blob Storage y la API en Azure App Service:

- ✅ **Solo la IP del App Service** debe tener acceso a SQL Database
- ❌ **NO** permitas acceso desde todas las IPs (0.0.0.0 - 255.255.255.255)
- ❌ El Blob Storage **NO** necesita acceso directo a SQL Database (solo la API)

### Paso 1: Obtener IP de Salida del App Service

1. **Azure Portal** → App Service → `webcontrolhoras-api` (o el nombre de tu API)
2. Menú izquierdo: **"Propiedades"**
3. Copiar **"IP de salida"** (ejemplo: `20.123.45.67`)
   - ⚠️ Esta IP puede cambiar si reinicias el App Service
   - Para IP fija, considera usar Private Endpoint o App Service con IP reservada

### Paso 2: Configurar Regla de Firewall en SQL Database

1. **Azure Portal** → SQL Server → `controlhoraslogicalis`
2. Menú izquierdo: **"Seguridad"** → **"Redes"**
3. En **"Reglas de firewall"**, hacer clic en **"Agregar regla de firewall del cliente"**
4. Configurar:
   - **Nombre de la regla**: `AppService-API` (o el que prefieras)
   - **IP inicial**: `20.123.45.67` (tu IP de salida)
   - **IP final**: `20.123.45.67` (la misma IP)
5. **Guardar**

### Paso 3: Verificar Configuración

**IMPORTANTE - Configuración de Seguridad:**

- ✅ **"Permitir que los servicios de Azure accedan al servidor"**: 
  - Activar SOLO si necesitas que otros servicios de Azure (como Azure Functions, Logic Apps, etc.) accedan
  - Si solo usas App Service, puedes desactivarlo para mayor seguridad
  
- ❌ **NO agregar regla 0.0.0.0 - 255.255.255.255** (permite acceso desde cualquier lugar)

### Opción 2: Usar Azure App Service con IP Fija

Si tu aplicación está en Azure App Service:

1. **Configurar punto de conexión privado (Recomendado para producción):**
   - Ve a tu App Service → "Redes" → "Conexiones de punto de conexión privado"
   - Crea un punto de conexión privado que se conecte a tu SQL Database
   - Esto permite comunicación privada sin exponer la base de datos a Internet

2. **O usar reglas de firewall con IP de salida:**
   - Azure App Service tiene una IP de salida que puedes usar en las reglas de firewall
   - Ve a App Service → "Propiedades" → copia "IP de salida"
   - Agrega esta IP en las reglas de firewall de SQL Database

### Opción 3: Usar Azure Private Link (Más Seguro)

Para máxima seguridad:

1. **Crear Private Endpoint para SQL Database:**
   - Ve a SQL Database → "Seguridad" → "Redes"
   - En "Conexiones de punto de conexión privado", haz clic en "Configurar"
   - Crea un Private Endpoint en la misma VNet que tu App Service
   - Esto asegura que la comunicación sea completamente privada

### Configuración Actual Recomendada

Para desarrollo/pruebas:
- ✅ Agregar IP de tu servidor web a las reglas de firewall
- ✅ Mantener "Permitir que los servicios de Azure accedan al servidor" activado solo si usas otros servicios de Azure
- ❌ NO permitir acceso desde 0.0.0.0 - 255.255.255.255 (todas las IPs)

Para producción:
- ✅ Usar Private Endpoint
- ✅ Desactivar acceso público si es posible
- ✅ Usar Azure AD Authentication en lugar de usuario/contraseña

## 🔐 Seguridad Adicional

### 1. Cambiar Credenciales Predeterminadas

**IMPORTANTE**: Las credenciales actuales están en el código. Para producción:

1. Usa Azure Key Vault para almacenar credenciales
2. O usa variables de entorno en Azure App Service
3. Cambia la contraseña regularmente

### 2. Usar Azure AD Authentication

En lugar de usuario/contraseña, considera usar:
- Managed Identity (si la app está en Azure)
- Azure AD Service Principal

### 3. Habilitar Auditoría

1. Ve a SQL Database → "Seguridad" → "Auditoría"
2. Habilita la auditoría para rastrear accesos
3. Configura alertas para accesos sospechosos

## 📝 Pasos para Configurar Firewall

### Paso 1: Identificar IP del Servidor

```bash
# Desde tu servidor web, ejecuta:
curl ifconfig.me
```

### Paso 2: Agregar Regla en Azure Portal

1. Azure Portal → SQL Server → `controlhoraslogicalis`
2. Menú: "Seguridad" → "Redes"
3. "Agregar regla de firewall del cliente"
4. Nombre: `WebServer` (o el que prefieras)
5. IP inicial: `TU_IP_AQUI`
6. IP final: `TU_IP_AQUI`
7. Guardar

### Paso 3: Verificar Conexión

```bash
# Desde tu servidor, prueba la conexión:
node -e "require('mssql').connect('Server=controlhoraslogicalis.database.windows.net;Database=bbddcontrolhoras;User Id=administrador;Password=l0g1C4l1S2025;Encrypt=true').then(() => console.log('OK')).catch(e => console.error(e))"
```

## ⚠️ Notas Importantes

- Las reglas de firewall pueden tardar hasta 5 minutos en aplicarse
- Si cambias de IP, necesitas actualizar la regla
- Para desarrollo local, agrega tu IP personal temporalmente
- Considera usar Azure VPN o Bastion para acceso administrativo

