# Lấy IP WSL
$wslIP = wsl hostname -I | ForEach-Object { $_.Trim() }

# Port cần forward
$port = 21115

# Xóa rule cũ
netsh interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0 2>$null

# Tạo rule mới
netsh interface portproxy add v4tov4 `
    listenport=$port listenaddress=0.0.0.0 `
    connectport=$port connectaddress=$wslIP

# Mở firewall
if (-not (Get-NetFirewallRule -DisplayName "WSL Port $port" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName "WSL Port $port" `
        -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow
}

Write-Host "WSL IP: $wslIP"
Write-Host "Forwarded: 0.0.0.0:$port → ${wslIP}:$port"