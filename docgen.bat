@echo off
setlocal

:: Ensure dependencies are installed
echo Installing dependencies...
call npm ci

:: Build the packages
echo Building docgen packages...
call npm run build

:: Run docgen (passing any additional arguments)
echo Running docgen...
call npx docgen %*

endlocal
