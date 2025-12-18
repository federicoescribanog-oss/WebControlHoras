# 🔐 Configuración de JWT_SECRET

## 📝 Valor para JWT_SECRET

Usa esta clave secreta en Azure App Service:

```
JWT_SECRET=UsNzqUEK+OwIjmJKoM2oxOKB/KMHEPMzoUp0h+FMTiaFknXbBSdp7guKkvrp6AYOBsDuMQOk+OHDuXiZ35vH0Q==
```

## 🎯 Cómo Configurarla en Azure App Service

### Paso 1: Ir a Azure Portal

1. Abre https://portal.azure.com
2. Ve a tu **App Service** → `webcontrolhoras-api-g9eucxepedfehfe6`

### Paso 2: Agregar Variable de Entorno

1. En el menú lateral, ve a **"Configuración"**
2. Haz clic en **"Variables de aplicación"**
3. Haz clic en **"+ Nueva configuración de aplicación"**
4. Completa:
   - **Nombre**: `JWT_SECRET`
   - **Valor**: `UsNzqUEK+OwIjmJKoM2oxOKB/KMHEPMzoUp0h+FMTiaFknXbBSdp7guKkvrp6AYOBsDuMQOk+OHDuXiZ35vH0Q==`
5. Haz clic en **"Aceptar"**
6. Haz clic en **"Guardar"** (arriba)
7. Espera a que se reinicie el App Service (1-2 minutos)

### Paso 3: Verificar

Después de reiniciar, prueba el login:
1. Abre `login.html`
2. Inicia sesión con usuario y contraseña
3. Si funciona, la configuración es correcta

## 🔒 Seguridad

### ✅ Buenas Prácticas

- ✅ Usa una clave larga y aleatoria (como la proporcionada)
- ✅ Mantén la clave secreta (nunca la compartas)
- ✅ No la incluyas en el código fuente
- ✅ Usa variables de entorno (como en Azure)

### ❌ Evitar

- ❌ No uses claves cortas o predecibles
- ❌ No uses la misma clave en múltiples proyectos
- ❌ No la subas a Git o repositorios públicos
- ❌ No la compartas en chats o emails

## 🔄 Generar una Nueva Clave (Opcional)

Si quieres generar una nueva clave diferente, puedes usar PowerShell:

```powershell
$bytes = New-Object byte[] 64
(New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

O si tienes Node.js instalado:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

## 📋 Checklist

- [ ] Variable `JWT_SECRET` agregada en Azure App Service
- [ ] Valor copiado correctamente (sin espacios)
- [ ] App Service reiniciado
- [ ] Login probado y funcionando

## 🐛 Troubleshooting

### Error: "Token inválido o expirado"

**Causa:** La clave `JWT_SECRET` no está configurada o es incorrecta.

**Solución:**
1. Verificar que `JWT_SECRET` esté en las variables de entorno
2. Verificar que el valor sea exactamente el mismo (sin espacios)
3. Reiniciar el App Service
4. Probar login nuevamente

### Error: "No se puede verificar el token"

**Causa:** La clave cambió después de generar tokens.

**Solución:**
1. Todos los usuarios deben hacer login nuevamente
2. Los tokens antiguos ya no serán válidos
3. Esto es normal cuando cambias `JWT_SECRET`

## 💡 Nota Importante

**Esta clave es específica para tu aplicación.** Si ya tienes usuarios con tokens generados con otra clave, todos deberán hacer login nuevamente después de cambiar `JWT_SECRET`.

