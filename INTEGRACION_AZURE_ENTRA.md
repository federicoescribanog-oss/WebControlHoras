# Integración con Azure Entra ID (Azure AD)

Esta guía explica cómo conectar la aplicación web con Azure Entra ID (anteriormente Azure AD) de tu compañía para autenticación de usuarios.

## 📋 Requisitos Previos

- Acceso al portal de Azure (portal.azure.com)
- Permisos de administrador o colaborador en el tenant de Azure
- Una aplicación web desplegada (en este caso, en Azure Static Web Apps o Azure Blob Storage)

## 🔧 Paso 1: Registrar la Aplicación en Azure Entra ID

### 1.1. Ir al Portal de Azure
1. Accede a [portal.azure.com](https://portal.azure.com)
2. Inicia sesión con tu cuenta corporativa

### 1.2. Registrar la Aplicación
1. Busca "Azure Active Directory" o "Microsoft Entra ID" en la barra de búsqueda
2. Selecciona **"App registrations"** (Registros de aplicaciones)
3. Haz clic en **"+ New registration"** (Nuevo registro)

### 1.3. Configurar el Registro
Completa el formulario con:
- **Name**: `Gestión de Recursos - Logicalis` (o el nombre que prefieras)
- **Supported account types**: 
  - Si es solo para tu organización: **"Accounts in this organizational directory only"**
  - Si es multi-tenant: **"Accounts in any organizational directory"**
- **Redirect URI**: 
  - Platform: **Single-page application (SPA)**
  - URL: `https://tu-dominio.azurestaticapps.net` (o tu URL de producción)

4. Haz clic en **"Register"**

### 1.4. Guardar Información Importante
Después del registro, verás la página de **Overview**. Guarda:
- **Application (client) ID**: Lo necesitarás como `CLIENT_ID`
- **Directory (tenant) ID**: Lo necesitarás como `TENANT_ID`

## 🔐 Paso 2: Configurar Permisos y Autenticación

### 2.1. Configurar Autenticación
1. En el menú lateral, ve a **"Authentication"**
2. En **"Implicit grant and hybrid flows"**, marca:
   - ✅ **ID tokens** (para autenticación)
   - ✅ **Access tokens** (si necesitas llamar a APIs)
3. En **"Advanced settings"**:
   - **Allow public client flows**: No (para SPA)
4. Haz clic en **"Save"**

### 2.2. Configurar Permisos de API (Opcional)
Si necesitas acceder a Microsoft Graph API u otras APIs:

1. Ve a **"API permissions"**
2. Haz clic en **"+ Add a permission"**
3. Selecciona **"Microsoft Graph"**
4. Selecciona **"Delegated permissions"**
5. Marca los permisos necesarios (ej: `User.Read`, `User.ReadBasic.All`)
6. Haz clic en **"Add permissions"**
7. Si es necesario, haz clic en **"Grant admin consent"** para tu organización

## 📝 Paso 3: Integrar MSAL.js en la Aplicación

### 3.1. Instalar MSAL.js (si usas un bundler)

Si tu aplicación usa npm/node_modules:
```bash
npm install @azure/msal-browser
```

### 3.2. Configuración en el HTML

Agrega el script de MSAL.js antes del cierre de `</body>`:

```html
<!-- MSAL.js desde CDN -->
<script src="https://alcdn.msauth.net/browser/2.38.0/js/msal-browser.min.js"></script>
```

### 3.3. Código de Configuración

Agrega este código JavaScript en tu archivo HTML (antes del script principal):

```javascript
// ========== CONFIGURACIÓN AZURE ENTRA ID ==========
const msalConfig = {
    auth: {
        clientId: 'TU_CLIENT_ID_AQUI', // Reemplaza con tu Application (client) ID
        authority: 'https://login.microsoftonline.com/TU_TENANT_ID_AQUI', // Reemplaza con tu Directory (tenant) ID
        redirectUri: window.location.origin // URL de tu aplicación
    },
    cache: {
        cacheLocation: 'sessionStorage', // o 'localStorage' para persistir entre sesiones
        storeAuthStateInCookie: false
    }
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

// Inicializar MSAL
await msalInstance.initialize();

// Variables de autenticación
let account = null;
let isAuthenticated = false;

// Función para iniciar sesión
async function login() {
    try {
        const loginResponse = await msalInstance.loginPopup({
            scopes: ['User.Read'] // Permisos necesarios
        });
        account = loginResponse.account;
        isAuthenticated = true;
        updateUI();
        return loginResponse;
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        alert('Error al iniciar sesión: ' + error.message);
    }
}

// Función para cerrar sesión
async function logout() {
    try {
        await msalInstance.logoutPopup();
        account = null;
        isAuthenticated = false;
        updateUI();
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
    }
}

// Función para verificar si el usuario está autenticado
async function checkAuth() {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
        account = accounts[0];
        isAuthenticated = true;
        updateUI();
    }
}

// Función para actualizar la UI según el estado de autenticación
function updateUI() {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userInfo = document.getElementById('userInfo');
    
    if (isAuthenticated && account) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'block';
        if (userInfo) {
            userInfo.textContent = `Usuario: ${account.name || account.username}`;
            userInfo.style.display = 'block';
        }
        // Mostrar contenido principal
        document.getElementById('mainContent')?.classList.add('visible');
        document.getElementById('editorContent')?.classList.add('visible');
    } else {
        if (loginBtn) loginBtn.style.display = 'block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (userInfo) userInfo.style.display = 'none';
        // Ocultar contenido principal
        document.getElementById('mainContent')?.classList.remove('visible');
        document.getElementById('editorContent')?.classList.remove('visible');
    }
}

// Verificar autenticación al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    if (!isAuthenticated) {
        // Mostrar pantalla de login
        document.getElementById('loadingScreen').innerHTML = `
            <div style="text-align:center;padding:2rem;">
                <h2 style="margin-bottom:1.5rem;">Gestión de Recursos - Logicalis</h2>
                <p style="color:var(--text-secondary);margin-bottom:2rem;">Inicia sesión para acceder a la aplicación</p>
                <button id="loginBtn" onclick="login()" style="padding:1rem 2rem;font-size:1.1rem;background:var(--accent);color:var(--bg-primary);border:none;border-radius:8px;cursor:pointer;font-weight:600;">
                    Iniciar Sesión con Microsoft
                </button>
            </div>
        `;
    } else {
        // Cargar datos normalmente
        loadFromAzure();
    }
});
```

## 🎨 Paso 4: Agregar UI de Autenticación

Agrega estos elementos en el HTML (en el header o donde prefieras):

```html
<header>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <h1>
            <img src="favicon.svg" alt="Icono" class="header-icon">
            Gestión de Recursos - Logicalis
        </h1>
        <div style="display:flex;align-items:center;gap:1rem;">
            <span id="userInfo" style="display:none;color:var(--text-secondary);font-size:0.9rem;"></span>
            <button id="loginBtn" onclick="login()" class="btn-secondary" style="display:none;">Iniciar Sesión</button>
            <button id="logoutBtn" onclick="logout()" class="btn-secondary" style="display:none;">Cerrar Sesión</button>
        </div>
    </div>
</header>
```

## 🔒 Paso 5: Proteger Rutas y Funciones

Modifica las funciones que cargan datos para requerir autenticación:

```javascript
async function loadFromAzure() {
    if (!isAuthenticated) {
        await login();
        return;
    }
    
    try {
        // Tu código existente de carga de datos
        const response = await fetch(getBlobUrl() + '?t=' + Date.now());
        // ... resto del código
    } catch (err) {
        // Manejo de errores
    }
}

async function saveToAzure() {
    if (!isAuthenticated) {
        alert('Debes iniciar sesión para guardar cambios');
        await login();
        return;
    }
    
    // Tu código existente de guardado
}
```

## 🌐 Paso 6: Configurar CORS (si es necesario)

Si tienes problemas de CORS:

1. En Azure Portal, ve a tu **Storage Account**
2. Ve a **"Resource sharing (CORS)"**
3. Configura:
   - **Allowed origins**: `https://login.microsoftonline.com`
   - **Allowed methods**: `GET, POST, PUT, OPTIONS`
   - **Allowed headers**: `*`
   - **Exposed headers**: `*`
   - **Max age**: `3600`

## 📱 Paso 7: Probar la Integración

1. Abre tu aplicación en el navegador
2. Deberías ver un botón "Iniciar Sesión"
3. Al hacer clic, se abrirá un popup de Microsoft para autenticación
4. Después de autenticarte, deberías ver tu nombre de usuario
5. El contenido de la aplicación debería estar disponible

## 🛠️ Solución de Problemas

### Error: "AADSTS50011: The redirect URI specified in the request does not match"
- **Solución**: Verifica que la URL en "Redirect URI" en Azure Portal coincida exactamente con la URL de tu aplicación (incluyendo http/https y puerto si aplica)

### Error: "AADSTS7000215: Invalid client secret is provided"
- **Solución**: Para aplicaciones SPA, no necesitas client secret. Asegúrate de que la aplicación esté configurada como "Single-page application"

### El popup se cierra inmediatamente
- **Solución**: Verifica que los permisos de popup no estén bloqueados en el navegador

### No se muestra el botón de login
- **Solución**: Verifica que el script de MSAL.js se haya cargado correctamente y que los IDs de los elementos HTML coincidan

## 📚 Recursos Adicionales

- [Documentación oficial de MSAL.js](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [Guía de Azure Entra ID](https://docs.microsoft.com/azure/active-directory/)
- [Ejemplos de código MSAL.js](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/samples)

## 🔐 Seguridad Adicional (Opcional)

### Restringir Acceso por Grupos
1. En Azure Portal, ve a tu App Registration
2. Ve a **"Enterprise applications"** → Tu aplicación
3. Ve a **"Users and groups"**
4. Asigna usuarios o grupos específicos

### Configurar Condicional Access
1. En Azure Portal, ve a **"Azure Active Directory"**
2. Ve a **"Security"** → **"Conditional Access"**
3. Crea políticas para requerir MFA, ubicaciones específicas, etc.

## 📝 Notas Importantes

- **Client ID y Tenant ID son públicos**: Está bien incluirlos en el código del frontend
- **No uses Client Secret en SPA**: Las aplicaciones de página única no deben usar secrets
- **HTTPS requerido en producción**: Azure Entra ID requiere HTTPS para aplicaciones en producción
- **Tokens expiran**: Los tokens tienen tiempo de expiración. MSAL.js los renueva automáticamente

---

**¿Necesitas ayuda?** Contacta al administrador de Azure de tu organización o consulta la documentación oficial de Microsoft.
