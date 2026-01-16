@echo off
echo 🎬 Media Streaming API - Quick Start Setup
echo ==========================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo ✅ Node.js and npm are installed

REM Install dependencies
echo 📦 Installing dependencies...
npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed successfully

REM Check if .env exists
if not exist .env (
    echo ⚠️  .env file not found. Creating from .env.example...
    copy .env.example .env
    echo 📝 Please edit .env file with your configuration before running the app.
    echo.
    echo Required configuration:
    echo - MongoDB connection string
    echo - JWT secrets
    echo - AWS credentials
    echo - Stripe keys
    echo - CloudFront configuration
    echo.
    echo After configuring .env, run: npm run dev
    pause
) else (
    echo ✅ .env file found
    echo.
    echo 🚀 Starting development server...
    npm run dev
)