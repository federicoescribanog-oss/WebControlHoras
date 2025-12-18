-- ============================================
-- Script para crear tabla de usuarios
-- Base de datos: bbddcontrolhoras
-- Servidor: controlhoraslogicalis.database.windows.net
-- Tabla: usuarios
-- ============================================

USE bbddcontrolhoras;
GO

-- Eliminar tabla si existe (opcional, solo para desarrollo)
IF OBJECT_ID('usuarios', 'U') IS NOT NULL
    DROP TABLE usuarios;
GO

-- Crear tabla usuarios
CREATE TABLE usuarios (
    id INT IDENTITY(1,1) PRIMARY KEY,
    usuario NVARCHAR(100) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL, -- Hash bcrypt (60 caracteres)
    rol NVARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'gestor', 'visor')),
    activo BIT DEFAULT 1,
    fecha_creacion DATETIME2 DEFAULT GETDATE(),
    fecha_ultimo_acceso DATETIME2 NULL,
    creado_por INT NULL, -- ID del usuario que creó este usuario
    FOREIGN KEY (creado_por) REFERENCES usuarios(id)
);
GO

-- Crear índices
CREATE INDEX IX_usuarios_usuario ON usuarios(usuario);
CREATE INDEX IX_usuarios_rol ON usuarios(rol);
CREATE INDEX IX_usuarios_activo ON usuarios(activo);
GO

-- Insertar usuario administrador inicial
-- ⚠️ IMPORTANTE: 
-- 1. Ejecuta primero: node crear_usuario_admin.js
-- 2. Copia el hash generado y reemplázalo en el INSERT de abajo
-- 3. O ejecuta el INSERT directamente desde el output del script
-- 4. Contraseña inicial: admin123 (cambiar después del primer login)

-- Ejemplo de INSERT (reemplazar con el hash real generado por crear_usuario_admin.js):
-- INSERT INTO usuarios (usuario, password_hash, rol, activo)
-- VALUES (
--     'admin',
--     'TU_HASH_AQUI', -- Reemplazar con el hash generado
--     'admin',
--     1
-- );
-- GO

PRINT 'Tabla usuarios creada correctamente';
PRINT 'NOTA: Ejecuta "node crear_usuario_admin.js" para generar el hash de contraseña';
PRINT 'Luego ejecuta el INSERT con el hash generado';
GO

