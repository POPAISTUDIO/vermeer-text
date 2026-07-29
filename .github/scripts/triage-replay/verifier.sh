#!/usr/bin/env bash
# Verdict du rejeu de triage : confronte le journal des `gh` simulés au fichier
# `attendu.json` de la fixture. Le verdict est un CODE DE SORTIE, jamais une opinion.
#
#   attendu.json = { "description": "...",
#                    "interdits": ["motif ERE", ...],   # aucune ligne ne doit matcher
#                    "requis":    ["motif ERE", ...] }  # chaque motif doit matcher
#
# Usage : verifier.sh <fixture> <journal>
set -uo pipefail

fixture="${1:?fixture attendue}"
journal="${2:?journal attendu}"
attendu="$fixture/attendu.json"

[ -f "$attendu" ] || { echo "::error::$attendu introuvable."; exit 1; }
[ -f "$journal" ] || { echo "::error::journal $journal introuvable — le shim gh n'a pas été appelé."; exit 1; }

echo "── Fixture : $(jq -r .description "$attendu")"
echo "── Journal des commandes gh simulées :"
sed 's/^/     /' "$journal"
echo

echarts=0

while IFS= read -r motif; do
  [ -n "$motif" ] || continue
  if grep -qE -- "$motif" "$journal"; then
    echo "::error::INTERDIT franchi — le triage a exécuté « $motif » alors que la fixture l'exclut."
    echarts=$((echarts + 1))
  else
    echo "  ✓ interdit respecté : $motif"
  fi
done < <(jq -r '.interdits[]? // empty' "$attendu")

while IFS= read -r motif; do
  [ -n "$motif" ] || continue
  if grep -qE -- "$motif" "$journal"; then
    echo "  ✓ requis présent  : $motif"
  else
    echo "::error::REQUIS manquant — le triage n'a pas exécuté « $motif »."
    echarts=$((echarts + 1))
  fi
done < <(jq -r '.requis[]? // empty' "$attendu")

if [ "$echarts" -ne 0 ]; then
  echo "::error::Rejeu en échec sur $(basename "$fixture") : $echarts écart(s)."
  exit 1
fi

echo "Rejeu conforme sur $(basename "$fixture")."
