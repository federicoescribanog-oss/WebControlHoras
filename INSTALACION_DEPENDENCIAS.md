# 📦 Instalación de Dependencias - Guía Completa

## 🎯 Respuesta Rápida

**NO necesitas ejecutar `npm install` en Azure.** Azure App Service lo hace automáticamente cuando despliegas el código.

Solo necesitas ejecutarlo **localmente** para:
- Probar el código antes de desplegar
- Ejecutar scripts como `crear_usuario_admin.js`

---

## 📍 Dónde Ejecutar `npm install`

### ✅ Opción 1: En tu Máquina Local (Recomendado para Desarrollo)

**Ubicación:** En la carpeta del proyecto en tu PC

```powershell
# Abrir PowerShell en tu máquina
cd c:\Proyectos\WebControlHoras

# Instalar dependencias
npm install
```

**¿Cuándo hacerlo?**
- ✅ Para probar el servidor localmente (`npm run dev`)
- ✅ Para ejecutar scripts como `crear_usuario_admin.js`
- ✅ Para verificar que todo funciona antes de desplegar

**Resultado:**
- Se crea la carpeta `node_modules/` con todas las dependencias
- Puedes ejecutar el servidor localmente

---

### ❌ Opción 2: En Azure (NO es necesario)

**Azure App Service instala automáticamente las dependencias** cuando:
- Despliegas código con `package.json`
- Haces `git push` al App Service
- Subes un ZIP con `package.json`

**No necesitas:**
- ❌ Conectarte por SSH a Azure
- ❌ Ejecutar `npm install` manualmente en Azure
- ❌ Incluir `node_modules/` en el ZIP de despliegue

---

## 🚀 Proceso Completo de Despliegue

### Paso 1: Instalar Dependencias Localmente (Opcional)

```powershell
# En tu PC, en la carpeta del proyecto
cd c:\Proyectos\WebControlHoras
npm install
```

**Nota:** Esto es opcional. Solo lo necesitas si quieres probar localmente.

### Paso 2: Preparar ZIP para Despliegue

```powershell
# Crear ZIP con solo los archivos necesarios
powershell -ExecutionPolicy Bypass -File prepare-deploy.ps1
```

El ZIP incluye:
- ✅ `server.js`
- ✅ `package.json`
- ❌ **NO incluye** `node_modules/` (Azure lo instala)

### Paso 3: Desplegar en Azure

**Opción A: ZIP Deploy (Más Fácil)**

1. Azure Portal → App Service → "Centro de implementación"
2. "ZIP Deploy"
3. Subir `backend.zip`

**Azure automáticamente:**
- ✅ Detecta el `package.json`
- ✅ Ejecuta `npm install` internamente
- ✅ Instala todas las dependencias
- ✅ Inicia el servidor

**Opción B: Git Deployment**

```bash
# Desde tu PC
git push azure main
```

**Azure automáticamente:**
- ✅ Detecta el `package.json`
- ✅ Ejecuta `npm install`
- ✅ Instala dependencias
- ✅ Reinicia el servidor

---

## 🔍 Verificar que las Dependencias se Instalaron en Azure

### Método 1: Ver Logs del Despliegue

1. Azure Portal → App Service → "Centro de implementación"
2. Ver "Logs" del último despliegue
3. Buscar líneas como:
   ```
   npm install
   Installing dependencies...
   ```

### Método 2: Probar la API

```bash
curl https://tu-app-service.azurewebsites.net/api/auth/verify
```

Si funciona, las dependencias están instaladas correctamente.

### Método 3: Ver Logs de la Aplicación

1. Azure Portal → App Service → "Registros"
2. Habilitar "Application Logging"
3. Ver logs en tiempo real
4. Si ves errores como "Cannot find module 'bcrypt'", las dependencias no se instalaron

---

## 🐛 Problemas Comunes

### Error: "Cannot find module 'bcrypt'"

**Causa:** Las dependencias no se instalaron en Azure

**Solución:**
1. Verificar que `package.json` esté en el despliegue
2. Verificar logs del despliegue
3. Re-desplegar el código
4. Verificar que el runtime sea Node.js 18 LTS

### Error: "npm install failed"

**Causa:** Problema con el `package.json` o conexión

**Solución:**
1. Verificar que `package.json` sea válido
2. Verificar logs del despliegue para más detalles
3. Probar localmente primero: `npm install`

### Las dependencias no se actualizan

**Causa:** Cache de Azure

**Solución:**
1. Reiniciar el App Service
2. O re-desplegar el código

---

## 📋 Checklist

### Para Desarrollo Local:
- [ ] Ejecutar `npm install` en tu PC
- [ ] Verificar que `node_modules/` se creó
- [ ] Probar servidor localmente: `npm run dev`

### Para Despliegue en Azure:
- [ ] `package.json` está en el ZIP/Git
- [ ] `server.js` está en el ZIP/Git
- [ ] **NO incluir** `node_modules/` en el ZIP
- [ ] Desplegar código
- [ ] Verificar logs del despliegue
- [ ] Probar API después del despliegue

---

## 💡 Resumen

| Situación | ¿Ejecutar `npm install`? | Dónde |
|-----------|-------------------------|-------|
| **Desarrollo local** | ✅ Sí | Tu PC (PowerShell) |
| **Despliegue en Azure** | ❌ No | Azure lo hace automáticamente |
| **Ejecutar scripts locales** | ✅ Sí | Tu PC (PowerShell) |
| **Probar antes de desplegar** | ✅ Sí | Tu PC (PowerShell) |

**Regla de oro:** 
- 🖥️ **Localmente:** Ejecuta `npm install` para desarrollo
- ☁️ **En Azure:** Azure lo hace automáticamente, no necesitas hacer nada

---

## 🎯 Ejemplo Práctico

### Escenario: Quieres probar el login localmente

```powershell
# 1. Instalar dependencias en tu PC
cd c:\Proyectos\WebControlHoras
npm install

# 2. Ejecutar servidor local
npm run dev

# 3. Abrir navegador
# http://localhost:3000
```

### Escenario: Desplegar a Azure

```powershell
# 1. Crear ZIP (NO incluye node_modules)
powershell -ExecutionPolicy Bypass -File prepare-deploy.ps1

# 2. Subir ZIP a Azure Portal
# Azure automáticamente ejecuta npm install

# 3. Probar API
curl https://tu-app-service.azurewebsites.net/api/registros
```

---

## ❓ Preguntas Frecuentes

**P: ¿Puedo ejecutar `npm install` en Azure manualmente?**

R: Sí, pero no es necesario. Azure lo hace automáticamente. Si quieres hacerlo manualmente:
1. Azure Portal → App Service → "Consola" (SSH)
2. Ejecutar `npm install`
3. Reiniciar App Service

**P: ¿Debo incluir `node_modules/` en el ZIP?**

R: ❌ **NO**. El ZIP será muy grande y el despliegue será lento. Azure instala las dependencias automáticamente.

**P: ¿Qué pasa si cambio `package.json` después del despliegue?**

R: Necesitas re-desplegar el código. Azure detectará el cambio y ejecutará `npm install` nuevamente.

**P: ¿Puedo ver qué dependencias se instalaron en Azure?**

R: Sí, en los logs del despliegue verás el output de `npm install`.

