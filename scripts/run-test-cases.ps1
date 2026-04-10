param(
    [ValidateSet("all", "integration", "unit")]
    [string]$Target = "all",
    [string[]]$IncludeCode = @(),
    [string[]]$ExcludeCode = @(),
    [switch]$Headed
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Normalize-Code {
    param([string]$Code)
    if ($null -eq $Code) {
        return ""
    }
    return $Code.Trim().ToUpper().Replace("_", "-")
}

function Matches-CodeFilter {
    param(
        [string]$CaseCode,
        [string[]]$Includes,
        [string[]]$Excludes
    )

    $normalized = Normalize-Code $CaseCode
    if (-not $normalized) {
        return $false
    }

    if ($Includes.Count -gt 0) {
        $included = $false
        foreach ($prefix in $Includes) {
            if ($normalized.StartsWith((Normalize-Code $prefix))) {
                $included = $true
                break
            }
        }
        if (-not $included) {
            return $false
        }
    }

    foreach ($prefix in $Excludes) {
        if ($normalized.StartsWith((Normalize-Code $prefix))) {
            return $false
        }
    }

    return $true
}

function Build-PlaywrightRegex {
    param([string[]]$Codes)

    $parts = @()
    foreach ($code in $Codes) {
        $normalized = Normalize-Code $code
        if ($normalized) {
            $parts += [Regex]::Escape($normalized)
        }
    }
    return ($parts -join "|")
}

function Run-IntegrationTests {
    $args = @("playwright", "test")
    if ($Headed) {
        $args += "--headed"
    }

    $includeRegex = Build-PlaywrightRegex $IncludeCode
    if ($includeRegex) {
        $args += @("--grep", $includeRegex)
    }

    $excludeRegex = Build-PlaywrightRegex $ExcludeCode
    if ($excludeRegex) {
        $args += @("--grep-invert", $excludeRegex)
    }

    & npx @args
}

function Get-UnitTestCases {
    $cases = @()
    $pythonFiles = Get-ChildItem -Path "tests" -Filter "test_*.py" -File
    foreach ($file in $pythonFiles) {
        $moduleName = "tests." + [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
        $currentClass = ""
        foreach ($line in Get-Content $file.FullName) {
            if ($line -match '^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(') {
                $currentClass = $Matches[1]
                continue
            }
            if ($line -match '^\s*def\s+(test_[A-Za-z0-9_]+)\s*\(') {
                $methodName = $Matches[1]
                $caseCode = ""
                if ($methodName -match '^test_([a-z0-9]+)_([a-z0-9]+)_([0-9]{2})_') {
                    $caseCode = ("{0}-{1}-{2}" -f $Matches[1], $Matches[2], $Matches[3]).ToUpper()
                }
                $cases += [pscustomobject]@{
                    QualifiedName = if ($currentClass) { "$moduleName.$currentClass.$methodName" } else { "$moduleName.$methodName" }
                    CaseCode      = $caseCode
                }
            }
        }
    }
    return $cases
}

function Run-UnitTests {
    $allCases = @(Get-UnitTestCases)
    if ($IncludeCode.Count -eq 0 -and $ExcludeCode.Count -eq 0) {
        & python -m unittest discover -s tests
        return
    }

    $selected = @(
        $allCases |
            Where-Object {
                Matches-CodeFilter -CaseCode $_.CaseCode -Includes $IncludeCode -Excludes $ExcludeCode
            } |
            Select-Object -ExpandProperty QualifiedName
    )

    if ($selected.Count -eq 0) {
        throw "Không tìm thấy unit test nào khớp IncludeCode/ExcludeCode."
    }

    & python -m unittest @selected
}

if ($Target -in @("all", "unit")) {
    Run-UnitTests
}

if ($Target -in @("all", "integration")) {
    Run-IntegrationTests
}
