$ErrorActionPreference = "Stop"

$root = (Get-Location).Path

$manifestPath = Join-Path $root "manifest.json"
$editorHtmlPath = Join-Path $root "editor.html"
$distDir = Join-Path $root "dist"
$artifactsDir = Join-Path $root "artifacts"

if (-not (Test-Path -LiteralPath $manifestPath)) { throw "Missing manifest.json (zip must include it at root)." }
if (-not (Test-Path -LiteralPath $editorHtmlPath)) { throw "Missing editor.html. Run 'npm run build' first." }
if (-not (Test-Path -LiteralPath $distDir)) { throw "Missing dist/. Run 'npm run build' first." }

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$version = $manifest.version
if (-not $version) { $version = "0.0.0" }

New-Item -ItemType Directory -Force -Path $artifactsDir | Out-Null

$zipPath = Join-Path $artifactsDir ("zync-editor-monaco-plugin-v{0}.zip" -f $version)
if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

# Zip root must contain: manifest.json, editor.html, dist/
Compress-Archive -Force -DestinationPath $zipPath -Path $manifestPath, $editorHtmlPath, $distDir

Write-Host ("[pack] Created {0}" -f (Split-Path -Leaf $zipPath))

