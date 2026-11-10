Set-Location "$PSScriptRoot\backend"
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "Starting Global Trade & Tariff Analytics Backend" -ForegroundColor Green
Write-Host "Database: PostgreSQL (trade_db)" -ForegroundColor Yellow
Write-Host "Engine: FastAPI + DuckDB 2.0 In-Memory Columnar OLAP" -ForegroundColor Yellow
Write-Host "API URL: http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "Swagger Docs: http://127.0.0.1:8000/docs" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
& ".\.venv\Scripts\uvicorn.exe" app.main:app --host 127.0.0.1 --port 8000 --reload
