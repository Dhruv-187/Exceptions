@echo off
echo ===================================================
echo Starting AI-Assisted Emergency Triage System
echo ===================================================

echo.
echo [1/2] Starting Python FastAPI Backend on port 8000...
start "Triage Backend" cmd /k "cd backend && py -m uvicorn main:app --port 8000 --reload"

echo [2/2] Starting React Frontend on port 5175...
start "Triage Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo Both services are starting in new terminal windows!
echo Backend API: http://localhost:8000/docs
echo Frontend UI: http://localhost:5175
echo ===================================================
echo You can close this window now. The servers will keep running in their respective windows.
pause
