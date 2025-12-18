# 🔐 Instrucciones de Autenticación y Roles

## 📋 Resumen

Se ha implementado un sistema completo de autenticación con tres roles:
- **Admin**: Acceso completo (incluye gestión de usuarios)
- **Gestor**: Puede crear, editar y eliminar registros (no puede gestionar usuarios)
- **Visor**: Solo puede ver informes (no puede modificar datos)

## 🚀 Pasos de Configuración

### 1. Instalar Dependencias

```bash
npm install
```

Esto instalará:
- `bcrypt` - Para hash de contraseñas
- `jsonwebtoken` - Para tokens JWT

### 2. Crear Tabla de Usuarios

Ejecuta en Azure SQL Database:

```sql
-- Archivo: crear_tabla_usuarios.sql
```

### 3. Crear Usuario Administrador Inicial

**Opción A: Usando el script Node.js (Recomendado)**

```bash
node crear_usuario_admin.js
```

Esto generará un hash bcrypt para la contraseña `admin123`. Copia el hash y ejecuta el INSERT en SQL:

```sql
USE bbddcontrolhoras;
GO

INSERT INTO usuarios (usuario, password_hash, rol, activo)
VALUES (
    'admin',
    'HASH_GENERADO_AQUI', -- Pegar el hash del script
    'admin',
    1
);
GO
```

**Opción B: Crear manualmente desde la aplicación**

1. Inicia sesión con cualquier método temporal
2. Crea el usuario admin desde la interfaz (requiere permisos de admin)

### 4. Configurar Variable de Entorno JWT_SECRET

En Azure App Service, agrega la variable de entorno:

```
JWT_SECRET=UsNzqUEK+OwIjmJKoM2oxOKB/KMHEPMzoUp0h+FMTiaFknXbBSdp7guKkvrp6AYOBsDuMQOk+OHDuXiZ35vH0Q==
```

⚠️ **IMPORTANTE**: 
- Esta es una clave generada aleatoriamente y segura
- **NO la compartas** ni la expongas en código público
- Si ya tienes una clave en producción, mantén esa
- Esta clave es solo para tu entorno de desarrollo/producción

### 5. Reiniciar el App Service

Después de configurar las variables de entorno, reinicia el App Service.

## 📱 Uso de la Aplicación

### Login

1. Abre `login.html` en tu navegador
2. Ingresa usuario y contraseña
3. El sistema redirigirá automáticamente a `informe_completo.html`

### Gestión de Usuarios (Solo Admin)

1. Inicia sesión como administrador
2. Haz clic en el botón "Usuarios" en el header
3. Desde `gestion_usuarios.html` puedes:
   - Ver lista de usuarios
   - Crear nuevos usuarios
   - Editar usuarios existentes
   - Eliminar usuarios (excepto el propio)

### Roles y Permisos

#### Admin
- ✅ Ver todos los informes
- ✅ Crear, editar y eliminar registros
- ✅ Gestionar usuarios (crear, editar, eliminar)
- ✅ Acceso completo

#### Gestor
- ✅ Ver todos los informes
- ✅ Crear, editar y eliminar registros
- ❌ No puede gestionar usuarios

#### Visor
- ✅ Ver todos los informes
- ❌ No puede crear, editar o eliminar registros
- ❌ No puede gestionar usuarios

## 🔧 Endpoints de la API

### Autenticación

- `POST /api/auth/login` - Iniciar sesión
  ```json
  {
    "usuario": "admin",
    "password": "admin123"
  }
  ```
  Respuesta:
  ```json
  {
    "token": "jwt-token-here",
    "user": {
      "id": 1,
      "usuario": "admin",
      "rol": "admin"
    }
  }
  ```

- `GET /api/auth/verify` - Verificar token (requiere Authorization header)

### Usuarios (Solo Admin)

- `GET /api/usuarios` - Listar usuarios
- `POST /api/usuarios` - Crear usuario
- `PUT /api/usuarios/:id` - Actualizar usuario
- `DELETE /api/usuarios/:id` - Eliminar usuario

### Registros (Protegidos según rol)

- `GET /api/registros` - Listar registros (todos los roles autenticados)
- `POST /api/registros` - Crear registro (admin, gestor)
- `PUT /api/registros/:id` - Actualizar registro (admin, gestor)
- `DELETE /api/registros/:id` - Eliminar registro (admin, gestor)

## 🔒 Seguridad

### Contraseñas

- Las contraseñas se almacenan como hash bcrypt (nunca en texto plano)
- El hash se genera en el servidor, nunca se envía la contraseña en texto plano desde el cliente
- Las contraseñas se verifican comparando el hash almacenado con el hash de la contraseña ingresada

### Tokens JWT

- Los tokens expiran después de 24 horas
- Los tokens se almacenan en `localStorage` del navegador
- Cada petición a la API incluye el token en el header `Authorization: Bearer <token>`

### CORS

- La API está configurada para aceptar peticiones desde:
  - Tu Blob Storage URL
  - `localhost` (desarrollo)
  - Cualquier dominio `.web.core.windows.net`

## 🐛 Troubleshooting

### Error: "Token de acceso requerido"

**Causa**: No estás autenticado o el token expiró.

**Solución**: 
1. Ve a `login.html`
2. Inicia sesión nuevamente

### Error: "No tienes permisos para esta acción"

**Causa**: Tu rol no tiene permisos para la acción solicitada.

**Solución**: Contacta a un administrador para que te asigne el rol adecuado.

### Error: "Usuario o contraseña incorrectos"

**Causa**: 
- Usuario no existe
- Contraseña incorrecta
- Usuario inactivo

**Solución**: 
- Verifica que el usuario exista en la base de datos
- Verifica que el usuario esté activo (`activo = 1`)
- Si eres admin, puedes reactivar usuarios desde la gestión de usuarios

### No puedo crear usuarios

**Causa**: Solo los usuarios con rol `admin` pueden crear usuarios.

**Solución**: Inicia sesión como administrador.

## 📝 Notas Importantes

1. **Cambiar contraseña inicial**: Después del primer login, cambia la contraseña del usuario `admin` desde la gestión de usuarios.

2. **Backup**: Realiza backups regulares de la tabla `usuarios`.

3. **JWT_SECRET**: Nunca compartas ni expongas el `JWT_SECRET` en el código fuente. Úsalo solo como variable de entorno.

4. **HTTPS**: En producción, asegúrate de usar HTTPS para proteger los tokens en tránsito.

5. **Logout**: El botón "Cerrar Sesión" limpia el token del `localStorage` y redirige a login.

## ✅ Checklist de Implementación

- [ ] Dependencias instaladas (`npm install`)
- [ ] Tabla `usuarios` creada en SQL Database
- [ ] Usuario admin inicial creado con hash bcrypt
- [ ] Variable `JWT_SECRET` configurada en App Service
- [ ] App Service reiniciado
- [ ] Login probado
- [ ] Creación de usuarios probada (admin)
- [ ] Permisos por rol verificados
- [ ] Logout funcionando

