#!/bin/bash

echo "🎬 Media Streaming API - Quick Start Setup"
echo "=========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "📝 Please edit .env file with your configuration before running the app."
    echo ""
    echo "Required configuration:"
    echo "- MongoDB connection string"
    echo "- JWT secrets"
    echo "- AWS credentials"
    echo "- Stripe keys"
    echo "- CloudFront configuration"
    echo ""
    echo "After configuring .env, run: npm run dev"
else
    echo "✅ .env file found"
    echo ""
    echo "🚀 Starting development server..."
    npm run dev
fi