# Sydney Events Frontend - Setup Script
# Run this script in PowerShell to set up and start the frontend

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Sydney Events Aggregator - Frontend  " -ForegroundColor Cyan
Write-Host "  Automated Setup Script                " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking prerequisites..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found!" -ForegroundColor Red
    Write-Host "Please install Node.js 16+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "✓ npm found: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ npm not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Navigate to frontend directory
$frontendPath = "d:\Full Stack developer\frontend"
Write-Host "Navigating to frontend directory..." -ForegroundColor Yellow

if (Test-Path $frontendPath) {
    Set-Location $frontendPath
    Write-Host "✓ In directory: $frontendPath" -ForegroundColor Green
} else {
    Write-Host "✗ Frontend directory not found at: $frontendPath" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Check if node_modules exists
if (Test-Path "node_modules") {
    Write-Host "Dependencies already installed." -ForegroundColor Yellow
    $reinstall = Read-Host "Do you want to reinstall? (y/n)"
    if ($reinstall -eq 'y') {
        Write-Host "Removing existing node_modules..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force node_modules
        Write-Host "Installing dependencies..." -ForegroundColor Yellow
        npm install
    }
} else {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    Write-Host "This may take a few minutes..." -ForegroundColor Gray
    npm install
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Dependencies installed successfully!" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Check .env file
if (Test-Path ".env") {
    Write-Host "✓ .env file exists" -ForegroundColor Green
} else {
    Write-Host "Creating .env file..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✓ .env file created" -ForegroundColor Green
}

Write-Host ""

# Display configuration
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Configuration                         " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$envContent = Get-Content ".env"
foreach ($line in $envContent) {
    if ($line -match "REACT_APP_API_URL=(.+)") {
        $apiUrl = $matches[1]
        Write-Host "API URL: $apiUrl" -ForegroundColor White
    }
}

Write-Host ""

# Ask if user wants to start the dev server
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host ""
$start = Read-Host "Do you want to start the development server? (y/n)"

if ($start -eq 'y') {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Starting Development Server          " -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "The app will open in your browser automatically." -ForegroundColor Yellow
    Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Yellow
    Write-Host ""
    
    # Start the development server
    npm start
} else {
    Write-Host ""
    Write-Host "To start the development server later, run:" -ForegroundColor Yellow
    Write-Host "  cd `"$frontendPath`"" -ForegroundColor White
    Write-Host "  npm start" -ForegroundColor White
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Available Commands                    " -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "npm start" -ForegroundColor White -NoNewline
    Write-Host "         - Start development server" -ForegroundColor Gray
    Write-Host "npm run build" -ForegroundColor White -NoNewline
    Write-Host "     - Build for production" -ForegroundColor Gray
    Write-Host "npm test" -ForegroundColor White -NoNewline
    Write-Host "          - Run tests" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Documentation                         " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "README.md" -ForegroundColor White -NoNewline
Write-Host "                    - Full documentation" -ForegroundColor Gray
Write-Host "QUICK_START.md" -ForegroundColor White -NoNewline
Write-Host "                - Quick setup guide" -ForegroundColor Gray
Write-Host "PRODUCT_REQUIREMENTS.md" -ForegroundColor White -NoNewline
Write-Host "     - Product specifications" -ForegroundColor Gray
Write-Host "BUILD_SUMMARY.md" -ForegroundColor White -NoNewline
Write-Host "            - Build overview" -ForegroundColor Gray
Write-Host "ARCHITECTURE.md" -ForegroundColor White -NoNewline
Write-Host "             - System architecture" -ForegroundColor Gray
Write-Host ""
Write-Host "Thank you for using Sydney Events Aggregator!" -ForegroundColor Green
Write-Host ""
