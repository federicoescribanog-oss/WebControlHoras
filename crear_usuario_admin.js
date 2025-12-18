// Script para crear el hash de contraseña del usuario admin inicial
// Ejecutar: node crear_usuario_admin.js

const bcrypt = require('bcrypt');

async function createAdminUser() {
    const password = 'admin123'; // Contraseña inicial
    const hash = await bcrypt.hash(password, 10);
    
    console.log('===========================================');
    console.log('Hash de contraseña generado para usuario admin');
    console.log('===========================================');
    console.log('Usuario: federico.escribano@es.logicalis.com');
    console.log('Contraseña inicial: San_Lorenzo100@');
    console.log('Hash bcrypt:', hash);
    console.log('===========================================');
    console.log('\nEjecuta este SQL en tu base de datos:');
    console.log('===========================================');
    console.log(`
USE bbddcontrolhoras;
GO

-- Insertar usuario administrador inicial
-- Contraseña: admin123
INSERT INTO usuarios (usuario, password_hash, rol, activo)
VALUES (
    'admin',
    '${hash}',
    'admin',
    1
);
GO
    `);
    console.log('===========================================');
    console.log('⚠️ IMPORTANTE: Cambia la contraseña después del primer login');
    console.log('===========================================');
}

createAdminUser().catch(console.error);

