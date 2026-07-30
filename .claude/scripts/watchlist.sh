#!/usr/bin/env bash
# Extrait la watchlist "code natif LibreChat modifie" depuis CLAUDE.md §11.
# CLAUDE.md est la SEULE source de verite : rien n'est recopie ici.
#
# CE QUE CE SCRIPT RETOURNE, exactement : les chemins de fichiers du depot qui OUVRENT une entree
# de la watchlist §11 — c'est-a-dire le chemin place en tete d'un item de liste, avant la
# parenthese qui decrit son concern. Un fichier cite ailleurs n'est PAS retourne.
#
# Sont donc exclus, par construction et non par liste noire :
#   - les items en italique : "_Helper ... hors decompte_", "_Script ops ... (hors watchlist)_",
#     "_NOTE release_" — nouveaux fichiers Vermeer, sans risque de conflit merge ;
#   - tout fichier cite a l'INTERIEUR d'une description de concern : les primitives partagees
#     qu'on interdit de toucher (Button.tsx, Label.tsx), les fichiers de spec, les builds des
#     dependances patchees (dist/*.cjs) ;
#   - les blocs "Patch TEMPORAIRE" : leurs sous-items n'ouvrent sur aucun chemin du depot.
# Les entrees en accolades (dir/{A,B}.tsx) sortent telles quelles et sont eclatees a la comparaison.
#
# Usage :
#   .claude/scripts/watchlist.sh              # liste les chemins de la watchlist
#   .claude/scripts/watchlist.sh <ref>        # intersection watchlist x fichiers modifies par <ref>
#                                             # ex. upstream/main, HEAD..upstream/main
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1

section() {
  awk '/^- \*\*Code natif LibreChat modifié/,/^## 12/' CLAUDE.md
}

paths() {
  section \
    | grep -E '^[[:space:]]+- ' \
    | grep -vE '^[[:space:]]+- _' \
    | sed -E 's/ \(.*$//' \
    | grep -oE '`[a-z@][a-zA-Z0-9@_./{},+-]+\.(ts|tsx|js|jsx|json|mjs|cjs)`' \
    | tr -d '`' \
    | grep -E '^(api|client|packages|config)/' \
    | sort -u
}

if [[ $# -eq 0 ]]; then
  paths
  exit 0
fi

REF="$1"
RANGE="$REF"
[[ "$REF" != *".."* ]] && RANGE="HEAD...$REF"

if ! git rev-parse --verify --quiet "${REF%%..*}" >/dev/null; then
  echo "ref inconnue : $REF (git fetch upstream ?)" >&2
  exit 2
fi

CHANGED="$(git diff --name-only "$RANGE")"
echo "# Fichiers de la watchlist touches par $RANGE :"
HIT=0
while IFS= read -r p; do
  # les entrees en accolades ({A,B}.tsx) sont eclatees pour la comparaison
  if [[ "$p" == *"{"* ]]; then
    dir="${p%%\{*}"; names="${p#*\{}"; names="${names%%\}*}"; ext="${p##*\}}"
    IFS=',' read -ra parts <<< "$names"
    for n in "${parts[@]}"; do
      cand="${dir}${n}${ext}"
      grep -qxF "$cand" <<< "$CHANGED" && { echo "$cand"; HIT=1; }
    done
    continue
  fi
  grep -qxF "$p" <<< "$CHANGED" && { echo "$p"; HIT=1; }
done < <(paths)
[[ $HIT -eq 0 ]] && echo "(aucun — le merge ne touche aucun fichier sous concern Vermeer)"
exit 0
