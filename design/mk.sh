#!/bin/bash
# <Name>.dc.html = _tokens.css + <Name>.css + (_v3.css unless opted out) + <Name>.body.html
set -euo pipefail
cd "$(dirname "$0")"
NO_V3=" Landing Review Plan "
for name in "$@"; do
  {
    cat <<'HEAD'
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
  <style>
HEAD
    cat _tokens.css
    if [ -f "$name.css" ]; then cat "$name.css"; fi
    case "$NO_V3" in *" $name "*) : ;; *) cat _v3.css ;; esac
    cat <<'MID'
  </style>
</helmet>
MID
    awk '/<!--include:/{ f=$0; sub(/.*<!--include:/,"",f); sub(/-->.*/,"",f); while((getline l < f)>0) print l; close(f); next } {print}' "$name.body.html"
    cat <<'FOOT'
</x-dc>
</body>
</html>
FOOT
  } > "$name.dc.html"
done
echo "built: $*"
