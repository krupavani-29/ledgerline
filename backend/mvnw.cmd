@echo off
if exist "%USERPROFILE%\maven\apache-maven-3.9.6\bin\mvn.cmd" (
    "%USERPROFILE%\maven\apache-maven-3.9.6\bin\mvn.cmd" %*
) else (
    mvn %*
)

