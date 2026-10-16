@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

set "ROOT=%~dp0"
set "ENV_FILE=%ROOT%.env"
set "COMPOSE_FILE=%ROOT%docker\docker-compose.yml"
set "BACKEND_DIR=%ROOT%backend"
set "ADMIN_DIR=%ROOT%frontend\admin"

if /I "%~1"=="--run-admin" goto :run_admin

echo ========================================
echo   CSide One-Click Start V1.3
echo ========================================
echo.
echo   Safe to run repeatedly.
echo   Existing services will be reused.
echo.

cd /d "%ROOT%"

if not exist "%ENV_FILE%" (
    echo [ERROR] Missing %ENV_FILE%
    echo         Copy .env.example to .env and configure it first.
    goto :failed
)

where docker >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker CLI was not found.
    goto :failed
)

docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Desktop is not running.
    goto :failed
)

where curl >nul 2>&1
if errorlevel 1 (
    echo [ERROR] curl was not found.
    goto :failed
)

rem docker-compose.yml requires a non-empty argument after --requirepass.
rem A process-local development password prevents Redis from crashing when
rem REDIS_PASSWORD is missing or blank. A value in .env still takes priority.
findstr /R /C:"^REDIS_PASSWORD=." "%ENV_FILE%" >nul 2>&1
if errorlevel 1 (
    set "REDIS_PASSWORD=cside"
    echo [WARN] REDIS_PASSWORD is blank. Using local default for this run.
)

set "EXISTING_REDIS_STATUS="
set "EXISTING_REDIS_PORT="
for /F "delims=" %%S in ('docker inspect -f "{{.State.Status}}" cside-redis 2^>nul') do set "EXISTING_REDIS_STATUS=%%S"
if /I "!EXISTING_REDIS_STATUS!"=="running" (
    for /F "tokens=2 delims=:" %%P in ('docker port cside-redis 6379/tcp 2^>nul ^| findstr /B /C:"0.0.0.0:"') do set "EXISTING_REDIS_PORT=%%P"
)

if defined EXISTING_REDIS_PORT (
    set "REDIS_PORT=!EXISTING_REDIS_PORT!"
    echo [INFO] Reusing Redis on port !REDIS_PORT!.
) else (
    set "REDIS_PORT="
    for /F "usebackq tokens=1,* delims==" %%A in (`findstr /B /C:"REDIS_PORT=" "%ENV_FILE%" 2^>nul`) do set "REDIS_PORT=%%B"
    if not defined REDIS_PORT set "REDIS_PORT=6379"
    call :port_available !REDIS_PORT!
    if errorlevel 1 (
        set "REQUESTED_REDIS_PORT=!REDIS_PORT!"
        call :select_redis_port
        if errorlevel 1 (
            echo [ERROR] No free Redis port was found in range 7000 through 7099.
            goto :failed
        )
        echo [WARN] Redis port !REQUESTED_REDIS_PORT! is unavailable.
        echo        Using Redis port !REDIS_PORT! for this run.
    )
)

echo [1/3] Starting Docker services...
docker compose --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" up -d
if errorlevel 1 (
    echo [ERROR] Docker Compose failed.
    goto :failed
)

call :wait_postgres 90
if errorlevel 1 (
    echo [ERROR] PostgreSQL did not become ready.
    goto :failed
)
echo       PostgreSQL ready.

call :wait_running cside-redis 60
if errorlevel 1 (
    echo [ERROR] Redis is not running.
    echo         Run: docker logs cside-redis
    goto :failed
)
echo       Redis running.

call :wait_http http://localhost:8182/health 180
if errorlevel 1 (
    echo [ERROR] Embedding service did not become ready.
    echo         Run: docker logs cside-embeddings
    goto :failed
)
echo       Embedding service ready.

echo       Checking database schema...
docker exec cside-db psql -U cside -d cside -tAc "SELECT to_regclass('public.knowledge_vectors');" 2>nul | findstr /I "knowledge_vectors" >nul
if errorlevel 1 (
    echo       Initializing database schema...
    docker exec -i cside-db psql -v ON_ERROR_STOP=1 -U cside -d cside < "%ROOT%data\schema.sql"
    if errorlevel 1 (
        echo [ERROR] Database schema initialization failed.
        goto :failed
    )
) else (
    echo       Database schema already exists.
)

docker exec cside-db psql -U cside -d cside -c "UPDATE brands SET name = 'huawei' WHERE name = U&'\534E\4E3A'; UPDATE knowledge_vectors SET brand = 'huawei' WHERE brand = U&'\534E\4E3A';" >nul 2>&1

echo [2/3] Checking backend on port 8181...
curl -fsS http://localhost:8181/v3/api-docs >nul 2>&1
if errorlevel 1 (
    if not exist "%BACKEND_DIR%\mvnw.cmd" (
        echo [ERROR] Maven wrapper was not found in backend.
        goto :failed
    )
    echo       Starting backend in a new window...
    start "CSide Backend" /D "%BACKEND_DIR%" cmd /k "call mvnw.cmd spring-boot:run"
    call :wait_http http://localhost:8181/v3/api-docs 120
    if errorlevel 1 (
        echo [ERROR] Backend did not become ready.
        echo         Check the CSide Backend window.
        goto :failed
    )
) else (
    echo       Backend already running.
)
echo       Backend ready: http://localhost:8181

echo [3/3] Checking admin frontend on port 5173...
curl -fsS http://localhost:5173 >nul 2>&1
if errorlevel 1 (
    if not exist "%ADMIN_DIR%\package.json" (
        echo [ERROR] Admin package.json was not found.
        goto :failed
    )
    where npm >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] npm was not found.
        goto :failed
    )
    echo       Starting admin frontend in a new window...
    start "CSide Admin" /D "%ADMIN_DIR%" cmd.exe /d /k call "%~f0" --run-admin
    call :wait_http http://localhost:5173 120
    if errorlevel 1 (
        echo [ERROR] Admin frontend did not become ready.
        echo         Check the CSide Admin window.
        goto :failed
    )
) else (
    echo       Admin frontend already running.
)
echo       Admin ready: http://localhost:5173

echo.
echo ========================================
echo   CSide is ready
echo ========================================
echo   Admin:   http://localhost:5173
echo   Backend: http://localhost:8181
echo   Swagger: http://localhost:8181/swagger-ui.html
echo.
echo   Chrome extension:
echo     cd frontend\extension
echo     npm ci
echo     npm run build
echo     Load frontend\extension\dist in chrome://extensions
echo ========================================
echo.
if not defined CSIDE_NONINTERACTIVE pause
exit /b 0

:wait_postgres
set /a "WAIT_SECONDS=0"
:wait_postgres_loop
docker exec cside-db pg_isready -U cside -d cside >nul 2>&1
if not errorlevel 1 exit /b 0
if !WAIT_SECONDS! GEQ %~1 exit /b 1
ping 127.0.0.1 -n 3 >nul
set /a "WAIT_SECONDS+=2"
goto :wait_postgres_loop

:wait_running
set "WAIT_CONTAINER=%~1"
set "WAIT_LIMIT=%~2"
set /a "WAIT_SECONDS=0"
:wait_running_loop
set "WAIT_STATUS="
for /F "delims=" %%S in ('docker inspect -f "{{.State.Status}}" "%WAIT_CONTAINER%" 2^>nul') do set "WAIT_STATUS=%%S"
if /I "!WAIT_STATUS!"=="running" exit /b 0
if !WAIT_SECONDS! GEQ !WAIT_LIMIT! exit /b 1
ping 127.0.0.1 -n 3 >nul
set /a "WAIT_SECONDS+=2"
goto :wait_running_loop

:wait_http
set "WAIT_URL=%~1"
set /a "WAIT_SECONDS=0"
:wait_http_loop
curl -fsS "%WAIT_URL%" >nul 2>&1
if not errorlevel 1 exit /b 0
if !WAIT_SECONDS! GEQ %~2 exit /b 1
ping 127.0.0.1 -n 3 >nul
set /a "WAIT_SECONDS+=2"
goto :wait_http_loop

:select_redis_port
for /L %%P in (7000,1,7099) do (
    call :port_available %%P
    if not errorlevel 1 (
        set "REDIS_PORT=%%P"
        exit /b 0
    )
)
exit /b 1

:port_available
set "CHECK_PORT=%~1"
netstat -ano -p tcp 2>nul | findstr /R /C:":%CHECK_PORT% .*LISTENING" >nul
if not errorlevel 1 exit /b 1
for /F "tokens=1,2" %%A in ('netsh interface ipv4 show excludedportrange protocol^=tcp ^| findstr /R "^[ ]*[0-9]"') do (
    if %CHECK_PORT% GEQ %%A if %CHECK_PORT% LEQ %%B exit /b 1
)
exit /b 0

:run_admin
cd /d "%ADMIN_DIR%"
if exist node_modules goto :admin_dependencies_ready
echo Installing admin dependencies...
call npm install
if errorlevel 1 (
    echo [ERROR] Admin dependency installation failed.
    exit /b 1
)
:admin_dependencies_ready
call npm run dev
exit /b %errorlevel%

:failed
echo.
echo CSide startup failed. Review the error above.
if not defined CSIDE_NONINTERACTIVE pause
exit /b 1
