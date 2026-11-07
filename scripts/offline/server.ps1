# 離線版簡報的小型網頁伺服器：Windows 內建 PowerShell 就能跑，不用安裝任何東西
# 雙擊「啟動簡報.bat」會執行這支，關掉這個視窗就停止
param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot 'site'
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json'; '.webmanifest' = 'application/manifest+json'; '.svg' = 'image/svg+xml'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'; '.ico' = 'image/x-icon'
  '.mp4' = 'video/mp4'; '.mp3' = 'audio/mpeg'; '.woff2' = 'font/woff2'; '.txt' = 'text/plain; charset=utf-8'
}

$listener = $null
foreach ($port in 8790..8799) {
  $try = New-Object System.Net.HttpListener
  $try.Prefixes.Add("http://localhost:$port/")
  try { $try.Start(); $listener = $try; break } catch { $try.Close() }
}
if (-not $listener) { Write-Host '找不到可用的連接埠（8790～8799 都被占用），請關掉其他程式後再試。'; Read-Host '按 Enter 關閉'; exit 1 }

$url = "http://localhost:$port/index.html"
Write-Host ''
Write-Host '  AI 數位教學實務工作坊｜離線版簡報' -ForegroundColor Cyan
Write-Host "  網址：$url"
Write-Host '  瀏覽器會自動打開；簡報使用期間不要關掉這個視窗。'
Write-Host '  沒有網路時，聊天室、投票、文字雲、問卷不會連線，其他內容與影片都能正常播放。'
Write-Host ''
if (-not $NoBrowser) { Start-Process $url }

while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
    if (-not $path) { $path = 'index.html' }
    if ($path -eq '__quit') { $res.Close(); $listener.Stop(); break }   # 只接受本機連線，供測試結束用
    $file = [IO.Path]::GetFullPath((Join-Path $root $path))
    if (-not $file.StartsWith([IO.Path]::GetFullPath($root)) -or -not [IO.File]::Exists($file)) {
      $res.StatusCode = 404
      $msg = [Text.Encoding]::UTF8.GetBytes('找不到檔案')
      $res.OutputStream.Write($msg, 0, $msg.Length)
    } else {
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $res.ContentType = $(if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' })
      $res.AddHeader('Cache-Control', 'no-cache')
      $res.AddHeader('Accept-Ranges', 'bytes')
      $fs = [IO.File]::OpenRead($file)
      try {
        $len = $fs.Length
        $start = 0; $end = $len - 1
        # 影片要支援分段讀取，才能拖曳進度與從頭重播
        $range = $req.Headers['Range']
        if ($range -and $range -match 'bytes=(\d*)-(\d*)') {
          if ($Matches[1]) { $start = [int64]$Matches[1] }
          if ($Matches[2]) { $end = [Math]::Min([int64]$Matches[2], $len - 1) }
          if (-not $Matches[1] -and $Matches[2]) { $start = $len - [int64]$Matches[2]; $end = $len - 1 }
          $res.StatusCode = 206
          $res.AddHeader('Content-Range', "bytes $start-$end/$len")
        }
        $count = $end - $start + 1
        $res.ContentLength64 = $count
        if ($req.HttpMethod -ne 'HEAD') {
          $fs.Seek($start, 'Begin') | Out-Null
          $buf = New-Object byte[] 262144
          $left = $count
          while ($left -gt 0) {
            $n = $fs.Read($buf, 0, [Math]::Min($buf.Length, $left))
            if ($n -le 0) { break }
            $res.OutputStream.Write($buf, 0, $n)
            $left -= $n
          }
        }
      } finally { $fs.Close() }
    }
  } catch {
    # 瀏覽器中途取消（例如影片跳段）是正常的，不用理會
  } finally {
    try { $res.Close() } catch {}
  }
}
