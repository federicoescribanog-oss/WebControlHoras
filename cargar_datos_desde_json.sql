-- ============================================
-- Script para cargar datos desde JSON usando OPENJSON
-- Base de datos: bbddcontrolhoras
-- ============================================

USE bbddcontrolhoras;
GO

-- Este script requiere que el JSON esté en una variable o archivo
-- Opción 1: Si tienes el JSON en una variable
/*
DECLARE @json NVARCHAR(MAX);
SET @json = N'[{"phase":"Logicalis","task":"Desocupación",...}]'; -- Tu JSON completo aquí

INSERT INTO controlhorario (phase, task, milestone, [start], [end], completion, dependencies, assignee, [time])
SELECT 
    phase,
    task,
    milestone,
    CASE WHEN [start] IS NULL OR [start] = '' THEN NULL ELSE TRY_CONVERT(DATE, [start], 103) END AS [start],
    CASE WHEN [end] IS NULL OR [end] = '' THEN NULL ELSE TRY_CONVERT(DATE, [end], 103) END AS [end],
    completion,
    dependencies,
    assignee,
    [time]
FROM OPENJSON(@json)
WITH (
    phase NVARCHAR(255) '$.phase',
    task NVARCHAR(255) '$.task',
    milestone NVARCHAR(255) '$.milestone',
    [start] NVARCHAR(50) '$.start',
    [end] NVARCHAR(50) '$.end',
    completion INT '$.completion',
    dependencies NVARCHAR(255) '$.dependencies',
    assignee NVARCHAR(255) '$.assignee',
    [time] INT '$.time'
);
GO
*/

-- Opción 2: Usar BULK INSERT (más eficiente para archivos grandes)
-- Primero necesitas subir el JSON a Azure Blob Storage o usar OPENROWSET

PRINT 'Para cargar datos desde JSON, usa el script insertar_datos_completos.sql';
PRINT 'o ejecuta el script Python generar_sql_desde_json.py para generar los INSERTs.';
GO

