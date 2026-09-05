# Optional overrides. Set in PowerShell before npm run simulator.
# Use an absolute data path outside any source checkout. No device IP is needed.
$env:PIXOO_DATA_DIR = Join-Path $env:LOCALAPPDATA 'PixooPlaylistController'
$env:PIXOO_PORT = '8787'
$env:PIXOO_MODE = 'simulator'
