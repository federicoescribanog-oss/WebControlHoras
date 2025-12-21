const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { SecretClient } = require('@azure/keyvault-secrets');
const { DefaultAzureCredential } = require('@azure/identity');
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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Access-Control-Request-Method', 'Access-Control-Request-Headers'],
    exposedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200, // Algunos navegadores antiguos requieren esto
    preflightContinue: false // Responder inmediatamente a OPTIONS
};

app.use(cors(corsOptions));
app.use(express.json());

// Manejo explícito de peticiones OPTIONS (preflight) para asegurar CORS
app.options('*', cors(corsOptions));

// No servir archivos estáticos si la API está separada del frontend
// app.use(express.static('.')); // Comentado porque el HTML está en Blob Storage

// ========== CONFIGURACIÓN DE KEY VAULT ==========
let keyVaultClient = null;
let secretsCache = {}; // Cache para evitar múltiples llamadas

async function initializeKeyVault() {
    const keyVaultName = process.env.KEY_VAULT_NAME;
    
    // Si no hay KEY_VAULT_NAME, usar variables de entorno tradicionales (fallback)
    if (!keyVaultName) {
        console.log('⚠️ KEY_VAULT_NAME no configurado, usando variables de entorno tradicionales');
        return null;
    }
    
    try {
        const keyVaultUrl = `https://${keyVaultName}.vault.azure.net`;
        const credential = new DefaultAzureCredential();
        keyVaultClient = new SecretClient(keyVaultUrl, credential);
        console.log(`✅ Key Vault cliente inicializado: ${keyVaultName}`);
        return keyVaultClient;
    } catch (err) {
        console.error('❌ Error al inicializar Key Vault:', err.message);
        console.error('⚠️ Fallback a variables de entorno tradicionales');
        return null;
    }
}

async function getSecret(secretName) {
    // Si hay cache y no es muy antiguo (menos de 5 minutos), usar cache
    if (secretsCache[secretName] && Date.now() - secretsCache[secretName].timestamp < 5 * 60 * 1000) {
        return secretsCache[secretName].value;
    }
    
    // Si no hay Key Vault configurado, usar variables de entorno
    if (!keyVaultClient) {
        const envName = secretName.replace(/-/g, '_').toUpperCase();
        return process.env[envName];
    }
    
    try {
        const secret = await keyVaultClient.getSecret(secretName);
        // Guardar en cache
        secretsCache[secretName] = {
            value: secret.value,
            timestamp: Date.now()
        };
        return secret.value;
    } catch (err) {
        console.error(`❌ Error al obtener secreto ${secretName}:`, err.message);
        // Fallback a variable de entorno
        const envName = secretName.replace(/-/g, '_').toUpperCase();
        return process.env[envName];
    }
}

// ========== CONFIGURACIÓN DE EMAIL ==========
let emailConfig = {
    host: null,
    port: null,
    secure: null,
    user: null,
    password: null,
    from: null
};
let emailTransporter = null;

// ========== CONFIGURACIÓN DE AUTENTICACIÓN ==========
let JWT_SECRET = null;
const JWT_EXPIRES_IN = '24h'; // Token válido por 24 horas

async function loadSecrets() {
    try {
        // Inicializar Key Vault
        await initializeKeyVault();
        
        // Cargar secretos
        JWT_SECRET = await getSecret('JWT-SECRET');
        
        // Cargar configuración de email (opcional, no crítico)
        emailConfig.host = await getSecret('EMAILHOST') || process.env.EMAIL_HOST || 'smtp.office365.com';
        emailConfig.port = parseInt(await getSecret('EMAILPORT') || process.env.EMAIL_PORT || '587');
        emailConfig.secure = (await getSecret('EMAIL-SECURE') || process.env.EMAIL_SECURE || 'false') === 'true';
        emailConfig.user = await getSecret('EMAILUSER') || process.env.EMAIL_USER;
        emailConfig.password = await getSecret('EMAILPASSWORD') || process.env.EMAIL_PASSWORD;
        emailConfig.from = await getSecret('EMAIL-FROM') || process.env.EMAIL_FROM || emailConfig.user;
        
        // Validar que JWT_SECRET esté configurado
        if (!JWT_SECRET) {
            console.error('❌ ERROR: JWT_SECRET no encontrado en Key Vault ni en variables de entorno');
            console.error('Configura JWT-SECRET en Key Vault o JWT_SECRET en App Service');
            process.exit(1);
        }
        
        // Configurar transporter de email si hay credenciales
        if (emailConfig.user && emailConfig.password) {
            emailTransporter = nodemailer.createTransport({
                host: emailConfig.host,
                port: emailConfig.port,
                secure: emailConfig.secure,
                auth: {
                    user: emailConfig.user,
                    pass: emailConfig.password
                }
            });
            console.log('✅ Configuración de email cargada');
        } else {
            console.log('⚠️ Configuración de email no disponible (EMAIL-USER y EMAIL-PASSWORD no configurados)');
        }
        
        console.log('✅ Secretos cargados desde Key Vault');
    } catch (err) {
        console.error('❌ Error al cargar secretos:', err.message);
        // Intentar fallback a variables de entorno
        JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
            console.error('❌ ERROR: No se pudo cargar JWT_SECRET');
            process.exit(1);
        }
        
        // Fallback para email
        emailConfig.host = process.env.EMAIL_HOST || 'smtp.office365.com';
        emailConfig.port = parseInt(process.env.EMAIL_PORT || '587');
        emailConfig.secure = (process.env.EMAIL_SECURE || 'false') === 'true';
        emailConfig.user = process.env.EMAIL_USER;
        emailConfig.password = process.env.EMAIL_PASSWORD;
        emailConfig.from = process.env.EMAIL_FROM || emailConfig.user;
        
        if (emailConfig.user && emailConfig.password) {
            emailTransporter = nodemailer.createTransport({
                host: emailConfig.host,
                port: emailConfig.port,
                secure: emailConfig.secure,
                auth: {
                    user: emailConfig.user,
                    pass: emailConfig.password
                }
            });
            console.log('✅ Configuración de email cargada desde variables de entorno');
        }
        
        console.log('⚠️ Usando variables de entorno como fallback');
    }
}

// ========== FUNCIÓN PARA ENVIAR CORREO DE BIENVENIDA ==========
async function sendWelcomeEmail(email, password, rolNombre) {
    // Si no hay configuración de email, no hacer nada
    if (!emailTransporter || !emailConfig.user) {
        console.log('⚠️ No se puede enviar correo: configuración de email no disponible');
        return;
    }
    
    const webUrl = process.env.WEB_URL || 'https://webcontrolhoras.z6.web.core.windows.net';
    
    // Crear contenido del correo
    const mailOptions = {
        from: emailConfig.from,
        to: email,
        subject: 'Bienvenido a Control de Horas - Logicalis',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #0a0e17; color: #e8eaed; padding: 20px; text-align: center; }
                    .content { background-color: #f9f9f9; padding: 20px; }
                    .info-box { background-color: #fff; border-left: 4px solid #00d4aa; padding: 15px; margin: 15px 0; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Control de Horas - Logicalis</h1>
                    </div>
                    <div class="content">
                        <p>Buenos días <strong>${email}</strong>,</p>
                        <p>Le enviamos este correo para notificarle que le hemos dado de alta en la web de control de horas de Logicalis.</p>
                        
                        <div class="info-box">
                            <p><strong>URL de acceso:</strong> <a href="${webUrl}">${webUrl}</a></p>
                            <p><strong>Usuario:</strong> ${email}</p>
                            <p><strong>Contraseña:</strong> ${password}</p>
                            <p><strong>Rol:</strong> ${rolNombre}</p>
                        </div>
                        
                        <p>Si tiene algún problema, se puede poner en contacto con <strong>Federico Escribano</strong>.</p>
                        <p>Gracias.</p>
                    </div>
                    <div class="footer">
                        <p>Este es un correo automático, por favor no responda.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `
Buenos días ${email},

Le enviamos este correo para notificarle que le hemos dado de alta en la web de control de horas de Logicalis.

URL de acceso: ${webUrl}
Usuario: ${email}
Contraseña: ${password}
Rol: ${rolNombre}

Si tiene algún problema, se puede poner en contacto con Federico Escribano.

Gracias.
        `
    };
    
    try {
        const info = await emailTransporter.sendMail(mailOptions);
        console.log(`✅ Correo de bienvenida enviado a ${email}:`, info.messageId);
    } catch (error) {
        console.error(`❌ Error al enviar correo a ${email}:`, error.message);
        throw error;
    }
}

// Middleware para verificar token JWT
function authenticateToken(req, res, next) {
    // Verificar que JWT_SECRET esté configurado
    if (!JWT_SECRET) {
        console.error('❌ ERROR: JWT_SECRET no está configurado');
        return res.status(500).json({ error: 'Error de configuración del servidor' });
    }
    
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(401).json({ error: 'Token de acceso requerido' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Error al verificar token:', err.message);
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

// Configuración de SQL Server (se cargará desde Key Vault)
let sqlConfig = {
    user: null,
    password: null,
    server: null,
    database: null,
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

async function loadDatabaseConfig() {
    try {
        sqlConfig.user = await getSecret('DB-USER');
        sqlConfig.password = await getSecret('DB-PASSWORD');
        sqlConfig.server = await getSecret('DB-SERVER');
        sqlConfig.database = await getSecret('DB-NAME');
        
        // Validar configuración de base de datos
        if (!sqlConfig.user || !sqlConfig.password || !sqlConfig.server || !sqlConfig.database) {
            console.error('❌ ERROR: Variables de base de datos no configuradas');
            console.error('Configura estos secretos en Key Vault o variables de entorno:');
            console.error('   DB-USER:', sqlConfig.user ? '✓' : '✗ FALTA');
            console.error('   DB-PASSWORD:', sqlConfig.password ? '✓' : '✗ FALTA');
            console.error('   DB-SERVER:', sqlConfig.server ? '✓' : '✗ FALTA');
            console.error('   DB-NAME:', sqlConfig.database ? '✓' : '✗ FALTA');
            process.exit(1);
        }
        
        console.log('✅ Configuración de base de datos cargada');
    } catch (err) {
        console.error('❌ Error al cargar configuración de base de datos:', err.message);
        process.exit(1);
    }
}

// Pool de conexiones
let pool = null;
let poolInitializing = false;

async function getPool() {
    if (pool && pool.connected) {
        return pool;
    }
    
    // Si ya se está inicializando, esperar
    if (poolInitializing) {
        // Esperar hasta 10 segundos
        const maxWait = 10000;
        const start = Date.now();
        while (poolInitializing && (Date.now() - start) < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (pool && pool.connected) {
            return pool;
        }
    }
    
    // Inicializar pool
    poolInitializing = true;
    try {
        pool = await sql.connect(sqlConfig);
        console.log('✅ Conectado a SQL Server');
        poolInitializing = false;
        return pool;
    } catch (err) {
        poolInitializing = false;
        console.error('❌ Error de conexión a SQL Server:', err);
        throw err;
    }
}

// Inicializar pool en background (no bloquea el inicio del servidor)
// Esto mejora el tiempo de respuesta del primer request
setTimeout(async () => {
    try {
        await getPool();
        console.log('✅ Pool de conexiones inicializado en background');
    } catch (err) {
        console.error('⚠️  No se pudo inicializar el pool en background, se intentará en el primer request');
    }
}, 100); // Esperar 100ms para que el servidor termine de iniciar

// ========== RUTAS DE AUTENTICACIÓN ==========

// POST /api/auth/login - Iniciar sesión
app.post('/api/auth/login', async (req, res) => {
    try {
        const { usuario, password } = req.body;
        
        if (!usuario || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
        }
        
        const pool = await getPool();
        
        // La columna en usuarios se llama rol_id (INT, FK a roles.id)
        const result = await pool.request()
            .input('usuario', sql.NVarChar(100), usuario)
            .query(`
                SELECT u.id, u.usuario, u.password_hash, u.rol_id, r.nombre as rol_nombre, u.activo, u.fecha_ultimo_acceso
                FROM usuarios u
                INNER JOIN roles r ON u.rol_id = r.id
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
        
        // Verificar si es el primer login (fecha_ultimo_acceso es NULL)
        const isFirstLogin = user.fecha_ultimo_acceso === null;
        
        // Si es primer login, NO actualizar fecha_ultimo_acceso ni generar token
        // El usuario debe cambiar la contraseña primero
        if (isFirstLogin) {
            return res.status(200).json({
                mustChangePassword: true,
                message: 'Debes cambiar tu contraseña antes de acceder',
                user: {
                    id: user.id,
                    usuario: user.usuario,
                    rol: user.rol_nombre
                }
            });
        }
        
        // Si no es primer login, actualizar último acceso y generar token
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
            mustChangePassword: false,
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

// POST /api/auth/reset-password - Restablecer contraseña
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { usuario } = req.body;

        if (!usuario) {
            return res.status(400).json({ error: 'Usuario requerido' });
        }

        // Validar que sea un email del dominio correcto
        if (!usuario.endsWith('@es.logicalis.com')) {
            return res.status(400).json({ error: 'El usuario debe ser un email del dominio @es.logicalis.com' });
        }

        const pool = await getPool();
        const request = pool.request();

        // Buscar usuario
        const result = await request
            .input('usuario', sql.NVarChar(255), usuario)
            .query(`
                SELECT u.id, u.usuario, u.rol_id, r.nombre as rol_nombre
                FROM usuarios u
                LEFT JOIN roles r ON u.rol_id = r.id
                WHERE u.usuario = @usuario AND u.activo = 1
            `);

        if (result.recordset.length === 0) {
            // Por seguridad, no revelar si el usuario existe o no
            return res.json({ 
                message: 'Si el usuario existe, se ha enviado una nueva contraseña a tu email' 
            });
        }

        // Generar nueva contraseña
        const newPassword = generateSecurePassword();
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Actualizar contraseña
        await request
            .input('usuario', sql.NVarChar(255), usuario)
            .input('password_hash', sql.NVarChar(255), passwordHash)
            .query(`
                UPDATE usuarios 
                SET password_hash = @password_hash
                WHERE usuario = @usuario
            `);

        // TODO: Aquí deberías enviar la contraseña por email
        // Por ahora, la devolvemos en la respuesta (solo para desarrollo/testing)
        // En producción, esto debería enviarse por email
        console.log(`⚠️ NUEVA CONTRASEÑA para ${usuario}: ${newPassword}`);
        console.log('⚠️ IMPORTANTE: En producción, esto debe enviarse por email, no mostrarse en logs');

        res.json({ 
            message: 'Se ha generado una nueva contraseña. Por favor, revisa tu email.',
            // En producción, eliminar esta línea:
            password: newPassword // Solo para desarrollo/testing
        });

    } catch (err) {
        console.error('Error al restablecer contraseña:', err);
        res.status(500).json({ error: 'Error al restablecer contraseña', details: err.message });
    }
});

// Función para validar contraseña
function validatePassword(password) {
    if (password.length < 10) {
        return { valid: false, message: 'La contraseña debe tener al menos 10 caracteres' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'La contraseña debe contener al menos una mayúscula' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'La contraseña debe contener al menos un número' };
    }
    if (!/[!@#$%^&*]/.test(password)) {
        return { valid: false, message: 'La contraseña debe contener al menos un carácter especial (!@#$%^&*)' };
    }
    return { valid: true };
}

// Función para generar contraseña segura
function generateSecurePassword() {
    const length = 12;
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    const all = uppercase + lowercase + numbers + special;
    
    let password = '';
    // Asegurar al menos un carácter de cada tipo
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    
    // Completar hasta la longitud deseada
    for (let i = password.length; i < length; i++) {
        password += all[Math.floor(Math.random() * all.length)];
    }
    
    // Mezclar la contraseña
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

// POST /api/auth/change-password-first-login - Cambiar contraseña en primer login (sin autenticación)
app.post('/api/auth/change-password-first-login', async (req, res) => {
    try {
        const { usuario, currentPassword, newPassword } = req.body;

        if (!usuario || !currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Usuario, contraseña actual y nueva contraseña requeridos' });
        }

        // Validar nueva contraseña
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        const pool = await getPool();
        
        // Buscar usuario y verificar que es primer login
        const userResult = await pool.request()
            .input('usuario', sql.NVarChar(100), usuario)
            .query(`
                SELECT u.id, u.usuario, u.password_hash, u.rol_id, r.nombre as rol_nombre, u.fecha_ultimo_acceso
                FROM usuarios u
                INNER JOIN roles r ON u.rol_id = r.id
                WHERE u.usuario = @usuario AND u.activo = 1
            `);

        if (!userResult || !userResult.recordset || userResult.recordset.length === 0) {
            return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
        }

        const user = userResult.recordset[0];

        // Verificar que sea primer login (fecha_ultimo_acceso es NULL)
        if (user.fecha_ultimo_acceso !== null) {
            return res.status(403).json({ error: 'Esta operación solo está disponible para usuarios en su primer inicio de sesión' });
        }

        // Verificar contraseña actual
        const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Contraseña actual incorrecta' });
        }

        // Hash de nueva contraseña
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        // Actualizar contraseña y fecha_ultimo_acceso (marcando que ya no es primer login)
        await pool.request()
            .input('usuario', sql.NVarChar(100), usuario)
            .input('password_hash', sql.NVarChar(255), newPasswordHash)
            .query('UPDATE usuarios SET password_hash = @password_hash, fecha_ultimo_acceso = GETDATE() WHERE usuario = @usuario');

        console.log('✅ Contraseña cambiada en primer login para usuario:', usuario);

        // Generar token para que pueda acceder
        const token = jwt.sign(
            { 
                id: user.id, 
                usuario: user.usuario, 
                rol: user.rol_nombre 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return res.json({ 
            message: 'Contraseña cambiada correctamente. Ya puedes acceder a la aplicación.',
            token: token,
            firstLoginCompleted: true,
            user: {
                id: user.id,
                usuario: user.usuario,
                rol: user.rol_nombre
            }
        });
    } catch (err) {
        console.error('❌ Error al cambiar contraseña en primer login:', err);
        res.status(500).json({ error: 'Error al cambiar contraseña', details: err.message });
    }
});

// POST /api/auth/change-password - Cambiar contraseña del usuario actual
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
    try {
        console.log('🔐 Cambio de contraseña solicitado para usuario ID:', req.user.id);
        
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Contraseña actual y nueva contraseña requeridas' });
        }

        // Validar nueva contraseña
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        let pool;
        try {
            pool = await getPool();
        } catch (err) {
            console.error('❌ Error al obtener pool de conexiones:', err);
            return res.status(500).json({ error: 'Error de conexión a la base de datos', details: err.message });
        }

        if (!pool) {
            console.error('❌ Error: Pool de conexiones es null');
            return res.status(500).json({ error: 'Error de conexión a la base de datos', details: 'Pool no inicializado' });
        }

        // Obtener usuario actual con su contraseña
        let userResult;
        try {
            const selectRequest = pool.request();
            userResult = await selectRequest
                .input('id', sql.Int, req.user.id)
                .query('SELECT password_hash FROM usuarios WHERE id = @id AND activo = 1');
        } catch (err) {
            console.error('❌ Error al consultar usuario:', err);
            return res.status(500).json({ error: 'Error al consultar usuario', details: err.message });
        }

        if (!userResult || !userResult.recordset || userResult.recordset.length === 0) {
            console.error('❌ Usuario no encontrado o inactivo:', req.user.id);
            return res.status(404).json({ error: 'Usuario no encontrado o inactivo' });
        }

        // Verificar contraseña actual
        const passwordHash = userResult.recordset[0].password_hash;
        if (!passwordHash) {
            console.error('❌ Usuario sin password_hash:', req.user.id);
            return res.status(500).json({ error: 'Error: Usuario sin contraseña configurada' });
        }

        let passwordMatch;
        try {
            passwordMatch = await bcrypt.compare(currentPassword, passwordHash);
        } catch (err) {
            console.error('❌ Error al comparar contraseña:', err);
            return res.status(500).json({ error: 'Error al verificar contraseña', details: err.message });
        }

        if (!passwordMatch) {
            console.log('❌ Contraseña actual incorrecta para usuario:', req.user.id);
            return res.status(401).json({ error: 'Contraseña actual incorrecta' });
        }

        // Hash de nueva contraseña
        let newPasswordHash;
        try {
            newPasswordHash = await bcrypt.hash(newPassword, 10);
        } catch (err) {
            console.error('❌ Error al hashear nueva contraseña:', err);
            return res.status(500).json({ error: 'Error al procesar nueva contraseña', details: err.message });
        }

        // Verificar si es primer login (fecha_ultimo_acceso es NULL)
        const checkFirstLogin = await pool.request()
            .input('id', sql.Int, req.user.id)
            .query('SELECT fecha_ultimo_acceso FROM usuarios WHERE id = @id');
        
        const isFirstLogin = checkFirstLogin.recordset[0] && checkFirstLogin.recordset[0].fecha_ultimo_acceso === null;
        
        // Actualizar contraseña y, si es primer login, actualizar fecha_ultimo_acceso
        try {
            const updateRequest = pool.request();
            if (isFirstLogin) {
                // Si es primer login, actualizar contraseña Y fecha_ultimo_acceso
                await updateRequest
                    .input('id', sql.Int, req.user.id)
                    .input('password_hash', sql.NVarChar(255), newPasswordHash)
                    .query('UPDATE usuarios SET password_hash = @password_hash, fecha_ultimo_acceso = GETDATE() WHERE id = @id');
            } else {
                // Si no es primer login, solo actualizar contraseña
                await updateRequest
                    .input('id', sql.Int, req.user.id)
                    .input('password_hash', sql.NVarChar(255), newPasswordHash)
                    .query('UPDATE usuarios SET password_hash = @password_hash WHERE id = @id');
            }
        } catch (err) {
            console.error('❌ Error al actualizar contraseña:', err);
            return res.status(500).json({ error: 'Error al actualizar contraseña en la base de datos', details: err.message });
        }

        console.log('✅ Contraseña cambiada correctamente para usuario:', req.user.id, isFirstLogin ? '(primer login completado)' : '');
        
        // Si es primer login, generar nuevo token para que pueda acceder
        if (isFirstLogin) {
            // Obtener información del usuario actualizada
            const userInfo = await pool.request()
                .input('id', sql.Int, req.user.id)
                .query(`
                    SELECT u.id, u.usuario, u.rol_id, r.nombre as rol_nombre
                    FROM usuarios u
                    INNER JOIN roles r ON u.rol_id = r.id
                    WHERE u.id = @id
                `);
            
            const updatedUser = userInfo.recordset[0];
            const token = jwt.sign(
                { 
                    id: updatedUser.id, 
                    usuario: updatedUser.usuario, 
                    rol: updatedUser.rol_nombre 
                },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );
            
            return res.json({ 
                message: 'Contraseña cambiada correctamente. Ya puedes acceder a la aplicación.',
                token: token,
                firstLoginCompleted: true
            });
        }
        
        res.json({ message: 'Contraseña cambiada correctamente' });
    } catch (err) {
        console.error('❌ Error al cambiar contraseña:', err);
        console.error('Stack:', err.stack);
        res.status(500).json({ error: 'Error al cambiar contraseña', details: err.message });
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
                u.rol_id,
                r.nombre as rol,
                u.activo,
                u.fecha_creacion,
                u.fecha_ultimo_acceso,
                u.creado_por
            FROM usuarios u
            INNER JOIN roles r ON u.rol_id = r.id
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
                    u.rol_id,
                    r.nombre as rol,
                    u.activo,
                    u.fecha_creacion,
                    u.fecha_ultimo_acceso,
                    u.creado_por
                FROM usuarios u
                INNER JOIN roles r ON u.rol_id = r.id
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

        // Validar contraseña
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.message });
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
            .input('rol_id', sql.Int, finalRolId)
            .input('creado_por', sql.Int, req.user.id)
            .query(`
                INSERT INTO usuarios (usuario, password_hash, rol_id, creado_por)
                OUTPUT INSERTED.id
                VALUES (@usuario, @password_hash, @rol_id, @creado_por)
            `);
        
        const newId = result.recordset[0].id;
        
        // Enviar correo de bienvenida (no bloquea la respuesta si falla)
        sendWelcomeEmail(usuario, password, rolNombre).catch(err => {
            console.error('❌ Error al enviar correo de bienvenida:', err.message);
            // No fallar la creación del usuario si el correo falla
        });
        
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
        
        if (password !== undefined && password !== '') {
            // Validar contraseña
            const passwordValidation = validatePassword(password);
            if (!passwordValidation.valid) {
                return res.status(400).json({ error: passwordValidation.message });
            }
            
            const passwordHash = await bcrypt.hash(password, 10);
            updateFields.push('password_hash = @password_hash');
            request.input('password_hash', sql.NVarChar(255), passwordHash);
        }
        
        if (finalRolId !== undefined) {
            updateFields.push('rol_id = @rol_id');
            request.input('rol_id', sql.Int, finalRolId);
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
            WHERE c.activo = 1
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
        // Soft delete: marcar como inactivo
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('UPDATE controlhorario SET activo = 0 WHERE id = @id');
        
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
// Los admins ven también las inactivas
app.get('/api/personas', authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const userRole = req.user?.rol;
        const isAdmin = userRole === 'admin';
        
        const query = isAdmin 
            ? `SELECT id, nombre, email, activo, fecha_creacion FROM personas ORDER BY activo DESC, nombre ASC`
            : `SELECT id, nombre, email, activo, fecha_creacion FROM personas WHERE activo = 1 ORDER BY nombre ASC`;
        
        const result = await pool.request().query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error al obtener personas:', err);
        res.status(500).json({ error: 'Error al obtener personas', details: err.message });
    }
});

// GET /api/personas/:id - Obtener una persona por ID
app.get('/api/personas/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT id, nombre, email, activo, fecha_creacion FROM personas WHERE id = @id');
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Persona no encontrada' });
        }
        
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Error al obtener persona:', err);
        res.status(500).json({ error: 'Error al obtener persona', details: err.message });
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
// Los admins ven también los inactivos
app.get('/api/proyectos', authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const userRole = req.user?.rol;
        const isAdmin = userRole === 'admin';
        
        const query = isAdmin 
            ? `SELECT id, nombre, descripcion, activo, fecha_creacion FROM proyectos ORDER BY activo DESC, nombre ASC`
            : `SELECT id, nombre, descripcion, activo, fecha_creacion FROM proyectos WHERE activo = 1 ORDER BY nombre ASC`;
        
        const result = await pool.request().query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error al obtener proyectos:', err);
        res.status(500).json({ error: 'Error al obtener proyectos', details: err.message });
    }
});

// GET /api/proyectos/:id - Obtener un proyecto por ID
app.get('/api/proyectos/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT id, nombre, descripcion, activo, fecha_creacion FROM proyectos WHERE id = @id');
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }
        
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Error al obtener proyecto:', err);
        res.status(500).json({ error: 'Error al obtener proyecto', details: err.message });
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
// Los admins ven también las inactivas
app.get('/api/tareas', authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const userRole = req.user?.rol;
        const isAdmin = userRole === 'admin';
        
        const query = isAdmin 
            ? `SELECT id, nombre, descripcion, activo, fecha_creacion FROM tareas ORDER BY activo DESC, nombre ASC`
            : `SELECT id, nombre, descripcion, activo, fecha_creacion FROM tareas WHERE activo = 1 ORDER BY nombre ASC`;
        
        const result = await pool.request().query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error al obtener tareas:', err);
        res.status(500).json({ error: 'Error al obtener tareas', details: err.message });
    }
});

// GET /api/tareas/:id - Obtener una tarea por ID
app.get('/api/tareas/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT id, nombre, descripcion, activo, fecha_creacion FROM tareas WHERE id = @id');
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }
        
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Error al obtener tarea:', err);
        res.status(500).json({ error: 'Error al obtener tarea', details: err.message });
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

// DELETE /api/personas/:id - Eliminar persona (admin y gestor)
// Query param: ?cascade=true para eliminar también los registros asociados
app.delete('/api/personas/:id', authenticateToken, requireRole('admin', 'gestor'), async (req, res) => {
    try {
        const { id } = req.params;
        const cascade = req.query.cascade === 'true';
        const pool = await getPool();
        
        // Verificar si hay registros que usan esta persona (solo activos)
        const checkUsage = await pool.request()
            .input('persona_id', sql.Int, id)
            .query('SELECT COUNT(*) as count FROM controlhorario WHERE assignee_id = @persona_id AND activo = 1');
        
        const count = checkUsage.recordset[0].count;
        
        if (count > 0 && !cascade) {
            return res.status(409).json({ 
                error: 'No se puede eliminar esta persona porque tiene registros asociados',
                count: count,
                requiresCascade: true
            });
        }
        
        // Si hay registros y se solicita cascade, marcarlos como inactivos
        if (count > 0 && cascade) {
            await pool.request()
                .input('persona_id', sql.Int, id)
                .query('UPDATE controlhorario SET activo = 0 WHERE assignee_id = @persona_id AND activo = 1');
        }
        
        // Marcar persona como inactiva (soft delete)
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('UPDATE personas SET activo = 0 WHERE id = @id');
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Persona no encontrada' });
        }
        
        res.json({ 
            message: cascade && count > 0 
                ? `Persona y ${count} registro(s) asociado(s) eliminados correctamente`
                : 'Persona eliminada correctamente',
            recordsDeleted: cascade ? count : 0
        });
    } catch (err) {
        console.error('Error al eliminar persona:', err);
        res.status(500).json({ error: 'Error al eliminar persona', details: err.message });
    }
});

// DELETE /api/proyectos/:id - Eliminar proyecto (admin y gestor)
// Query param: ?cascade=true para eliminar también los registros asociados
app.delete('/api/proyectos/:id', authenticateToken, requireRole('admin', 'gestor'), async (req, res) => {
    try {
        const { id } = req.params;
        const cascade = req.query.cascade === 'true';
        const pool = await getPool();
        
        // Verificar si hay registros que usan este proyecto (solo activos)
        const checkUsage = await pool.request()
            .input('proyecto_id', sql.Int, id)
            .query('SELECT COUNT(*) as count FROM controlhorario WHERE phase_id = @proyecto_id AND activo = 1');
        
        const count = checkUsage.recordset[0].count;
        
        if (count > 0 && !cascade) {
            return res.status(409).json({ 
                error: 'No se puede eliminar este proyecto porque tiene registros asociados',
                count: count,
                requiresCascade: true
            });
        }
        
        // Si hay registros y se solicita cascade, marcarlos como inactivos
        if (count > 0 && cascade) {
            await pool.request()
                .input('proyecto_id', sql.Int, id)
                .query('UPDATE controlhorario SET activo = 0 WHERE phase_id = @proyecto_id AND activo = 1');
        }
        
        // Marcar proyecto como inactivo (soft delete)
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('UPDATE proyectos SET activo = 0 WHERE id = @id');
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }
        
        res.json({ 
            message: cascade && count > 0 
                ? `Proyecto y ${count} registro(s) asociado(s) eliminados correctamente`
                : 'Proyecto eliminado correctamente',
            recordsDeleted: cascade ? count : 0
        });
    } catch (err) {
        console.error('Error al eliminar proyecto:', err);
        res.status(500).json({ error: 'Error al eliminar proyecto', details: err.message });
    }
});

// DELETE /api/tareas/:id - Eliminar tarea (admin y gestor)
// Query param: ?cascade=true para eliminar también los registros asociados
app.delete('/api/tareas/:id', authenticateToken, requireRole('admin', 'gestor'), async (req, res) => {
    try {
        const { id } = req.params;
        const cascade = req.query.cascade === 'true';
        const pool = await getPool();
        
        // Verificar si hay registros que usan esta tarea (solo activos)
        const checkUsage = await pool.request()
            .input('tarea_id', sql.Int, id)
            .query('SELECT COUNT(*) as count FROM controlhorario WHERE task_id = @tarea_id AND activo = 1');
        
        const count = checkUsage.recordset[0].count;
        
        if (count > 0 && !cascade) {
            return res.status(409).json({ 
                error: 'No se puede eliminar esta tarea porque tiene registros asociados',
                count: count,
                requiresCascade: true
            });
        }
        
        // Si hay registros y se solicita cascade, marcarlos como inactivos
        if (count > 0 && cascade) {
            await pool.request()
                .input('tarea_id', sql.Int, id)
                .query('UPDATE controlhorario SET activo = 0 WHERE task_id = @tarea_id AND activo = 1');
        }
        
        // Marcar tarea como inactiva (soft delete)
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('UPDATE tareas SET activo = 0 WHERE id = @id');
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }
        
        res.json({ 
            message: cascade && count > 0 
                ? `Tarea y ${count} registro(s) asociado(s) eliminados correctamente`
                : 'Tarea eliminada correctamente',
            recordsDeleted: cascade ? count : 0
        });
    } catch (err) {
        console.error('Error al eliminar tarea:', err);
        res.status(500).json({ error: 'Error al eliminar tarea', details: err.message });
    }
});

// ========== RUTAS PARA REACTIVAR MAESTROS (SOLO ADMIN) ==========

// PUT /api/personas/:id/activate - Reactivar persona (solo admin)
// Reactiva la persona y todos los registros asociados si todos sus maestros están activos
app.put('/api/personas/:id/activate', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        
        // Verificar que la persona existe y está inactiva
        const checkPerson = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT id, nombre, activo FROM personas WHERE id = @id');
        
        if (checkPerson.recordset.length === 0) {
            return res.status(404).json({ error: 'Persona no encontrada' });
        }
        
        const persona = checkPerson.recordset[0];
        if (persona.activo === 1) {
            return res.status(400).json({ error: 'La persona ya está activa' });
        }
        
        // Reactivar la persona
        await pool.request()
            .input('id', sql.Int, id)
            .query('UPDATE personas SET activo = 1 WHERE id = @id');
        
        // Buscar todos los registros inactivos asociados a esta persona
        const registrosInactivos = await pool.request()
            .input('persona_id', sql.Int, id)
            .query(`
                SELECT c.id, c.assignee_id, c.phase_id, c.task_id
                FROM controlhorario c
                WHERE c.assignee_id = @persona_id AND c.activo = 0
            `);
        
        let reactivados = 0;
        
        // Para cada registro, verificar si todos sus maestros están activos
        for (const registro of registrosInactivos.recordset) {
            // Verificar que persona, proyecto y tarea estén activos
            const checkMaestros = await pool.request()
                .input('persona_id', sql.Int, registro.assignee_id)
                .input('proyecto_id', sql.Int, registro.phase_id)
                .input('tarea_id', sql.Int, registro.task_id)
                .query(`
                    SELECT 
                        (SELECT activo FROM personas WHERE id = @persona_id) as persona_activa,
                        (SELECT activo FROM proyectos WHERE id = @proyecto_id) as proyecto_activo,
                        (SELECT activo FROM tareas WHERE id = @tarea_id) as tarea_activa
                `);
            
            const maestros = checkMaestros.recordset[0];
            
            // Normalizar valores BIT de SQL Server (pueden venir como boolean o número)
            const personaActiva = maestros.persona_activa === true || maestros.persona_activa === 1 || maestros.persona_activa === '1';
            const proyectoActivo = maestros.proyecto_activo === true || maestros.proyecto_activo === 1 || maestros.proyecto_activo === '1';
            const tareaActiva = maestros.tarea_activa === true || maestros.tarea_activa === 1 || maestros.tarea_activa === '1';
            
            // Solo reactivar si TODOS los maestros están activos
            if (personaActiva && proyectoActivo && tareaActiva) {
                await pool.request()
                    .input('registro_id', sql.Int, registro.id)
                    .query('UPDATE controlhorario SET activo = 1 WHERE id = @registro_id');
                reactivados++;
            }
        }
        
        res.json({ 
            message: `Persona reactivada correctamente`,
            recordsReactivated: reactivados,
            totalRecordsChecked: registrosInactivos.recordset.length
        });
    } catch (err) {
        console.error('Error al reactivar persona:', err);
        res.status(500).json({ error: 'Error al reactivar persona', details: err.message });
    }
});

// PUT /api/proyectos/:id/activate - Reactivar proyecto (solo admin)
app.put('/api/proyectos/:id/activate', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        
        // Verificar que el proyecto existe y está inactivo
        const checkProject = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT id, nombre, activo FROM proyectos WHERE id = @id');
        
        if (checkProject.recordset.length === 0) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }
        
        const proyecto = checkProject.recordset[0];
        if (proyecto.activo === 1) {
            return res.status(400).json({ error: 'El proyecto ya está activo' });
        }
        
        // Reactivar el proyecto
        await pool.request()
            .input('id', sql.Int, id)
            .query('UPDATE proyectos SET activo = 1 WHERE id = @id');
        
        // Buscar todos los registros inactivos asociados a este proyecto
        const registrosInactivos = await pool.request()
            .input('proyecto_id', sql.Int, id)
            .query(`
                SELECT c.id, c.assignee_id, c.phase_id, c.task_id
                FROM controlhorario c
                WHERE c.phase_id = @proyecto_id AND c.activo = 0
            `);
        
        let reactivados = 0;
        
        // Para cada registro, verificar si todos sus maestros están activos
        for (const registro of registrosInactivos.recordset) {
            const checkMaestros = await pool.request()
                .input('persona_id', sql.Int, registro.assignee_id)
                .input('proyecto_id', sql.Int, registro.phase_id)
                .input('tarea_id', sql.Int, registro.task_id)
                .query(`
                    SELECT 
                        (SELECT activo FROM personas WHERE id = @persona_id) as persona_activa,
                        (SELECT activo FROM proyectos WHERE id = @proyecto_id) as proyecto_activo,
                        (SELECT activo FROM tareas WHERE id = @tarea_id) as tarea_activa
                `);
            
            const maestros = checkMaestros.recordset[0];
            
            // Normalizar valores BIT de SQL Server (pueden venir como boolean o número)
            const personaActiva = maestros.persona_activa === true || maestros.persona_activa === 1 || maestros.persona_activa === '1';
            const proyectoActivo = maestros.proyecto_activo === true || maestros.proyecto_activo === 1 || maestros.proyecto_activo === '1';
            const tareaActiva = maestros.tarea_activa === true || maestros.tarea_activa === 1 || maestros.tarea_activa === '1';
            
            // Solo reactivar si TODOS los maestros están activos
            if (personaActiva && proyectoActivo && tareaActiva) {
                await pool.request()
                    .input('registro_id', sql.Int, registro.id)
                    .query('UPDATE controlhorario SET activo = 1 WHERE id = @registro_id');
                reactivados++;
            }
        }
        
        res.json({ 
            message: `Proyecto reactivado correctamente`,
            recordsReactivated: reactivados,
            totalRecordsChecked: registrosInactivos.recordset.length
        });
    } catch (err) {
        console.error('Error al reactivar proyecto:', err);
        res.status(500).json({ error: 'Error al reactivar proyecto', details: err.message });
    }
});

// PUT /api/tareas/:id/activate - Reactivar tarea (solo admin)
app.put('/api/tareas/:id/activate', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        
        // Verificar que la tarea existe y está inactiva
        const checkTask = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT id, nombre, activo FROM tareas WHERE id = @id');
        
        if (checkTask.recordset.length === 0) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }
        
        const tarea = checkTask.recordset[0];
        if (tarea.activo === 1) {
            return res.status(400).json({ error: 'La tarea ya está activa' });
        }
        
        // Reactivar la tarea
        await pool.request()
            .input('id', sql.Int, id)
            .query('UPDATE tareas SET activo = 1 WHERE id = @id');
        
        // Buscar todos los registros inactivos asociados a esta tarea
        const registrosInactivos = await pool.request()
            .input('tarea_id', sql.Int, id)
            .query(`
                SELECT c.id, c.assignee_id, c.phase_id, c.task_id
                FROM controlhorario c
                WHERE c.task_id = @tarea_id AND c.activo = 0
            `);
        
        let reactivados = 0;
        
        // Para cada registro, verificar si todos sus maestros están activos
        for (const registro of registrosInactivos.recordset) {
            const checkMaestros = await pool.request()
                .input('persona_id', sql.Int, registro.assignee_id)
                .input('proyecto_id', sql.Int, registro.phase_id)
                .input('tarea_id', sql.Int, registro.task_id)
                .query(`
                    SELECT 
                        (SELECT activo FROM personas WHERE id = @persona_id) as persona_activa,
                        (SELECT activo FROM proyectos WHERE id = @proyecto_id) as proyecto_activo,
                        (SELECT activo FROM tareas WHERE id = @tarea_id) as tarea_activa
                `);
            
            const maestros = checkMaestros.recordset[0];
            
            // Normalizar valores BIT de SQL Server (pueden venir como boolean o número)
            const personaActiva = maestros.persona_activa === true || maestros.persona_activa === 1 || maestros.persona_activa === '1';
            const proyectoActivo = maestros.proyecto_activo === true || maestros.proyecto_activo === 1 || maestros.proyecto_activo === '1';
            const tareaActiva = maestros.tarea_activa === true || maestros.tarea_activa === 1 || maestros.tarea_activa === '1';
            
            // Solo reactivar si TODOS los maestros están activos
            if (personaActiva && proyectoActivo && tareaActiva) {
                await pool.request()
                    .input('registro_id', sql.Int, registro.id)
                    .query('UPDATE controlhorario SET activo = 1 WHERE id = @registro_id');
                reactivados++;
            }
        }
        
        res.json({ 
            message: `Tarea reactivada correctamente`,
            recordsReactivated: reactivados,
            totalRecordsChecked: registrosInactivos.recordset.length
        });
    } catch (err) {
        console.error('Error al reactivar tarea:', err);
        res.status(500).json({ error: 'Error al reactivar tarea', details: err.message });
    }
});

// Servir el HTML principal (solo si no está en Blob Storage)
// Si el HTML está en Blob Storage, esta ruta no se usará
// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'informe_completo.html'));
// });

// ========== INICIALIZACIÓN Y ARRANQUE DEL SERVIDOR ==========
// Inicializar secretos antes de iniciar el servidor
(async () => {
    try {
        await loadSecrets();
        await loadDatabaseConfig();
    } catch (err) {
        console.error('⚠️ Error al cargar secretos/configuración:', err.message);
        console.error('⚠️ El servidor iniciará con variables de entorno tradicionales');
    }
    
    // Iniciar servidor después de cargar secretos (o aunque falle)
    app.listen(PORT, () => {
        console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
        console.log(`📡 API disponible en http://localhost:${PORT}/api/registros`);
        console.log(`🌐 CORS configurado para: https://webcontrolhoras.z6.web.core.windows.net`);
    });
    
    // Inicializar pool de conexiones después de un breve delay
    setTimeout(async () => {
        try {
            await getPool();
        } catch (err) {
            console.error('⚠️ Error al inicializar pool de conexiones:', err.message);
            console.error('⚠️ El servidor seguirá funcionando, pero las peticiones a la BD fallarán');
        }
    }, 1000);
})();

// Manejo de cierre graceful
process.on('SIGINT', async () => {
    console.log('\n⏹️  Cerrando servidor...');
    if (pool) {
        await pool.close();
        console.log('✅ Conexión a SQL Server cerrada');
    }
    process.exit(0);
});

