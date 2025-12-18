# Script PowerShell para preparar el despliegue del backend
# Crea un ZIP con solo los archivos necesarios para Azure App Service

Write-Host "🚀 Preparando despliegue del backend..." -ForegroundColor Cyan

# Crear carpeta temporal
$deployFolder = "deploy-backend"
if (Test-Path $deployFolder) {
    Remove-Item $deployFolder -Recurse -Force
}
New-Item -ItemType Directory -Path $deployFolder | Out-Null

Write-Host "📦 Copiando archivos necesarios..." -ForegroundColor Yellow

# Copiar archivos esenciales
Copy-Item "server.js" "$deployFolder\" -ErrorAction SilentlyContinue
Copy-Item "package.json" "$deployFolder\" -ErrorAction SilentlyContinue
Copy-Item ".deploymentignore" "$deployFolder\" -ErrorAction SilentlyContinue

# Verificar que los archivos existen
$requiredFiles = @("server.js", "package.json")
$missingFiles = @()

foreach ($file in $requiredFiles) {
    if (-not (Test-Path "$deployFolder\$file")) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "❌ ERROR: Faltan archivos requeridos:" -ForegroundColor Red
    foreach ($file in $missingFiles) {
        Write-Host "   - $file" -ForegroundColor Red
    }
    Remove-Item $deployFolder -Recurse -Force
    exit 1
}

# Crear ZIP
$zipFile = "backend.zip"
if (Test-Path $zipFile) {
    Remove-Item $zipFile -Force
}

Write-Host "📦 Creando ZIP..." -ForegroundColor Yellow
Compress-Archive -Path "$deployFolder\*" -DestinationPath $zipFile -Force

# Mostrar contenido
Write-Host "`n✅ ZIP creado exitosamente: $zipFile" -ForegroundColor Green
Write-Host "`n📋 Contenido del ZIP:" -ForegroundColor Cyan
Get-ChildItem $deployFolder | ForEach-Object {
    Write-Host "   ✓ $($_.Name)" -ForegroundColor Gray
}

# Mostrar tamaño
$zipSize = (Get-Item $zipFile).Length / 1KB
Write-Host "`n📊 Tamaño: $([math]::Round($zipSize, 2)) KB" -ForegroundColor Cyan

# Limpiar carpeta temporal
Remove-Item $deployFolder -Recurse -Force

Write-Host "`n🎉 ¡Listo para desplegar!" -ForegroundColor Green
Write-Host "`n📝 Próximos pasos:" -ForegroundColor Yellow
Write-Host "   1. Ve a Azure Portal → App Service → Centro de implementación" -ForegroundColor White
Write-Host "   2. Selecciona 'ZIP Deploy'" -ForegroundColor White
Write-Host "   3. Sube el archivo: $zipFile" -ForegroundColor White
Write-Host "   4. Configura las variables de entorno en App Service" -ForegroundColor White

