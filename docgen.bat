@echo off
setlocal

REM Get the directory where this batch file is located
set DOCGEN_DIR=%~dp0

REM Check if dependencies are installed in the docgen folder
IF NOT EXIST "%DOCGEN_DIR%node_modules" (
    echo [docgen] Installing dependencies...
    pushd "%DOCGEN_DIR%"
    call npm install
    popd
)

REM Execute the CLI directly from source using tsx
echo [docgen] Executing...
call npx --yes tsx "%DOCGEN_DIR%packages\cli\src\index.ts" %*

endlocal
