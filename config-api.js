// Configuración de la API para diferentes entornos
// Este archivo puede ser usado para configurar la URL de la API según el entorno

// Detectar si estamos en desarrollo o producción
const isDevelopment = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname.includes('localhost');

// Configuración de URLs de API según el entorno
const API_CONFIG = {
    development: 'http://localhost:3000',
    production: 'https://tu-api-backend.azurewebsites.net' // ⚠️ CONFIGURA ESTA URL
};

// URL base de la API
const API_BASE_URL = isDevelopment ? API_CONFIG.development : API_CONFIG.production;

// Exportar para uso en informe_completo.html
// En el HTML, reemplazar la línea de API_BASE_URL con:
// const API_BASE_URL = isDevelopment ? 'http://localhost:3000' : 'https://tu-api-backend.azurewebsites.net';



