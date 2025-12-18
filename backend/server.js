const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
// Azure App Service usa el puerto de la variable de entorno PORT
// En desarrollo local usa 3000, en Azure usa el puerto asignado (generalmente 8080)
const PORT = process.env.PORT || 3000;

// Middleware CORS - Configurar para permitir acceso desde Blob Storage
const corsOptions = {
    origin: function (origin, callback) {
        // Permitir sin origen (aplicaciones móviles, Postman, etc.)
        if (!origin) return callback(null, true);
        
        // Lista de orígenes permitidos (agregar la URL de tu Blob Storage)
        const allowedOrigins = [
            'https://webcontrolhoras.z6.web.core.windows.net', // Ejemplo - reemplazar con tu URL
            'https://*.web.core.windows.net', // Permitir cualquier Blob Storage de Azure
            'http://localhost:5500', // Para desarrollo local
            'http://127.0.0.1:5500',
            process.env.ALLOWED_ORIGIN // Variable de entorno para producción
        ].filter(Boolean);
        
        // Permitir si está en la lista o si coincide con patrón
        if (allowedOrigins.some(allowed => origin.includes(allowed.replace('*.', '')))) {
            callback(null, true);
        } else {
            // En desarrollo, permitir todos (cambiar en producción)
            if (process.env.NODE_ENV !== 'production') {
                callback(null, true);
            } else {
                callback(new Error('No permitido por CORS'));
            }
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
// No servir archivos estáticos si la API está separada del frontend
// app.use(express.static('.')); // Comentado porque el HTML está en Blob Storage

// Configuración de SQL Server
const sqlConfig = {
    user: process.env.DB_USER || 'administrador',
    password: process.env.DB_PASSWORD || 'l0g1C4l1S2025',
    server: process.env.DB_SERVER || 'controlhoraslogicalis.database.windows.net',
    database: process.env.DB_NAME || 'bbddcontrolhoras',
    options: {
        encrypt: true, // Azure requiere encriptación
        trustServerCertificate: false,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// Pool de conexiones
let pool = null;

async function getPool() {
    if (!pool) {
        try {
            pool = await sql.connect(sqlConfig);
            console.log('✅ Conectado a SQL Server');
        } catch (err) {
            console.error('❌ Error de conexión a SQL Server:', err);
            throw err;
        }
    }
    return pool;
}

// Middleware para manejar errores de conexión
app.use(async (req, res, next) => {
    try {
        await getPool();
        next();
    } catch (err) {
        res.status(500).json({ error: 'Error de conexión a la base de datos', details: err.message });
    }
});

// ========== RUTAS API ==========

// GET /api/registros - Obtener todos los registros
app.get('/api/registros', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT 
                id,
                phase,
                task,
                milestone,
                FORMAT([start], 'dd/MM/yyyy') as [start],
                FORMAT([end], 'dd/MM/yyyy') as [end],
                completion,
                dependencies,
                assignee,
                [time]
            FROM controlhorario
            ORDER BY id DESC
        `);
        
        // Convertir a formato JSON compatible
        const registros = result.recordset.map(row => ({
            id: row.id,
            phase: row.phase,
            task: row.task,
            milestone: row.milestone,
            start: row.start || null,
            end: row.end || null,
            completion: row.completion || 0,
            dependencies: row.dependencies,
            assignee: row.assignee,
            time: row.time || null
        }));
        
        res.json(registros);
    } catch (err) {
        console.error('Error al obtener registros:', err);
        res.status(500).json({ error: 'Error al obtener registros', details: err.message });
    }
});

// POST /api/registros - Insertar nuevo registro
app.post('/api/registros', async (req, res) => {
    try {
        const { phase, task, milestone, start, end, completion, dependencies, assignee, time } = req.body;
        
        // Convertir fechas de formato DD/MM/YYYY a DATE
        let startDate = null;
        let endDate = null;
        
        if (start) {
            const [d, m, y] = start.split('/');
            startDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        
        if (end) {
            const [d, m, y] = end.split('/');
            endDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        
        const pool = await getPool();
        const result = await pool.request()
            .input('phase', sql.NVarChar(255), phase)
            .input('task', sql.NVarChar(255), task)
            .input('milestone', sql.NVarChar(255), milestone)
            .input('start', sql.Date, startDate)
            .input('end', sql.Date, endDate)
            .input('completion', sql.Int, completion || 0)
            .input('dependencies', sql.NVarChar(255), dependencies)
            .input('assignee', sql.NVarChar(255), assignee)
            .input('time', sql.Int, time)
            .query(`
                INSERT INTO controlhorario (phase, task, milestone, [start], [end], completion, dependencies, assignee, [time])
                OUTPUT INSERTED.id
                VALUES (@phase, @task, @milestone, @start, @end, @completion, @dependencies, @assignee, @time)
            `);
        
        const newId = result.recordset[0].id;
        res.status(201).json({ id: newId, message: 'Registro insertado correctamente' });
    } catch (err) {
        console.error('Error al insertar registro:', err);
        res.status(500).json({ error: 'Error al insertar registro', details: err.message });
    }
});

// PUT /api/registros/:id - Actualizar registro
app.put('/api/registros/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { phase, task, milestone, start, end, completion, dependencies, assignee, time } = req.body;
        
        // Convertir fechas de formato DD/MM/YYYY a DATE
        let startDate = null;
        let endDate = null;
        
        if (start) {
            const [d, m, y] = start.split('/');
            startDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        
        if (end) {
            const [d, m, y] = end.split('/');
            endDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('phase', sql.NVarChar(255), phase)
            .input('task', sql.NVarChar(255), task)
            .input('milestone', sql.NVarChar(255), milestone)
            .input('start', sql.Date, startDate)
            .input('end', sql.Date, endDate)
            .input('completion', sql.Int, completion || 0)
            .input('dependencies', sql.NVarChar(255), dependencies)
            .input('assignee', sql.NVarChar(255), assignee)
            .input('time', sql.Int, time)
            .query(`
                UPDATE controlhorario
                SET phase = @phase,
                    task = @task,
                    milestone = @milestone,
                    [start] = @start,
                    [end] = @end,
                    completion = @completion,
                    dependencies = @dependencies,
                    assignee = @assignee,
                    [time] = @time,
                    fecha_actualizacion = GETDATE()
                WHERE id = @id
            `);
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }
        
        res.json({ message: 'Registro actualizado correctamente' });
    } catch (err) {
        console.error('Error al actualizar registro:', err);
        res.status(500).json({ error: 'Error al actualizar registro', details: err.message });
    }
});

// DELETE /api/registros/:id - Eliminar registro
app.delete('/api/registros/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM controlhorario WHERE id = @id');
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }
        
        res.json({ message: 'Registro eliminado correctamente' });
    } catch (err) {
        console.error('Error al eliminar registro:', err);
        res.status(500).json({ error: 'Error al eliminar registro', details: err.message });
    }
});

// Servir el HTML principal (solo si no está en Blob Storage)
// Si el HTML está en Blob Storage, esta ruta no se usará
// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'informe_completo.html'));
// });

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📊 API disponible en http://localhost:${PORT}/api/registros`);
});

// Manejo de cierre graceful
process.on('SIGINT', async () => {
    console.log('\n⏹️  Cerrando servidor...');
    if (pool) {
        await pool.close();
        console.log('✅ Conexión a SQL Server cerrada');
    }
    process.exit(0);
});

