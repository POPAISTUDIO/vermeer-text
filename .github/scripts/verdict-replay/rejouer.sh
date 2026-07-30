#!/usr/bin/env bash
# Rejeu du gate « Verdict livrable » de .github/workflows/claude.yml sur fixtures archivées.
#
# Pourquoi : « un interdit qui ne vit que dans un prompt est une intention »
# (docs/GOVERNANCE.md §3). Le gate de livrable n'est PAS un prompt — c'est du shell, donc
# directement exécutable, donc directement testable. Ce rejeu confronte, pour chaque fixture,
# le code de sortie ET le journal des commandes gh au fichier attendu.json.
#
# DRY-RUN vis-à-vis de GitHub : un shim `gh` sert des réponses figées et simule les écritures.
# Aucun jeton n'est requis, rien ne sort de la machine.
#
# Usage :
#   .github/scripts/verdict-replay/rejouer.sh              # toutes les fixtures
#   .github/scripts/verdict-replay/rejouer.sh pr-draft     # une seule
set -uo pipefail

ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/../../.." && pwd)"
FIXTURES="$RACINE/e2e/staging/fixtures/verdict"
WORKFLOW="$RACINE/.github/workflows/claude.yml"
VERIFIER="$RACINE/.github/scripts/triage-replay/verifier.sh"

cas="${1:-tous}"
travail="$(mktemp -d)"
trap 'rm -rf "$travail"' EXIT

# Le shim est installé sous le nom `gh` en tête de PATH : le script rejoué appelle `gh` sans
# savoir qu'il est simulé.
mkdir -p "$travail/bin"
cp "$ICI/gh-dryrun.sh" "$travail/bin/gh"
chmod +x "$travail/bin/gh"

# Le shell testé est EXTRAIT du workflow, jamais recopié.
if ! node "$ICI/extraire-etape.mjs" "$WORKFLOW" > "$travail/etape.sh"; then
  echo "::error::Extraction de l'étape « Verdict livrable » impossible."
  exit 1
fi

echarts=0
rejouees=0

for dossier in "$FIXTURES"/*/; do
  [ -d "$dossier" ] || continue
  nom="$(basename "$dossier")"
  if [ "$cas" != "tous" ] && [ "$cas" != "$nom" ]; then
    continue
  fi
  rejouees=$((rejouees + 1))

  attendu="$dossier/attendu.json"
  if [ ! -f "$attendu" ]; then
    echo "::error::$nom : attendu.json manquant."
    echarts=$((echarts + 1))
    continue
  fi

  echo "══════════════════════════════════════════════════════════════════"
  echo "Fixture : $nom"

  journal="$travail/$nom.log"
  : > "$journal"
  mkdir -p "$travail/runner-$nom"

  PATH="$travail/bin:$PATH" \
  GH_DRYRUN_LOG="$journal" \
  GH_FIXTURE_DIR="$dossier" \
  RUNNER_TEMP="$travail/runner-$nom" \
  GITHUB_SERVER_URL="https://github.com" \
  GITHUB_RUN_ID="999999" \
  GH_TOKEN="rejeu-dry-run" \
  REPO="POPAISTUDIO/vermeer-text" \
  ISSUE="$(jq -r '.issue' "$attendu")" \
    bash "$travail/etape.sh" > "$travail/$nom.sortie" 2>&1
  obtenu=$?

  sed 's/^/     /' "$travail/$nom.sortie"

  espere="$(jq -r '.code_sortie' "$attendu")"
  if [ "$obtenu" != "$espere" ]; then
    echo "::error::$nom : code de sortie $obtenu, attendu $espere."
    echarts=$((echarts + 1))
  else
    echo "  ✓ code de sortie : $obtenu"
  fi

  if ! bash "$VERIFIER" "$dossier" "$journal"; then
    echarts=$((echarts + 1))
  fi
  echo
done

if [ "$rejouees" = 0 ]; then
  echo "::error::Aucune fixture rejouée (« $cas » introuvable sous $FIXTURES)."
  exit 1
fi

if [ "$echarts" -ne 0 ]; then
  echo "::error::Rejeu du verdict en échec : $echarts écart(s) sur $rejouees fixture(s)."
  exit 1
fi

echo "Rejeu du verdict conforme sur $rejouees fixture(s)."
