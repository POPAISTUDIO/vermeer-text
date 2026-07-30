#!/usr/bin/env bash
# Etat des patches patch-package : version epinglee par le nom du patch vs version installee.
# Les 3 patches Vermeer sont epingles a une version exacte (CLAUDE.md §11) : tout bump
# deplace les lignes ciblees et fait echouer patch-package en silence au postinstall.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1

RC=0
for p in patches/*.patch; do
  [[ -e "$p" ]] || { echo "aucun patch dans patches/"; exit 0; }
  b="$(basename "$p" .patch)"
  ver="$(grep -oE '[0-9]+\.[0-9]+\.[0-9]+$' <<< "$b")"
  pkg="$(sed -E 's/^(@[^+]+)\+([^+]+)\+[0-9].*$/\1\/\2/; s/^([^+]+)\+[0-9].*$/\1/' <<< "$b")"
  inst="$(node -e "try{console.log(require('./node_modules/$pkg/package.json').version)}catch(e){console.log('ABSENT')}")"
  if [[ "$ver" == "$inst" ]]; then
    echo "OK      $pkg  patch=$ver  installe=$inst"
  else
    echo "DERIVE  $pkg  patch=$ver  installe=$inst  -> revalider/regenerer le patch"
    RC=1
  fi
done

echo
echo "Test de non-regression uuid (@langchain/core, issue #128) :"
node -e "console.log('  typeof require(\"@langchain/core/utils/uuid\").v4 =', typeof require('@langchain/core/utils/uuid').v4)" \
  || echo "  echec de resolution du module"
echo "  (doit afficher 'function' ; 'undefined' = patch non applique)"

exit $RC
