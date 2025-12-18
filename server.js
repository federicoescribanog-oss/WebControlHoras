const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
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
        
        // Lista de orígenes permitidos explícitos
        const allowedOrigins = [
            'https://webcontrolhoras.z6.web.core.windows.net', // Tu Blob Storage
            'http://localhost:5500', // Para desarrollo local
            'http://127.0.0.1:5500',
            'http://localhost:8080',
            'http://127.0.0.1:8080',
            process.env.ALLOWED_ORIGIN // Variable de entorno para producción
        ].filter(Boolean);
        
        // Verificar si el origen está en la lista explícita
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        // Permitir cualquier dominio que termine en .web.core.windows.net (Blob Storage de Azure)
        if (origin.endsWith('.web.core.windows.net')) {
            return callback(null, true);
        }
        
        // En desarrollo, permitir todos (cambiar en producción)
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        
        // En producción, rechazar si no está permitido
        callback(new Error('No permitido por CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Access-Control-Request-Method', 'Access-Control-Request-Headers'],
    optionsSuccessStatus: 200 // Algunos navegadores antiguos requieren esto
};

app.use(cors(corsOptions));
app.use(express.json());
// No servir archivos estáticos si la API está separada del frontend
// app.use(express.static('.')); // Comentado porque el HTML está en Blob Storage

// ========== CONFIGURACIÓN DE AUTENTICACIÓN ==========
const JWT_SECRET = process.env.JWT_SECRET || 'tu-secret-key-cambiar-en-produccion';
const JWT_EXPIRES_IN = '24h'; // Token válido por 24 horas

// Middleware para verificar token JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(401).json({ error: 'Token de acceso requerido' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido o expirado' });
        }
        req.user = user; // { id, usuario, rol }
        next();
    });
}

// Middleware para verificar roles
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        if (!allowedRoles.includes(req.user.rol)) {
            return res.status(403).json({ error: 'No tienes permisos para esta acción' });
        }
        
        next();
    };
}

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

// ========== RUTAS DE AUTENTICACIÓN ==========

// POST /api/auth/login - Iniciar sesión
app.post('/api/auth/login', async (req, res) => {
    try {
        const { usuario, password } = req.body;
        
        if (!usuario || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
        }
        
        const pool = await getPool();
        const result = await pool.request()
            .input('usuario', sql.NVarChar(100), usuario)
            .query(`
                SELECT id, usuario, password_hash, rol, activo
                FROM usuarios
                WHERE usuario = @usuario AND activo = 1
            `);
        
        if (result.recordset.length === 0) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
        
        const user = result.recordset[0];
        
        // Verificar contraseña
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
        
        // Actualizar último acceso
        await pool.request()
            .input('id', sql.Int, user.id)
            .query('UPDATE usuarios SET fecha_ultimo_acceso = GETDATE() WHERE id = @id');
        
        // Generar token JWT
        const token = jwt.sign(
            { 
                id: user.id, 
                usuario: user.usuario, 
                rol: user.rol 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        res.json({
            token,
            user: {
                id: user.id,
                usuario: user.usuario,
                rol: user.rol
            }
        });
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ error: 'Error al iniciar sesión', details: err.message });
    }
});

// GET /api/auth/verify - Verificar token
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({
        valid: true,
        user: {
            id: req.user.id,
            usuario: req.user.usuario,
            rol: req.user.rol
        }
    });
});

// ========== RUTAS DE USUARIOS (Solo Admin) ==========

// GET /api/usuarios - Obtener todos los usuarios (solo admin)
app.get('/api/usuarios', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT 
                id, 
                usuario, 
                rol, 
                activo,
                fecha_creacion,
                fecha_ultimo_acceso,
                creado_por
            FROM usuarios
            ORDER BY fecha_creacion DESC
        `);
        
        res.json(result.recordset);
    } catch (err) {
        console.error('Error al obtener usuarios:', err);
        res.status(500).json({ error: 'Error al obtener usuarios', details: err.message });
    }
});

// GET /api/usuarios/:id - Obtener un usuario por ID (solo admin)
app.get('/api/usuarios/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT 
                    id, 
                    usuario, 
                    rol, 
                    activo,
                    fecha_creacion,
                    fecha_ultimo_acceso,
                    creado_por
                FROM usuarios
                WHERE id = @id
            `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Error al obtener usuario:', err);
        res.status(500).json({ error: 'Error al obtener usuario', details: err.message });
    }
});

// POST /api/usuarios - Crear nuevo usuario (solo admin)
app.post('/api/usuarios', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { usuario, password, rol } = req.body;
        
        if (!usuario || !password || !rol) {
            return res.status(400).json({ error: 'Usuario, contraseña y rol requeridos' });
        }
        
        if (!['admin', 'gestor', 'visor'].includes(rol)) {
            return res.status(400).json({ error: 'Rol inválido. Debe ser: admin, gestor o visor' });
        }
        
        // Verificar que el usuario no exista
        const pool = await getPool();
        const checkResult = await pool.request()
            .input('usuario', sql.NVarChar(100), usuario)
            .query('SELECT id FROM usuarios WHERE usuario = @usuario');
        
        if (checkResult.recordset.length > 0) {
            return res.status(409).json({ error: 'El usuario ya existe' });
        }
        
        // Hash de contraseña
        const passwordHash = await bcrypt.hash(password, 10);
        
        // Insertar usuario
        const result = await pool.request()
            .input('usuario', sql.NVarChar(100), usuario)
            .input('password_hash', sql.NVarChar(255), passwordHash)
            .input('rol', sql.NVarChar(20), rol)
            .input('creado_por', sql.Int, req.user.id)
            .query(`
                INSERT INTO usuarios (usuario, password_hash, rol, creado_por)
                OUTPUT INSERTED.id
                VALUES (@usuario, @password_hash, @rol, @creado_por)
            `);
        
        const newId = result.recordset[0].id;
        res.status(201).json({ 
            id: newId, 
            message: 'Usuario creado correctamente',
            usuario: usuario,
            rol: rol
        });
    } catch (err) {
        console.error('Error al crear usuario:', err);
        res.status(500).json({ error: 'Error al crear usuario', details: err.message });
    }
});

// PUT /api/usuarios/:id - Actualizar usuario (solo admin)
app.put('/api/usuarios/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { usuario, password, rol, activo } = req.body;
        
        const pool = await getPool();
        
        // Verificar que el usuario existe
        const checkResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT id FROM usuarios WHERE id = @id');
        
        if (checkResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        // Construir query de actualización
        let updateFields = [];
        const request = pool.request().input('id', sql.Int, id);
        
        if (usuario !== undefined) {
            updateFields.push('usuario = @usuario');
            request.input('usuario', sql.NVarChar(100), usuario);
        }
        
        if (password !== undefined) {
            const passwordHash = await bcrypt.hash(password, 10);
            updateFields.push('password_hash = @password_hash');
            request.input('password_hash', sql.NVarChar(255), passwordHash);
        }
        
        if (rol !== undefined) {
            if (!['admin', 'gestor', 'visor'].includes(rol)) {
                return res.status(400).json({ error: 'Rol inválido' });
            }
            updateFields.push('rol = @rol');
            request.input('rol', sql.NVarChar(20), rol);
        }
        
        if (activo !== undefined) {
            updateFields.push('activo = @activo');
            request.input('activo', sql.Bit, activo ? 1 : 0);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }
        
        const query = `UPDATE usuarios SET ${updateFields.join(', ')} WHERE id = @id`;
        await request.query(query);
        
        res.json({ message: 'Usuario actualizado correctamente' });
    } catch (err) {
        console.error('Error al actualizar usuario:', err);
        res.status(500).json({ error: 'Error al actualizar usuario', details: err.message });
    }
});

// DELETE /api/usuarios/:id - Eliminar usuario (solo admin)
app.delete('/api/usuarios/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        
        // No permitir auto-eliminación
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
        }
        
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM usuarios WHERE id = @id');
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        res.json({ message: 'Usuario eliminado correctamente' });
    } catch (err) {
        console.error('Error al eliminar usuario:', err);
        res.status(500).json({ error: 'Error al eliminar usuario', details: err.message });
    }
});

// ========== RUTAS API (Protegidas) ==========

// GET /api/registros - Obtener todos los registros (todos los roles autenticados)
app.get('/api/registros', authenticateToken, async (req, res) => {
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

// POST /api/registros - Insertar nuevo registro (admin y gestor)
app.post('/api/registros', authenticateToken, requireRole('admin', 'gestor'), async (req, res) => {
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

// PUT /api/registros/:id - Actualizar registro (admin y gestor)
app.put('/api/registros/:id', authenticateToken, requireRole('admin', 'gestor'), async (req, res) => {
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

// DELETE /api/registros/:id - Eliminar registro (admin y gestor)
app.delete('/api/registros/:id', authenticateToken, requireRole('admin', 'gestor'), async (req, res) => {
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

