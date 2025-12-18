-- ============================================
-- Script para crear tabla y cargar datos
-- Base de datos: bbddcontrolhoras
-- Servidor: controlhoraslogicalis.database.windows.net
-- Tabla: controlhorario
-- ============================================

USE bbddcontrolhoras;
GO

-- Eliminar tabla si existe (opcional, solo para desarrollo)
-- DROP TABLE IF EXISTS controlhorario;
-- GO

-- Crear tabla controlhorario
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

-- ============================================
-- INSERTAR DATOS
-- ============================================

-- Función auxiliar para convertir fecha DD/MM/YYYY a DATE
-- Nota: SQL Server no tiene una función directa, usaremos TRY_CONVERT

-- Insertar registros
INSERT INTO controlhorario (phase, task, milestone, [start], [end], completion, dependencies, assignee, [time])
VALUES
('Logicalis', 'Desocupación', NULL, NULL, NULL, 0, NULL, NULL, NULL),
('Codere', 'Servicio', NULL, TRY_CONVERT(DATE, '01/06/2024', 103), TRY_CONVERT(DATE, '31/12/2026', 103), 0, NULL, 'Daniel Marquez', 8),
('A3Media', 'Servicio', NULL, TRY_CONVERT(DATE, '01/06/2024', 103), TRY_CONVERT(DATE, '31/12/2026', 103), 0, NULL, 'Victor Gutierrez', 8),
('Ocaso', 'Comunidades', NULL, TRY_CONVERT(DATE, '25/08/2025', 103), TRY_CONVERT(DATE, '21/10/2025', 103), 0, NULL, 'Felipe Flores', 8),
('Ocaso', 'Comunidades', NULL, TRY_CONVERT(DATE, '25/08/2025', 103), TRY_CONVERT(DATE, '21/10/2025', 103), 0, NULL, 'Tomas', 4),
('Ocaso', 'Servicio', NULL, TRY_CONVERT(DATE, '01/01/2025', 103), TRY_CONVERT(DATE, '21/10/2026', 103), 0, NULL, 'Tomas', 4),
('Ocaso', 'Filecon', NULL, TRY_CONVERT(DATE, '22/10/2025', 103), TRY_CONVERT(DATE, '31/01/2026', 103), 0, NULL, 'Felipe Flores', 8),
('Codere', 'Nueva Arquitectura', NULL, TRY_CONVERT(DATE, '01/06/2025', 103), TRY_CONVERT(DATE, '02/02/2026', 103), 0, NULL, 'Vincenzo Bouno', 8),
('Codere', 'Nueva Arquitectura', NULL, TRY_CONVERT(DATE, '01/06/2025', 103), TRY_CONVERT(DATE, '05/03/2026', 103), 0, NULL, 'Gonzalo Perales', 8),
('+Orange', 'Servicio', NULL, TRY_CONVERT(DATE, '01/06/2024', 103), TRY_CONVERT(DATE, '31/12/2026', 103), 0, NULL, 'Carlos Champa', 8),
('Santander', 'Fundación Teresa', NULL, TRY_CONVERT(DATE, '11/09/2025', 103), TRY_CONVERT(DATE, '17/11/2025', 103), 75, NULL, 'Julio Fernandez', 4),
('Vodafone', 'Predicción', NULL, TRY_CONVERT(DATE, '25/09/2025', 103), TRY_CONVERT(DATE, '10/11/2025', 103), 90, NULL, 'Julio Fernandez', 4),
('Codere', 'RRHH', NULL, TRY_CONVERT(DATE, '01/06/2024', 103), TRY_CONVERT(DATE, '31/12/2025', 103), 0, NULL, 'Pablo Vergara', 2),
('Alter', 'Bolsa de Horas', NULL, TRY_CONVERT(DATE, '01/06/2024', 103), TRY_CONVERT(DATE, '31/12/2025', 103), 0, NULL, 'Pablo Vergara', 1),
('Mercedes', 'Servicio', NULL, TRY_CONVERT(DATE, '01/06/2024', 103), TRY_CONVERT(DATE, '31/12/2026', 103), 0, NULL, 'Pablo Vergara', 1),
('A3Media', 'Airflow', NULL, TRY_CONVERT(DATE, '01/09/2025', 103), TRY_CONVERT(DATE, '03/11/2025', 103), 0, NULL, 'Lennin Caro', 4),
('A3Media', 'Airflow', NULL, TRY_CONVERT(DATE, '01/09/2025', 103), TRY_CONVERT(DATE, '03/11/2025', 103), 0, NULL, 'Pablo Fernandez', 8),
('Logicalis', 'IAOps', NULL, TRY_CONVERT(DATE, '24/10/2025', 103), TRY_CONVERT(DATE, '24/11/2025', 103), 0, NULL, 'Pablo Fernandez', 2),
('Diputación Girona', 'Video', NULL, TRY_CONVERT(DATE, '22/09/2025', 103), TRY_CONVERT(DATE, '10/11/2025', 103), 0, NULL, 'Lennin Caro', 4),
('Codere', 'INF Clintes', NULL, TRY_CONVERT(DATE, '29/09/2025', 103), TRY_CONVERT(DATE, '01/04/2026', 103), 0, NULL, 'Luis Quezada', 8),
('Codere', 'INF Clintes', NULL, TRY_CONVERT(DATE, '29/09/2025', 103), TRY_CONVERT(DATE, '01/04/2026', 103), 0, NULL, 'Concepción Cabrera', 8),
('Codere', 'Servicio', NULL, TRY_CONVERT(DATE, '29/09/2025', 103), TRY_CONVERT(DATE, '01/04/2026', 103), 0, NULL, 'David Pineda', 8),
('Servihabitat', 'AWS And Snowflake', NULL, TRY_CONVERT(DATE, '29/08/2025', 103), TRY_CONVERT(DATE, '31/12/2025', 103), 0, NULL, 'Guillermo Aumatell', 4),
('Mapfre', 'dbt + Snowflake', NULL, TRY_CONVERT(DATE, '24/07/2025', 103), TRY_CONVERT(DATE, '24/10/2025', 103), 0, NULL, 'Guillermo Aumatell', 4),
('Mapfre', 'dbt + Snowflake', NULL, TRY_CONVERT(DATE, '24/07/2025', 103), TRY_CONVERT(DATE, '24/10/2025', 103), 0, NULL, 'Aleix Lopez', 8),
('AMA', 'Servicio', NULL, TRY_CONVERT(DATE, '29/09/2025', 103), TRY_CONVERT(DATE, '01/04/2026', 103), 0, NULL, 'Pablo Muñoz', 8),
('Mapfre', 'Servicio', NULL, TRY_CONVERT(DATE, '29/09/2025', 103), TRY_CONVERT(DATE, '01/04/2026', 103), 0, NULL, 'Oliver Perez', 8),
('RACC', 'Fabric', NULL, TRY_CONVERT(DATE, '10/10/2025', 103), TRY_CONVERT(DATE, '10/12/2025', 103), 0, NULL, 'Anastasia Lukina', 8),
('Santillana', 'IaC', NULL, TRY_CONVERT(DATE, '25/09/2025', 103), TRY_CONVERT(DATE, '03/10/2025', 103), 0, NULL, 'Claudio Arribas', 8),
('+Orange', 'Observabilidad', NULL, TRY_CONVERT(DATE, '10/10/2025', 103), TRY_CONVERT(DATE, '12/12/2025', 103), 0, NULL, 'Claudio Arribas', 8),
('LOGG', 'IA', NULL, TRY_CONVERT(DATE, '01/06/2025', 103), TRY_CONVERT(DATE, '24/10/2025', 103), 0, NULL, 'Ines García', 3),
('ESADE', 'DLP', NULL, TRY_CONVERT(DATE, '01/10/2025', 103), TRY_CONVERT(DATE, '31/10/2025', 103), 0, NULL, 'Ines García', 3),
('ESADE', 'DLP', NULL, TRY_CONVERT(DATE, '01/11/2025', 103), TRY_CONVERT(DATE, '30/11/2025', 103), 0, NULL, 'Ines García', 1),
('ESADE', 'DLP', NULL, TRY_CONVERT(DATE, '01/12/2025', 103), TRY_CONVERT(DATE, '31/12/2025', 103), 0, NULL, 'Ines García', 1),
('IE', 'Purview', NULL, TRY_CONVERT(DATE, '01/10/2025', 103), TRY_CONVERT(DATE, '12/12/2026', 103), 0, NULL, 'Ines García', 1),
('MANGO', 'bat', NULL, TRY_CONVERT(DATE, '03/10/2025', 103), TRY_CONVERT(DATE, '08/10/2025', 103), 0, NULL, 'Claudio Arribas', 8),
('Logicalis MAD', 'Preventa', NULL, TRY_CONVERT(DATE, '29/08/2025', 103), TRY_CONVERT(DATE, '01/12/2026', 103), 0, NULL, 'Federico Escribano', 8);
GO

-- Continuar con las vacaciones y el resto de registros...
-- Nota: Debido a la cantidad de registros (más de 3500), voy a crear un script separado
-- que use un enfoque más eficiente con BULK INSERT o múltiples INSERTs en lotes

PRINT 'Tabla creada e índices generados.';
PRINT 'Total de registros insertados: ' + CAST(@@ROWCOUNT AS VARCHAR(10));
GO

