param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [string]$OutputDir = ".\downloads",

  [string]$IdmPath = "${env:ProgramFiles(x86)}\Internet Download Manager\IDMan.exe",

  [string]$OutScript = ".\idm-import.cmd",

  [ValidateSet("idm", "aria2", "clean")]
  [string]$Mode = "idm",

  [switch]$StartQueue
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-FullPath {
  param([string]$Path)

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }

  return [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $Path))
}

function Get-SafeFileName {
  param(
    [string]$Name,
    [string]$Url,
    [int]$Index
  )

  $candidate = $Name
  if ([string]::IsNullOrWhiteSpace($candidate)) {
    try {
      $uri = [Uri]$Url
      $candidate = [System.IO.Path]::GetFileName($uri.AbsolutePath)
    } catch {
      $candidate = ""
    }
  }

  if ([string]::IsNullOrWhiteSpace($candidate)) {
    $candidate = "download-$Index"
  }

  $invalid = [Regex]::Escape((-join [System.IO.Path]::GetInvalidFileNameChars()))
  $candidate = [Regex]::Replace($candidate.Trim(), "[$invalid]", "_")
  $candidate = [Regex]::Replace($candidate, "\s+", " ")

  if ($candidate.Length -gt 180) {
    $extension = [System.IO.Path]::GetExtension($candidate)
    $stem = [System.IO.Path]::GetFileNameWithoutExtension($candidate)
    $candidate = $stem.Substring(0, [Math]::Min(170, $stem.Length)) + $extension
  }

  return $candidate
}

function Get-ObjectValue {
  param(
    [object]$Object,
    [string[]]$Names
  )

  if ($null -eq $Object) {
    return ""
  }

  foreach ($name in $Names) {
    $property = $Object.PSObject.Properties[$name]
    if ($null -ne $property -and $null -ne $property.Value) {
      return [string]$property.Value
    }
  }

  return ""
}

function Read-DownloadItems {
  param([string]$Path)

  $fullPath = Resolve-FullPath $Path
  if (-not (Test-Path -LiteralPath $fullPath)) {
    throw "Input file not found: $fullPath"
  }

  $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
  $items = @()

  if ($extension -eq ".csv") {
    $rows = Import-Csv -LiteralPath $fullPath
    foreach ($row in $rows) {
      $url = Get-ObjectValue -Object $row -Names @("url", "URL", "link", "Link", "href", "Href")
      $fileName = Get-ObjectValue -Object $row -Names @("fileName", "filename", "name", "title")

      $items += [PSCustomObject]@{
        Url = [string]$url
        FileName = [string]$fileName
      }
    }
    return $items
  }

  if ($extension -eq ".json") {
    $json = Get-Content -LiteralPath $fullPath -Raw | ConvertFrom-Json
    foreach ($row in @($json)) {
      if ($row -is [string]) {
        $items += [PSCustomObject]@{ Url = $row; FileName = "" }
        continue
      }

      $items += [PSCustomObject]@{
        Url = Get-ObjectValue -Object $row -Names @("url", "URL", "link", "Link", "href", "Href")
        FileName = Get-ObjectValue -Object $row -Names @("fileName", "filename", "name", "title")
      }
    }
    return $items
  }

  $lines = Get-Content -LiteralPath $fullPath
  foreach ($line in $lines) {
    $trimmed = $line.Trim()
    if ($trimmed -eq "" -or $trimmed.StartsWith("#")) {
      continue
    }

    $items += [PSCustomObject]@{
      Url = $trimmed
      FileName = ""
    }
  }

  return $items
}

function Get-CleanDownloadItems {
  param([object[]]$RawItems)

  $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  $clean = @()
  $skipped = @()
  $index = 1

  foreach ($item in $RawItems) {
    $url = ([string]$item.Url).Trim()
    if ($url -eq "") {
      continue
    }

    $uri = $null
    if (-not [Uri]::TryCreate($url, [UriKind]::Absolute, [ref]$uri) -or
        ($uri.Scheme -ne "http" -and $uri.Scheme -ne "https")) {
      $skipped += [PSCustomObject]@{ Url = $url; Reason = "Not an absolute http/https URL" }
      continue
    }

    if (-not $seen.Add($uri.AbsoluteUri)) {
      $skipped += [PSCustomObject]@{ Url = $url; Reason = "Duplicate URL" }
      continue
    }

    $fileName = Get-SafeFileName -Name ([string]$item.FileName) -Url $uri.AbsoluteUri -Index $index
    $clean += [PSCustomObject]@{
      Url = $uri.AbsoluteUri
      FileName = $fileName
    }
    $index += 1
  }

  return [PSCustomObject]@{
    Items = $clean
    Skipped = $skipped
  }
}

function Write-IdmScript {
  param(
    [object[]]$Items,
    [string]$ScriptPath,
    [string]$DownloadDir,
    [string]$IdmExe,
    [bool]$ShouldStartQueue
  )

  $lines = @(
    "@echo off",
    "setlocal",
    "set ""IDM=$IdmExe""",
    "set ""OUT=$DownloadDir""",
    "if not exist ""%OUT%"" mkdir ""%OUT%""",
    "if not exist ""%IDM%"" (",
    "  echo IDM executable not found: %IDM%",
    "  exit /b 1",
    ")"
  )

  foreach ($item in $Items) {
    $url = $item.Url.Replace('"', '""')
    $fileName = $item.FileName.Replace('"', '""')
    $lines += """%IDM%"" /d ""$url"" /p ""%OUT%"" /f ""$fileName"" /n /a"
  }

  if ($ShouldStartQueue) {
    $lines += """%IDM%"" /s"
  } else {
    $lines += "echo Added $($Items.Count) task(s) to IDM queue. Start the queue in IDM when ready."
  }

  Set-Content -LiteralPath $ScriptPath -Value $lines -Encoding ASCII
}

function Write-Aria2List {
  param(
    [object[]]$Items,
    [string]$ListPath,
    [string]$DownloadDir
  )

  $lines = @()
  foreach ($item in $Items) {
    $lines += $item.Url
    $lines += "  dir=$DownloadDir"
    $lines += "  out=$($item.FileName)"
  }

  Set-Content -LiteralPath $ListPath -Value $lines -Encoding UTF8
}

$inputFullPath = Resolve-FullPath $InputPath
$outputFullPath = Resolve-FullPath $OutputDir
$outScriptFullPath = Resolve-FullPath $OutScript

New-Item -ItemType Directory -Force -Path $outputFullPath | Out-Null
New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($outScriptFullPath)) | Out-Null

$rawItems = Read-DownloadItems -Path $inputFullPath
$result = Get-CleanDownloadItems -RawItems $rawItems

$cleanListPath = [System.IO.Path]::ChangeExtension($outScriptFullPath, ".clean.csv")
$skipListPath = [System.IO.Path]::ChangeExtension($outScriptFullPath, ".skipped.csv")
$result.Items | Export-Csv -LiteralPath $cleanListPath -NoTypeInformation -Encoding UTF8
$result.Skipped | Export-Csv -LiteralPath $skipListPath -NoTypeInformation -Encoding UTF8

if ($Mode -eq "idm") {
  Write-IdmScript -Items $result.Items -ScriptPath $outScriptFullPath -DownloadDir $outputFullPath -IdmExe $IdmPath -ShouldStartQueue $StartQueue.IsPresent
} elseif ($Mode -eq "aria2") {
  Write-Aria2List -Items $result.Items -ListPath $outScriptFullPath -DownloadDir $outputFullPath
}

Write-Host "Input: $inputFullPath"
Write-Host "Valid URL(s): $($result.Items.Count)"
Write-Host "Skipped URL(s): $($result.Skipped.Count)"
Write-Host "Clean list: $cleanListPath"
Write-Host "Skipped list: $skipListPath"

if ($Mode -ne "clean") {
  Write-Host "Generated: $outScriptFullPath"
}
