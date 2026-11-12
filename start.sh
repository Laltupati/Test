#!/bin/bash

echo "Starting QualiVerse AI..."
echo ""

# Start Backend
echo "[1/2] Starting Backend (FastAPI)..."
cd backend
python run.py &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to initialize
sleep 2

# Start Frontend
echo "[2/2] Starting Frontend (Vite)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "Both servers are starting..."
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers."

# Wait for user interrupt
trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
