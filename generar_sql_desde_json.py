#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para generar SQL desde JSON
Convierte el archivo JSON en comandos SQL INSERT
"""

import json
import sys

def escape_sql_string(value):
    """Escapa comillas simples para SQL"""
    if value is None:
        return 'NULL'
    if isinstance(value, (int, float)):
        return str(value)
    # Escapar comillas simples duplicándolas
    return "'" + str(value).replace("'", "''") + "'"

def convert_date(date_str):
    """Convierte fecha DD/MM/YYYY a formato SQL"""
    if not date_str or date_str == 'null':
        return 'NULL'
    try:
        # Formato: DD/MM/YYYY
        parts = date_str.split('/')
        if len(parts) == 3:
            day, month, year = parts
            # Verificar si hay errores en la fecha (ej: 107/01/2026 -> 07/01/2026)
            if len(day) > 2:
                day = day[-2:]  # Tomar los últimos 2 dígitos
            # SQL Server usa formato: TRY_CONVERT(DATE, 'DD/MM/YYYY', 103)
            return f"TRY_CONVERT(DATE, '{day}/{month}/{year}', 103)"
        return 'NULL'
    except:
        return 'NULL'

def generate_sql(json_file_path, output_sql_path):
    """Genera el archivo SQL desde el JSON"""
    
    # Leer JSON
    with open(json_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Generar SQL
    sql_lines = []
    sql_lines.append("-- ============================================")
    sql_lines.append("-- Script generado automáticamente desde JSON")
    sql_lines.append("-- Base de datos: bbddcontrolhoras")
    sql_lines.append("-- Tabla: controlhorario")
    sql_lines.append("-- ============================================")
    sql_lines.append("")
    sql_lines.append("USE bbddcontrolhoras;")
    sql_lines.append("GO")
    sql_lines.append("")
    sql_lines.append("-- Eliminar datos existentes (opcional)")
    sql_lines.append("-- TRUNCATE TABLE controlhorario;")
    sql_lines.append("-- GO")
    sql_lines.append("")
    sql_lines.append("-- Insertar registros")
    sql_lines.append("INSERT INTO controlhorario (phase, task, milestone, [start], [end], completion, dependencies, assignee, [time])")
    sql_lines.append("VALUES")
    
    # Procesar cada registro
    values = []
    for i, record in enumerate(data):
        phase = escape_sql_string(record.get('phase'))
        task = escape_sql_string(record.get('task'))
        milestone = escape_sql_string(record.get('milestone'))
        start_date = convert_date(record.get('start'))
        end_date = convert_date(record.get('end'))
        completion = record.get('completion') if record.get('completion') is not None else 'NULL'
        dependencies = escape_sql_string(record.get('dependencies'))
        assignee = escape_sql_string(record.get('assignee'))
        time = record.get('time') if record.get('time') is not None else 'NULL'
        
        value_line = f"({phase}, {task}, {milestone}, {start_date}, {end_date}, {completion}, {dependencies}, {assignee}, {time})"
        
        # Agregar coma excepto en el último
        if i < len(data) - 1:
            value_line += ","
        else:
            value_line += ";"
        
        values.append(value_line)
    
    # Agregar valores al SQL (en lotes para mejor legibilidad)
    batch_size = 50
    for i in range(0, len(values), batch_size):
        batch = values[i:i+batch_size]
        sql_lines.extend(batch)
        if i + batch_size < len(values):
            sql_lines.append("")
            sql_lines.append("INSERT INTO controlhorario (phase, task, milestone, [start], [end], completion, dependencies, assignee, [time])")
            sql_lines.append("VALUES")
    
    sql_lines.append("")
    sql_lines.append("GO")
    sql_lines.append("")
    sql_lines.append(f"PRINT 'Total de registros insertados: {len(data)}';")
    sql_lines.append("GO")
    
    # Escribir archivo SQL
    with open(output_sql_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_lines))
    
    print(f"SQL generado exitosamente: {output_sql_path}")
    print(f"   Total de registros: {len(data)}")

if __name__ == '__main__':
    json_file = r'c:\Users\fescribano\Downloads\data2 -Horas (1).json'
    sql_file = 'insertar_datos_completos.sql'
    
    try:
        generate_sql(json_file, sql_file)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

