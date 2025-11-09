#!/usr/bin/env pwsh
# Convenience PowerShell script to run the project (frontend + backend)
Write-Host "Installing root dev dependencies (if needed)..."
if (-not (Test-Path "node_modules\concurrently")) {
  npm install
}

Write-Host "Starting backend and frontend (concurrently)..."
npm run start
