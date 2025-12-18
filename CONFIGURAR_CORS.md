# 🔧 Configurar CORS en Azure Storage Account

El error "Failed to fetch" indica que necesitas configurar CORS (Cross-Origin Resource Sharing) en tu Azure Storage Account para permitir que el navegador haga peticiones PUT al blob storage.

## 📋 Pasos para Configurar CORS

### Paso 1: Acceder a Azure Portal

1. Ve a [portal.azure.com](https://portal.azure.com)
2. Busca y selecciona tu **Storage Account** (`webcontrolhoras`)

### Paso 2: Ir a la Configuración de CORS

1. En el menú izquierdo, busca la sección **"Seguridad + redes"** o **"Security + networking"**
2. Haz clic en **"Resource sharing (CORS)"** o **"Uso compartido de recursos (CORS)"**

### Paso 3: Configurar CORS para Blob Service

1. Busca la sección **"Blob service"** o **"Servicio Blob"**
2. Haz clic en **"Add"** o **"Agregar"** para añadir una nueva regla

### Paso 4: Configurar los Valores

Configura los siguientes valores:

| Campo | Valor |
|-------|-------|
| **Allowed origins** (Orígenes permitidos) | `*` (asterisco) o tu dominio específico: `https://webcontrolhoras.z6.web.core.windows.net` |
| **Allowed methods** (Métodos permitidos) | `GET, PUT, OPTIONS` |
| **Allowed headers** (Encabezados permitidos) | `*` (asterisco) |
| **Exposed headers** (Encabezados expuestos) | `*` (asterisco) |
| **Max age** (Tiempo máximo) | `3600` (segundos) |

### Paso 5: Guardar

1. Haz clic en **"Save"** o **"Guardar"**
2. Espera unos segundos a que se aplique la configuración

## ⚠️ Notas Importantes

- **Usar `*` en origins**: Permite peticiones desde cualquier dominio (útil para desarrollo, menos seguro para producción)
- **Dominio específico**: Para mayor seguridad, usa tu dominio exacto: `https://webcontrolhoras.z6.web.core.windows.net`
- **Métodos necesarios**: `PUT` es necesario para escribir, `OPTIONS` es necesario para las peticiones preflight de CORS
- **Tiempo de propagación**: Los cambios pueden tardar unos minutos en aplicarse

## 🔍 Verificar la Configuración

Después de configurar CORS:

1. Espera 1-2 minutos
2. Recarga la página web
3. Intenta guardar de nuevo
4. Si sigue fallando, verifica en la consola del navegador (F12) los errores específicos

## 🛠️ Alternativa: Usar Azure Function

Si CORS sigue dando problemas, otra opción es crear una Azure Function que actúe como proxy para guardar el archivo. Esto requiere más configuración pero es más seguro.

## 📝 Ubicación Alternativa

Si no encuentras "Resource sharing (CORS)" en el menú:
- Busca en **"Configuración"** → **"Resource sharing (CORS)"**
- O usa la búsqueda del portal: escribe "CORS"

