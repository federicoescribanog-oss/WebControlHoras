-- ============================================
-- Script completo para crear tabla y cargar datos
-- Base de datos: bbddcontrolhoras
-- Servidor: controlhoraslogicalis.database.windows.net
-- Tabla: controlhorario
-- ============================================

USE bbddcontrolhoras;
GO

-- Eliminar tabla si existe (opcional, solo para desarrollo)
IF OBJECT_ID('controlhorario', 'U') IS NOT NULL
    DROP TABLE controlhorario;
GO

-- Crear tabla controlhorario
-- Nota: Usamos corchetes [] para palabras reservadas: [start], [end], [time]
CREATE TABLE controlhorario (
    id INT IDENTITY(1,1) PRIMARY KEY,
    phase NVARCHAR(255) NULL,
    task NVARCHAR(255) NULL,
    milestone NVARCHAR(255) NULL,
    [start] DATE NULL,
    [end] DATE NULL,
    completion INT NULL,
    dependencies NVARCHAR(255) NULL,
    assignee NVARCHAR(255) NULL,
    [time] INT NULL,
    fecha_creacion DATETIME2 DEFAULT GETDATE(),
    fecha_actualizacion DATETIME2 DEFAULT GETDATE()
);
GO

-- Crear índices para mejorar el rendimiento
CREATE INDEX IX_controlhorario_assignee ON controlhorario(assignee);
CREATE INDEX IX_controlhorario_phase ON controlhorario(phase);
CREATE INDEX IX_controlhorario_task ON controlhorario(task);
CREATE INDEX IX_controlhorario_start ON controlhorario([start]);
CREATE INDEX IX_controlhorario_end ON controlhorario([end]);
GO

PRINT 'Tabla controlhorario creada exitosamente.';
PRINT 'Ejecuta el script insertar_datos_completos.sql para cargar los datos.';
GO

