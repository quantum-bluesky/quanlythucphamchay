param(
    [switch]$CheckOnly,
    [switch]$SkipNpmInstall,
    [switch]$SkipPlaywrightInstall,
    [switch]$SkipPythonToolingDeps,
    [switch]$SkipQuickVerify,
    [switch]$SkipGhAuthCheck
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Get-ToolPath([string]$CommandName) {
    $command = Get-Command $CommandName -ErrorAction SilentlyContinue
    if ($null -eq $command) {
        return $null
    }
    return $command.Source
}

function Refresh-ProcessPath() {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = ($machinePath, $userPath -join ";")
}

function Ensure-WingetAvailable() {
    if (Get-ToolPath "winget") {
        return
    }
    throw "Khong tim thay winget. Hay cai App Installer/winget hoac cai cac tool thu cong truoc khi chay script nay."
}

function Resolve-KnownToolPath([string]$CommandName) {
    $candidates = switch ($CommandName) {
        "gh" { @("C:\Program Files\GitHub CLI\gh.exe") }
        "git" { @("C:\Program Files\Git\cmd\git.exe", "C:\Program Files\Git\bin\git.exe") }
        "node" { @("C:\Program Files\nodejs\node.exe") }
        "python" { @("C:\Program Files\Python313\python.exe", "C:\Program Files\Python312\python.exe", "C:\Program Files\Python311\python.exe") }
        default { @() }
    }

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }
    return $null
}

function Get-PythonVersion() {
    $versionText = & python -c "import sys; print('.'.join(map(str, sys.version_info[:3])))"
    return [version]$versionText.Trim()
}

function Get-NodeVersion() {
    $versionText = & node --version
    return [version]($versionText.Trim().TrimStart("v"))
}

function Test-PythonModule([string]$ModuleName) {
    & python -c "import importlib.util, sys; sys.exit(0 if importlib.util.find_spec('$ModuleName') else 1)"
    return $LASTEXITCODE -eq 0
}

function Install-WingetPackage([string]$PackageId, [string]$DisplayName) {
    Ensure-WingetAvailable
    Write-Step "Dang cai $DisplayName ($PackageId)"
    & winget install --id $PackageId --exact --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "Cai dat $DisplayName that bai."
    }
    Refresh-ProcessPath
}

function Ensure-CommandTool(
    [string]$DisplayName,
    [string]$CommandName,
    [string]$PackageId
) {
    $toolPath = Get-ToolPath $CommandName
    if (-not $toolPath) {
        $toolPath = Resolve-KnownToolPath $CommandName
        if ($toolPath) {
            $env:Path = "{0};{1}" -f (Split-Path -Parent $toolPath), $env:Path
        }
    }
    if ($toolPath) {
        Write-Ok "$DisplayName da co san: $toolPath"
        return
    }

    if ($CheckOnly) {
        Write-Warn "$DisplayName chua co san. Goi y cai bang winget id: $PackageId"
        return
    }

    Install-WingetPackage -PackageId $PackageId -DisplayName $DisplayName
    $toolPath = Get-ToolPath $CommandName
    if (-not $toolPath) {
        $knownPath = Resolve-KnownToolPath $CommandName
        if ($knownPath) {
            $env:Path = "{0};{1}" -f (Split-Path -Parent $knownPath), $env:Path
            $toolPath = $knownPath
        }
    }

    if (-not $toolPath) {
        Write-Warn "$DisplayName vua duoc cai nhung PATH hien tai chua thay doi. Mo PowerShell moi va chay lai script de tiep tuc."
        return
    }

    Write-Ok "$DisplayName da san sang: $toolPath"
}

function Ensure-Python() {
    $toolPath = Get-ToolPath "python"
    if ($toolPath) {
        $pythonVersion = Get-PythonVersion
        if ($pythonVersion -ge [version]"3.11.0") {
            Write-Ok "Python da dat yeu cau: $pythonVersion"
            return
        }

        Write-Warn "Python hien tai la $pythonVersion, can 3.11 tro len."
    } elseif ($CheckOnly) {
        Write-Warn "Python 3.11+ chua co san. Goi y cai bang winget id: Python.Python.3.13"
        return
    }

    if ($CheckOnly) {
        return
    }

    Install-WingetPackage -PackageId "Python.Python.3.13" -DisplayName "Python 3.13"
    $knownPath = Resolve-KnownToolPath "python"
    if ($knownPath) {
        $env:Path = "{0};{1}" -f (Split-Path -Parent $knownPath), $env:Path
    }
    $pythonVersion = Get-PythonVersion
    if ($pythonVersion -lt [version]"3.11.0") {
        throw "Python sau cai dat van chua dat yeu cau >= 3.11."
    }
    Write-Ok "Python da san sang: $pythonVersion"
}

function Ensure-Node() {
    $toolPath = Get-ToolPath "node"
    if ($toolPath) {
        $nodeVersion = Get-NodeVersion
        if ($nodeVersion -ge [version]"18.0.0") {
            Write-Ok "Node.js da dat yeu cau: $nodeVersion"
            return
        }

        Write-Warn "Node.js hien tai la $nodeVersion, can 18 tro len."
    } elseif ($CheckOnly) {
        Write-Warn "Node.js LTS chua co san. Goi y cai bang winget id: OpenJS.NodeJS.LTS"
        return
    }

    if ($CheckOnly) {
        return
    }

    Install-WingetPackage -PackageId "OpenJS.NodeJS.LTS" -DisplayName "Node.js LTS"
    $knownPath = Resolve-KnownToolPath "node"
    if ($knownPath) {
        $env:Path = "{0};{1}" -f (Split-Path -Parent $knownPath), $env:Path
    }
    $nodeVersion = Get-NodeVersion
    if ($nodeVersion -lt [version]"18.0.0") {
        throw "Node.js sau cai dat van chua dat yeu cau >= 18."
    }
    Write-Ok "Node.js da san sang: $nodeVersion"
}

function Ensure-PythonPackage(
    [string]$ImportName,
    [string]$PackageName,
    [string]$Reason
) {
    if (Test-PythonModule $ImportName) {
        Write-Ok "Python package $PackageName da co san ($Reason)."
        return
    }

    if ($CheckOnly) {
        Write-Warn "Python package $PackageName chua co san ($Reason)."
        return
    }

    Write-Step "Cai Python package $PackageName"
    & python -m pip install --disable-pip-version-check $PackageName
    if ($LASTEXITCODE -ne 0) {
        throw "Cai Python package $PackageName that bai."
    }

    if (-not (Test-PythonModule $ImportName)) {
        throw "Da cai $PackageName nhung Python van khong import duoc module $ImportName."
    }

    Write-Ok "Python package $PackageName da san sang ($Reason)."
}

function Invoke-RepoCommand([string]$FilePath, [string[]]$ArgumentList) {
    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        throw "Lenh that bai: $FilePath $($ArgumentList -join ' ')"
    }
}

Write-Step "Kiem tra tool can thiet cho project"
Ensure-Python
Ensure-Node
Ensure-CommandTool -DisplayName "Git" -CommandName "git" -PackageId "Git.Git"
Ensure-CommandTool -DisplayName "GitHub CLI" -CommandName "gh" -PackageId "GitHub.cli"
if (-not $SkipPythonToolingDeps) {
    Ensure-PythonPackage -ImportName "yaml" -PackageName "PyYAML" -Reason "tooling Codex/Git Issue quick_validate.py"
} elseif ($CheckOnly) {
    Write-Warn "Bo qua kiem tra Python tooling deps theo tham so."
}

if ($CheckOnly) {
    Write-Step "Check-only summary"
    Write-Host "Script dang chay o che do chi kiem tra. Khong co thay doi nao duoc ap dung."
    return
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$nodePath = Get-ToolPath "node"
$pythonPath = Get-ToolPath "python"
$ghPath = Get-ToolPath "gh"

if (-not $SkipNpmInstall) {
    Write-Step "Cai npm dependencies"
    Invoke-RepoCommand -FilePath "npm" -ArgumentList @("install")
    Write-Ok "Da cap nhat node_modules."
} else {
    Write-Warn "Bo qua npm install theo tham so."
}

if (-not $SkipPlaywrightInstall) {
    Write-Step "Cai Playwright Chromium"
    Invoke-RepoCommand -FilePath "npx" -ArgumentList @("playwright", "install", "chromium")
    Write-Ok "Playwright Chromium da san sang."
} else {
    Write-Warn "Bo qua Playwright install theo tham so."
}

if (-not $SkipQuickVerify) {
    Write-Step "Chay quick verify"
    Invoke-RepoCommand -FilePath $pythonPath -ArgumentList @("-m", "py_compile", "app.py")
    Invoke-RepoCommand -FilePath $nodePath -ArgumentList @("--check", "static/app.js")
    Write-Ok "Quick verify thanh cong."
} else {
    Write-Warn "Bo qua quick verify theo tham so."
}

if ($ghPath -and -not $SkipGhAuthCheck) {
    Write-Step "Kiem tra dang nhap GitHub CLI"
    & $ghPath auth status
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "gh da duoc cai nhung chua auth. Chay: gh auth login"
    } else {
        Write-Ok "GitHub CLI da auth."
    }
}

Write-Step "Hoan tat setup"
Write-Host "Ban co the chay lai script nhieu lan. Cac buoc cai tool va npm install deu an toan khi lap lai."
