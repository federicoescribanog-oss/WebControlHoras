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
        if (!origin) {
            return callback(null, true);
        }
        
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
            console.log(`✅ CORS permitido (lista explícita): ${origin}`);
            return callback(null, true);
        }
        
        // Permitir cualquier dominio que termine en .web.core.windows.net (Blob Storage de Azure)
        if (origin.endsWith('.web.core.windows.net')) {
            console.log(`✅ CORS permitido (Blob Storage): ${origin}`);
            return callback(null, true);
        }
        
        // En desarrollo, permitir todos
        if (process.env.NODE_ENV !== 'production') {
            console.log(`✅ CORS permitido (desarrollo): ${origin}`);
            return callback(null, true);
        }
        
        // En producción, si hay ALLOWED_ORIGIN configurado, usarlo
        if (process.env.ALLOWED_ORIGIN && origin === process.env.ALLOWED_ORIGIN) {
            console.log(`✅ CORS permitido (variable de entorno): ${origin}`);
            return callback(null, true);
        }
        
        // Log para debug
        console.log(`❌ CORS rechazado: ${origin}`);
        console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
        console.log(`   ALLOWED_ORIGIN: ${process.env.ALLOWED_ORIGIN}`);
        
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
                SELECT u.id, u.usuario, u.password_hash, u.rol, r.nombre as rol_nombre, u.activo
                FROM usuarios u
                INNER JOIN roles r ON u.rol = r.id
                WHERE u.usuario = @usuario AND u.activo = 1
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
        
        // Generar token JWT (usar nombre del rol, no el ID)
        const token = jwt.sign(
            { 
                id: user.id, 
                usuario: user.usuario, 
                rol: user.rol_nombre 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        res.json({
            token,
            user: {
                id: user.id,
                usuario: user.usuario,
                rol: user.rol_nombre
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
                u.id, 
                u.usuario, 
                u.rol as rol_id,
                r.nombre as rol,
                u.activo,
                u.fecha_creacion,
                u.fecha_ultimo_acceso,
                u.creado_por
            FROM usuarios u
            INNER JOIN roles r ON u.rol = r.id
            ORDER BY u.fecha_creacion DESC
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
                    u.id, 
                    u.usuario, 
                    u.rol as rol_id,
                    r.nombre as rol,
                    u.activo,
                    u.fecha_creacion,
                    u.fecha_ultimo_acceso,
                    u.creado_por
                FROM usuarios u
                INNER JOIN roles r ON u.rol = r.id
                WHERE u.id = @id
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
        const { usuario, password, rol, rol_id } = req.body;
        
        if (!usuario || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
        }
        
        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(usuario)) {
            return res.status(400).json({ error: 'El usuario debe ser una dirección de correo electrónico válida' });
        }
        
        // Validar dominio @es.logicalis.com
        if (!usuario.endsWith('@es.logicalis.com')) {
            return res.status(400).json({ error: 'El usuario debe ser del dominio @es.logicalis.com' });
        }
        
        // Obtener rol_id si se envió nombre del rol (compatibilidad)
        let finalRolId = rol_id;
        if (rol && !rol_id) {
            const pool = await getPool();
            const rolResult = await pool.request()
                .input('nombre', sql.NVarChar(20), rol)
                .query('SELECT id FROM roles WHERE nombre = @nombre');
            if (rolResult.recordset.length > 0) {
                finalRolId = rolResult.recordset[0].id;
            } else {
                return res.status(400).json({ error: 'Rol inválido. Debe ser: admin, gestor o visor' });
            }
        }
        
        if (!finalRolId) {
            return res.status(400).json({ error: 'Rol requerido' });
        }
        
        // Verificar que el rol existe
        const pool = await getPool();
        const rolCheck = await pool.request()
            .input('rol_id', sql.Int, finalRolId)
            .query('SELECT id FROM roles WHERE id = @rol_id');
        
        if (rolCheck.recordset.length === 0) {
            return res.status(400).json({ error: 'Rol inválido' });
        }
        
        // Verificar que el usuario no exista
        const checkResult = await pool.request()
            .input('usuario', sql.NVarChar(100), usuario)
            .query('SELECT id FROM usuarios WHERE usuario = @usuario');
        
        if (checkResult.recordset.length > 0) {
            return res.status(409).json({ error: 'El usuario ya existe' });
        }
        
        // Hash de contraseña
        const passwordHash = await bcrypt.hash(password, 10);
        
        // Obtener nombre del rol para la respuesta
        const rolNameResult = await pool.request()
            .input('rol_id', sql.Int, finalRolId)
            .query('SELECT nombre FROM roles WHERE id = @rol_id');
        const rolNombre = rolNameResult.recordset[0].nombre;
        
        // Insertar usuario
        const result = await pool.request()
            .input('usuario', sql.NVarChar(100), usuario)
            .input('password_hash', sql.NVarChar(255), passwordHash)
            .input('rol', sql.Int, finalRolId)
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
            rol: rolNombre,
            rol_id: finalRolId
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
        const { usuario, password, rol, rol_id, activo } = req.body;
        
        const pool = await getPool();
        
        // Verificar que el usuario existe
        const checkResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT id FROM usuarios WHERE id = @id');
        
        if (checkResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        // Obtener rol_id si se envió nombre del rol (compatibilidad)
        let finalRolId = rol_id;
        if (rol && !rol_id) {
            const rolResult = await pool.request()
                .input('nombre', sql.NVarChar(20), rol)
                .query('SELECT id FROM roles WHERE nombre = @nombre');
            if (rolResult.recordset.length > 0) {
                finalRolId = rolResult.recordset[0].id;
            } else {
                return res.status(400).json({ error: 'Rol inválido. Debe ser: admin, gestor o visor' });
            }
        }
        
        if (finalRolId) {
            // Verificar que el rol existe
            const rolCheck = await pool.request()
                .input('rol_id', sql.Int, finalRolId)
                .query('SELECT id FROM roles WHERE id = @rol_id');
            
            if (rolCheck.recordset.length === 0) {
                return res.status(400).json({ error: 'Rol inválido' });
            }
        }
        
        // Construir query de actualización
        let updateFields = [];
        const request = pool.request().input('id', sql.Int, id);
        
        if (usuario !== undefined) {
            // Validar formato de email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(usuario)) {
                return res.status(400).json({ error: 'El usuario debe ser una dirección de correo electrónico válida' });
            }
            
            // Validar dominio @es.logicalis.com
            if (!usuario.endsWith('@es.logicalis.com')) {
                return res.status(400).json({ error: 'El usuario debe ser del dominio @es.logicalis.com' });
            }
            
            // Verificar que el nuevo usuario no exista (si es diferente)
            const existingUser = await pool.request()
                .input('id', sql.Int, id)
                .query('SELECT usuario FROM usuarios WHERE id = @id');
            
            if (existingUser.recordset.length > 0 && existingUser.recordset[0].usuario !== usuario) {
                const duplicateCheck = await pool.request()
                    .input('usuario', sql.NVarChar(100), usuario)
                    .query('SELECT id FROM usuarios WHERE usuario = @usuario');
                
                if (duplicateCheck.recordset.length > 0) {
                    return res.status(409).json({ error: 'El usuario ya existe' });
                }
            }
            
            updateFields.push('usuario = @usuario');
            request.input('usuario', sql.NVarChar(100), usuario);
        }
        
        if (password !== undefined) {
            const passwordHash = await bcrypt.hash(password, 10);
            updateFields.push('password_hash = @password_hash');
            request.input('password_hash', sql.NVarChar(255), passwordHash);
        }
        
        if (finalRolId !== undefined) {
            updateFields.push('rol = @rol');
            request.input('rol', sql.Int, finalRolId);
        }
        
        if (activo !== undefined) {
            updateFields.push('activo = @activo');
            request.input('activo', sql.Bit, activo ? 1 : 0);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }
        
        const query = `UPDATE usuarios SET ${updateFields.join(', ')} WHERE id = @id`;
        const result = await request.query(query);
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        // Obtener datos actualizados para la respuesta
        let rolNombre = null;
        if (finalRolId) {
            const rolNameResult = await pool.request()
                .input('rol_id', sql.Int, finalRolId)
                .query('SELECT nombre FROM roles WHERE id = @rol_id');
            if (rolNameResult.recordset.length > 0) {
                rolNombre = rolNameResult.recordset[0].nombre;
            }
        }
        
        res.json({ 
            message: 'Usuario actualizado correctamente',
            rol: rolNombre || undefined,
            rol_id: finalRolId || undefined
        });
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

// ========== RUTAS DE HEALTH CHECK ==========

// GET /health - Health check (sin autenticación)
app.get('/health', async (req, res) => {
    try {
        // Verificar conexión a la base de datos
        const pool = await getPool();
        await pool.request().query('SELECT 1 as test');
        
        res.json({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            database: 'connected'
        });
    } catch (err) {
        res.status(503).json({ 
            status: 'error', 
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: err.message 
        });
    }
});

// GET / - Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'API Backend - Control de Horas',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            login: '/api/auth/login',
            registros: '/api/registros'
        }
    });
});

// ========== RUTAS API (Protegidas) ==========

// GET /api/registros - Obtener todos los registros (todos los roles autenticados)
app.get('/api/registros', authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT 
                c.id,
                p.nombre as phase,
                t.nombre as task,
                c.milestone,
                FORMAT(c.[start], 'dd/MM/yyyy') as [start],
                FORMAT(c.[end], 'dd/MM/yyyy') as [end],
                c.completion,
                c.dependencies,
                per.nombre as assignee,
                c.[time],
                c.phase_id,
                c.task_id,
                c.assignee_id
            FROM controlhorario c
            LEFT JOIN proyectos p ON c.phase_id = p.id
            LEFT JOIN tareas t ON c.task_id = t.id
            LEFT JOIN personas per ON c.assignee_id = per.id
            ORDER BY c.id DESC
        `);
        
        // Convertir a formato JSON compatible
        const registros = result.recordset.map(row => ({
            id: row.id,
            phase: row.phase || null,
            task: row.task || null,
            milestone: row.milestone,
            start: row.start || null,
            end: row.end || null,
            completion: row.completion || 0,
            dependencies: row.dependencies,
            assignee: row.assignee || null,
            time: row.time || null,
            phase_id: row.phase_id || null,
            task_id: row.task_id || null,
            assignee_id: row.assignee_id || null
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
        const { phase, phase_id, task, task_id, milestone, start, end, completion, dependencies, assignee, assignee_id, time } = req.body;
        
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
        
        // Obtener IDs si se enviaron nombres (compatibilidad hacia atrás)
        let finalPhaseId = phase_id;
        let finalTaskId = task_id;
        let finalAssigneeId = assignee_id;
        
        if (phase && !phase_id) {
            const phaseResult = await pool.request()
                .input('nombre', sql.NVarChar(255), phase)
                .query('SELECT id FROM proyectos WHERE nombre = @nombre');
            if (phaseResult.recordset.length > 0) {
                finalPhaseId = phaseResult.recordset[0].id;
            }
        }
        
        if (task && !task_id) {
            const taskResult = await pool.request()
                .input('nombre', sql.NVarChar(255), task)
                .query('SELECT id FROM tareas WHERE nombre = @nombre');
            if (taskResult.recordset.length > 0) {
                finalTaskId = taskResult.recordset[0].id;
            }
        }
        
        if (assignee && !assignee_id) {
            const assigneeResult = await pool.request()
                .input('nombre', sql.NVarChar(255), assignee)
                .query('SELECT id FROM personas WHERE nombre = @nombre');
            if (assigneeResult.recordset.length > 0) {
                finalAssigneeId = assigneeResult.recordset[0].id;
            }
        }
        
        const result = await pool.request()
            .input('phase_id', sql.Int, finalPhaseId)
            .input('task_id', sql.Int, finalTaskId)
            .input('milestone', sql.NVarChar(255), milestone)
            .input('start', sql.Date, startDate)
            .input('end', sql.Date, endDate)
            .input('completion', sql.Int, completion || 0)
            .input('dependencies', sql.NVarChar(255), dependencies)
            .input('assignee_id', sql.Int, finalAssigneeId)
            .input('time', sql.Int, time)
            .query(`
                INSERT INTO controlhorario (phase_id, task_id, milestone, [start], [end], completion, dependencies, assignee_id, [time])
                OUTPUT INSERTED.id
                VALUES (@phase_id, @task_id, @milestone, @start, @end, @completion, @dependencies, @assignee_id, @time)
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
        const { phase, phase_id, task, task_id, milestone, start, end, completion, dependencies, assignee, assignee_id, time } = req.body;
        
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
        
        // Obtener IDs si se enviaron nombres (compatibilidad hacia atrás)
        let finalPhaseId = phase_id;
        let finalTaskId = task_id;
        let finalAssigneeId = assignee_id;
        
        if (phase !== undefined && !phase_id) {
            if (phase) {
                const phaseResult = await pool.request()
                    .input('nombre', sql.NVarChar(255), phase)
                    .query('SELECT id FROM proyectos WHERE nombre = @nombre');
                if (phaseResult.recordset.length > 0) {
                    finalPhaseId = phaseResult.recordset[0].id;
                }
            } else {
                finalPhaseId = null;
            }
        }
        
        if (task !== undefined && !task_id) {
            if (task) {
                const taskResult = await pool.request()
                    .input('nombre', sql.NVarChar(255), task)
                    .query('SELECT id FROM tareas WHERE nombre = @nombre');
                if (taskResult.recordset.length > 0) {
                    finalTaskId = taskResult.recordset[0].id;
                }
            } else {
                finalTaskId = null;
            }
        }
        
        if (assignee !== undefined && !assignee_id) {
            if (assignee) {
                const assigneeResult = await pool.request()
                    .input('nombre', sql.NVarChar(255), assignee)
                    .query('SELECT id FROM personas WHERE nombre = @nombre');
                if (assigneeResult.recordset.length > 0) {
                    finalAssigneeId = assigneeResult.recordset[0].id;
                }
            } else {
                finalAssigneeId = null;
            }
        }
        
        // Construir query dinámico
        let updateFields = [];
        const request = pool.request().input('id', sql.Int, id);
        
        if (finalPhaseId !== undefined) {
            updateFields.push('phase_id = @phase_id');
            request.input('phase_id', sql.Int, finalPhaseId);
        }
        
        if (finalTaskId !== undefined) {
            updateFields.push('task_id = @task_id');
            request.input('task_id', sql.Int, finalTaskId);
        }
        
        if (milestone !== undefined) {
            updateFields.push('milestone = @milestone');
            request.input('milestone', sql.NVarChar(255), milestone);
        }
        
        if (startDate !== undefined) {
            updateFields.push('[start] = @start');
            request.input('start', sql.Date, startDate);
        }
        
        if (endDate !== undefined) {
            updateFields.push('[end] = @end');
            request.input('end', sql.Date, endDate);
        }
        
        if (completion !== undefined) {
            updateFields.push('completion = @completion');
            request.input('completion', sql.Int, completion || 0);
        }
        
        if (dependencies !== undefined) {
            updateFields.push('dependencies = @dependencies');
            request.input('dependencies', sql.NVarChar(255), dependencies);
        }
        
        if (finalAssigneeId !== undefined) {
            updateFields.push('assignee_id = @assignee_id');
            request.input('assignee_id', sql.Int, finalAssigneeId);
        }
        
        if (time !== undefined) {
            updateFields.push('[time] = @time');
            request.input('time', sql.Int, time);
        }
        
        updateFields.push('fecha_actualizacion = GETDATE()');
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }
        
        const query = `UPDATE controlhorario SET ${updateFields.join(', ')} WHERE id = @id`;
        const result = await request.query(query);
        
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

// ========== RUTAS PARA DIMENSIONES (MAESTROS) ==========

// GET /api/personas - Obtener todas las personas
app.get('/api/personas', authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT id, nombre, email, activo, fecha_creacion
            FROM personas
            WHERE activo = 1
            ORDER BY nombre ASC
        `);
        
        res.json(result.recordset);
    } catch (err) {
        console.error('Error al obtener personas:', err);
        res.status(500).json({ error: 'Error al obtener personas', details: err.message });
    }
});

// POST /api/personas - Crear nueva persona (admin y gestor)
app.post('/api/personas', authenticateToken, requireRole('admin', 'gestor'), async (req, res) => {
    try {
        const { nombre, email } = req.body;
        
        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }
        
        const pool = await getPool();
        
        // Verificar si ya existe (case-insensitive)
        const checkResult = await pool.request()
            .input('nombre', sql.NVarChar(255), nombre.trim())
            .query('SELECT id, nombre FROM personas WHERE LOWER(nombre) = LOWER(@nombre)');
        
        if (checkResult.recordset.length > 0) {
            return res.status(409).json({ 
                error: 'Esta persona ya existe',
                id: checkResult.recordset[0].id,
                nombre: checkResult.recordset[0].nombre
            });
        }
        
        // Insertar nueva persona
        const result = await pool.request()
            .input('nombre', sql.NVarChar(255), nombre.trim())
            .input('email', sql.NVarChar(255), email ? email.trim() : null)
            .query(`
                INSERT INTO personas (nombre, email)
                OUTPUT INSERTED.id, INSERTED.nombre, INSERTED.email
                VALUES (@nombre, @email)
            `);
        
        const newPerson = result.recordset[0];
        res.status(201).json(newPerson);
    } catch (err) {
        console.error('Error al crear persona:', err);
        res.status(500).json({ error: 'Error al crear persona', details: err.message });
    }
});

// GET /api/proyectos - Obtener todos los proyectos
app.get('/api/proyectos', authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT id, nombre, descripcion, activo, fecha_creacion
            FROM proyectos
            WHERE activo = 1
            ORDER BY nombre ASC
        `);
        
        res.json(result.recordset);
    } catch (err) {
        console.error('Error al obtener proyectos:', err);
        res.status(500).json({ error: 'Error al obtener proyectos', details: err.message });
    }
});

// POST /api/proyectos - Crear nuevo proyecto (admin y gestor)
app.post('/api/proyectos', authenticateToken, requireRole('admin', 'gestor'), async (req, res) => {
    try {
        const { nombre, descripcion } = req.body;
        
        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }
        
        const pool = await getPool();
        
        // Verificar si ya existe (case-insensitive)
        const checkResult = await pool.request()
            .input('nombre', sql.NVarChar(255), nombre.trim())
            .query('SELECT id, nombre FROM proyectos WHERE LOWER(nombre) = LOWER(@nombre)');
        
        if (checkResult.recordset.length > 0) {
            return res.status(409).json({ 
                error: 'Este proyecto ya existe',
                id: checkResult.recordset[0].id,
                nombre: checkResult.recordset[0].nombre
            });
        }
        
        // Insertar nuevo proyecto
        const result = await pool.request()
            .input('nombre', sql.NVarChar(255), nombre.trim())
            .input('descripcion', sql.NVarChar(500), descripcion ? descripcion.trim() : null)
            .query(`
                INSERT INTO proyectos (nombre, descripcion)
                OUTPUT INSERTED.id, INSERTED.nombre, INSERTED.descripcion
                VALUES (@nombre, @descripcion)
            `);
        
        const newProject = result.recordset[0];
        res.status(201).json(newProject);
    } catch (err) {
        console.error('Error al crear proyecto:', err);
        res.status(500).json({ error: 'Error al crear proyecto', details: err.message });
    }
});

// GET /api/tareas - Obtener todas las tareas
app.get('/api/tareas', authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT id, nombre, descripcion, activo, fecha_creacion
            FROM tareas
            WHERE activo = 1
            ORDER BY nombre ASC
        `);
        
        res.json(result.recordset);
    } catch (err) {
        console.error('Error al obtener tareas:', err);
        res.status(500).json({ error: 'Error al obtener tareas', details: err.message });
    }
});

// POST /api/tareas - Crear nueva tarea (admin y gestor)
app.post('/api/tareas', authenticateToken, requireRole('admin', 'gestor'), async (req, res) => {
    try {
        const { nombre, descripcion } = req.body;
        
        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }
        
        const pool = await getPool();
        
        // Verificar si ya existe (case-insensitive)
        const checkResult = await pool.request()
            .input('nombre', sql.NVarChar(255), nombre.trim())
            .query('SELECT id, nombre FROM tareas WHERE LOWER(nombre) = LOWER(@nombre)');
        
        if (checkResult.recordset.length > 0) {
            return res.status(409).json({ 
                error: 'Esta tarea ya existe',
                id: checkResult.recordset[0].id,
                nombre: checkResult.recordset[0].nombre
            });
        }
        
        // Insertar nueva tarea
        const result = await pool.request()
            .input('nombre', sql.NVarChar(255), nombre.trim())
            .input('descripcion', sql.NVarChar(500), descripcion ? descripcion.trim() : null)
            .query(`
                INSERT INTO tareas (nombre, descripcion)
                OUTPUT INSERTED.id, INSERTED.nombre, INSERTED.descripcion
                VALUES (@nombre, @descripcion)
            `);
        
        const newTask = result.recordset[0];
        res.status(201).json(newTask);
    } catch (err) {
        console.error('Error al crear tarea:', err);
        res.status(500).json({ error: 'Error al crear tarea', details: err.message });
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

