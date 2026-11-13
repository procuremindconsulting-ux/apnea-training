#!/usr/bin/env bash
# Prepara la cartella sito/ con SOLO i file dell'app da pubblicare.
# La cartella dati/ (sedute, esiti, piani) non deve mai essere pubblicata:
# l'app la legge via API GitHub con il token salvato sul telefono.
# Uso in Cloudflare Pages: build command "bash scripts/build-sito.sh", output directory "sito".
set -euo pipefail
cd "$(dirname "$0")/.."

INCLUDI=(index.html app.css app.js manifest.webmanifest sw.js icons pwa alimentazione esempi img)

rm -rf sito
mkdir -p sito
for voce in "${INCLUDI[@]}"; do
  if [ -e "$voce" ]; then
    cp -R "$voce" sito/
  else
    echo "nota: $voce non presente, saltato"
  fi
done

# Blocchi di sicurezza: niente dati personali né file di sviluppo nel sito.
if find sito -type d -name dati | grep -q .; then
  echo "ERRORE: in sito/ c'è una cartella dati: build interrotta." >&2
  exit 1
fi
if grep -rIlE "github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{30,}" sito >/dev/null 2>&1; then
  echo "ERRORE: in sito/ c'è qualcosa che sembra un token GitHub: build interrotta." >&2
  exit 1
fi
echo "sito/ pronto: $(find sito -type f | wc -l) file"
