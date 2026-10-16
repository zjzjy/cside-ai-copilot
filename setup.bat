@echo off
chcp 65001 >nul
echo ========================================
echo   CSide 一键安装脚本 V1.1
echo ========================================
echo.
echo 本脚本将检查并安装 CSide 运行所需的全部依赖：
echo   - Docker Desktop (PostgreSQL 16 + pgvector 0.7 + Redis 7)
echo   - JDK 21 (Eclipse Temurin)
echo   - Node.js 18+ / npm 9+
echo   - Playwright Chromium (E2E 测试)
echo   - 前端 npm 依赖 (扩展 + 管理后台)
echo.

:: ==========================================
:: 1. Docker
:: ==========================================
echo [1/6] 检查 Docker Desktop...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Docker，请先安装 Docker Desktop 4.30+
    echo        下载: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)
for /f "tokens=3 delims= " %%i in ('docker --version') do echo         Docker %%i 已安装

:: ==========================================
:: 2. JDK 21
:: ==========================================
echo [2/6] 检查 JDK 21 (Eclipse Temurin)...
java -version 2>&1 | findstr "21" >nul
if %errorlevel% neq 0 (
    echo [警告] 未检测到 JDK 21
    echo         请安装 Eclipse Temurin JDK 21.0.5+
    echo         下载: https://adoptium.net/download/
    echo         安装后确保 JAVA_HOME 环境变量已设置
    echo.
) else (
    for /f "tokens=3" %%i in ('java -version 2^>^&1 ^| findstr /i "version"') do echo         JDK %%i 已安装
)

:: ==========================================
:: 3. Node.js + npm
:: ==========================================
echo [3/6] 检查 Node.js 18+ 和 npm 9+...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请安装 Node.js 18+
    echo        下载: https://nodejs.org/
    echo        推荐安装 LTS 版本 (v20.x 或 v22.x)
    pause
    exit /b 1
)
for /f "delims=" %%i in ('node --version') do echo         Node.js %%i
for /f "delims=" %%i in ('npm --version') do echo         npm %%i

:: ==========================================
:: 4. Docker 容器 + 数据库初始化
:: ==========================================
echo [4/6] 启动 Docker 容器 (PostgreSQL 16 + pgvector + Redis 7)...
cd /d "%~dp0docker"
docker compose up -d
if %errorlevel% neq 0 (
    echo [错误] Docker 容器启动失败，请检查 Docker Desktop 是否运行
    pause
    exit /b 1
)

echo         等待 PostgreSQL 就绪...
:wait_db
docker exec cside-db pg_isready -U cside -d cside >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 2 >nul
    goto wait_db
)
echo         PostgreSQL 16 + pgvector 就绪

echo         初始化数据库表结构 (data/schema.sql)...
docker exec -i cside-db psql -U cside -d cside < "%~dp0data\schema.sql" 2>nul
echo         表结构已初始化 (users, brands, stores, conversations, messages, collections, knowledge_chunks)

cd /d "%~dp0"

:: ==========================================
:: 5. 前端依赖 + 构建
:: ==========================================
echo [5/6] 安装前端依赖...

echo         安装管理后台依赖 (frontend/admin)...
cd /d "%~dp0frontend\admin"
call npm install
echo           react 19, react-router-dom 7, antd 5, @ant-design/icons 5, axios 1

echo         安装扩展依赖 (frontend/extension)...
cd /d "%~dp0frontend\extension"
call npm install
echo           react 19, @playwright/test 1.62, vitest 4.1, @types/chrome

echo         构建 Chrome 扩展 (dist/)...
call npm run build
echo         扩展已构建到 frontend\extension\dist\

cd /d "%~dp0"

:: ==========================================
:: 6. Playwright Chromium (E2E 测试)
:: ==========================================
echo [6/6] 检查 Playwright Chromium (E2E 测试)...
cd /d "%~dp0frontend\extension"
if exist "%USERPROFILE%\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe" (
    echo         Playwright Chromium 已安装
) else (
    echo         [可选] 正在下载 Playwright Chromium (~192MB)...
    echo         如下载失败，可手动下载并解压:
    echo           URL: https://cdn.playwright.dev/builds/cft/151.0.7922.34/win64/chrome-win64.zip
    echo           解压到: %%USERPROFILE%%\AppData\Local\ms-playwright\chromium-1234\
    npx playwright install chromium 2>nul || echo         [注意] Chromium 下载失败，E2E 测试将使用系统 Chrome
)

cd /d "%~dp0"

:: ==========================================
:: .env 配置文件
:: ==========================================
if not exist ".env" (
    echo.
    echo         创建 .env 配置文件 (从 .env.example 复制)...
    copy ".env.example" ".env" >nul
    echo         [重要] 请编辑项目根目录下的 .env 文件，填入 LLM API Key:
    echo           LLM_DEEPSEEK_API_KEY=  (必填，DeepSeek API Key)
    echo           LLM_QWEN_API_KEY=      (可选，备用模型)
    echo           LLM_HUNYUAN_API_KEY=   (可选，兜底模型)
    echo.
)

echo.
echo ========================================
echo   安装完成！
echo ========================================
echo.
echo   项目结构:
echo     backend\      - Spring Boot 4.0.3 后端 (JDK 21, :8181)
echo     frontend\
echo       admin\      - 管理后台 SPA (React 19 + Ant Design 5, :5173)
echo       extension\  - Chrome 浏览器扩展 (Manifest V3)
echo     data\
echo       schema.sql  - 数据库 DDL (7 表)
echo       seed\       - 种子数据 (品牌/商品/FAQ)
echo     docker\       - Docker Compose (PostgreSQL + Redis)
echo     docs\         - 项目文档
echo       workflows.md   - 系统流程文档
echo       srs.md         - 需求规格说明书
echo       api\README.md  - API 接口文档
echo.
echo   测试体系:
echo     cd frontend\extension
echo     npm test                        - 单元测试 (24 tests, Vitest)
echo     npm run test:e2e:component      - 组件 E2E (14 tests, Playwright + Mock API)
echo     npm run test:e2e:full           - 完整链路 E2E (8 tests, Playwright + 扩展)
echo.
echo   下一步: 双击 start.bat 启动系统
echo.
echo   快速体验:
echo     1. start.bat 启动后端 + 管理后台
echo     2. 打开 Chrome, 地址栏输入 chrome://extensions/
echo     3. 开启 "开发者模式", 点击 "加载已解压的扩展程序"
echo     4. 选择 frontend\extension\dist 目录
echo     5. 点击浏览器工具栏的扩展图标打开侧边栏
echo.
pause
