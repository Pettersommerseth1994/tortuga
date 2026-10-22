#!/bin/sh
# Starter dev-serveren med en ekte Node-installasjon først på PATH.
#
# Turbopack starter egne Node-underprosesser for blant annet PostCSS-
# transformen. Finner den ikke en fungerende `node` der, feiler den med
# "spawning node pooled process: No such file or directory" — og feilmeldingen
# peker misvisende på andre filer enn den egentlige årsaken.
#
# Stien legges til ubetinget, ikke bare når `node` mangler: et miljø kan ha en
# shim på PATH som starter Next fint, men som ikke duger for underprosessene.
if [ -x "$HOME/.local/node/bin/node" ]; then
  PATH="$HOME/.local/node/bin:$PATH"
  export PATH
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Fant ikke node. Installer Node 20+ og legg det på PATH." >&2
  exit 1
fi

echo "dev.sh bruker node: $(command -v node) ($(node -v))" >&2
exec node node_modules/next/dist/bin/next dev --port "${PORT:-3000}"
