@echo off
echo ===================================================
echo Starting AI Email Triage System Components...
echo ===================================================

echo.
echo [1/3] Starting Python AI Microservice (Port 5001)...
cd ai-service
start "AI Service" cmd /k ".\venv\Scripts\activate.bat && python app.py"
cd ..

echo [2/3] Starting Node.js Backend (Port 5000)...
cd backend
start "Node Backend" cmd /k "npm start"
cd ..

echo [3/3] Starting React Frontend (Port 5173)...
cd frotend
start "React Frontend" cmd /k "npm run dev"
cd ..

echo.
echo ===================================================
echo All services have been launched in separate windows!
echo Opening your default browser...
echo ===================================================

timeout /t 3 >nul
start http://localhost:5173
