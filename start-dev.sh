#!/bin/bash

# Clean up any existing processes
echo "Cleaning up existing processes..."
pkill -f "next dev" || true
pkill -f "node.*next" || true

# Wait for processes to clean up
sleep 3

# Remove build artifacts
echo "Cleaning build artifacts..."
rm -rf .next .turbo node_modules/.cache .swc

# Set file descriptor limits
echo "Setting file descriptor limits..."
ulimit -n 8192

# Check if port 3000 is free
echo "Checking port availability..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start the development server
echo "Starting development server..."
NODE_OPTIONS="--max-old-space-size=4096" npm run dev