#!/usr/bin/env bash
# Routeur `gh` du triage désignateur — installé sous le nom `gh` en tête de PATH.
#
# POURQUOI CE FICHIER EXISTE — et pourquoi la bascule ne peut PAS se faire par `env:`.
# Les commandes du cycle de désignation (`gh issue edit --add-label / --remove-label
# claude-fix`) ne sont pas écrites dans des steps du workflow : c'est le MODÈLE qui les
# compose, à l'intérieur d'un unique step `claude-code-action`, qui ne porte qu'un seul
# `GH_TOKEN`. Basculer ce `GH_TOKEN` sur le jeton dédié donnerait ce jeton à TOUTES les
# écritures du triage (commentaires, marqueurs de comptage, Dossier QA, assignations) —
# l'inverse du principe « un jeton par usage, périmètre minimal » (GOVERNANCE.md §1).
#
# Ce routeur fait donc le partage à la commande, mécaniquement :
#   - `gh issue edit|create` portant le label `claude-fix` → jeton DÉDIÉ
#     (GH_DESIGNATION_TOKEN = secret TRIAGE_LABEL_TOKEN) ;
#   - tout le reste, sans exception → jeton du run (GH_TOKEN, secrets.GITHUB_TOKEN).
#
# Motif de la bascule : GitHub n'émet AUCUN événement déclencheur pour les actions faites
# avec `GITHUB_TOKEN`. Une pose de `claude-fix` par ce jeton n'émet pas d'événement
# `issues: labeled`, donc ne réveille pas `claude-autofix` — le second désignateur était
# câblé et muet (OBSERVED 31/07/2026, issue 143 : label posé sur l'issue jetable 147, zéro
# run de claude.yml sur 3 min 3 s).
#
# Le prompt du triage est INCHANGÉ : les commandes sont les mêmes, seul le porteur change.
# C'est voulu — le test de garde qa-triage-replay.yml rejoue ce prompt, et son propre shim
# `gh` reste prioritaire dans son PATH (aucune écriture réelle en rejeu).
set -uo pipefail

REAL_GH="${GH_REAL_BIN:?GH_REAL_BIN non défini — le routeur ne sait pas à quel binaire déléguer}"

# Vrai si la commande est un geste de DÉSIGNATION : `gh issue edit|create` dont une valeur de
# label vaut `claude-fix`. Couvre les deux écritures possibles (`--add-label claude-fix` et
# `--add-label=claude-fix`), les listes de labels (`--add-label a,claude-fix`) et la création
# labellisée (`gh issue create --label claude-fix`, chemin greffier).
est_une_designation() {
  [ "${1:-}" = "issue" ] || return 1
  case "${2:-}" in
    edit | create) ;;
    *) return 1 ;;
  esac

  local attend_valeur=0
  local argument
  for argument in "$@"; do
    if [ "$attend_valeur" = 1 ]; then
      attend_valeur=0
      case "$argument" in *claude-fix*) return 0 ;; esac
      continue
    fi
    case "$argument" in
      --add-label | --remove-label | --label | -l) attend_valeur=1 ;;
      --add-label=* | --remove-label=* | --label=*)
        case "${argument#*=}" in *claude-fix*) return 0 ;; esac
        ;;
    esac
  done
  return 1
}

if est_une_designation "$@"; then
  # Absence du jeton dédié = désignateur muet. On échoue BRUYAMMENT plutôt que de retomber en
  # silence sur GITHUB_TOKEN : un repli discret rétablirait exactement la panne de l'issue 143,
  # et le triage croirait avoir désigné.
  if [ -z "${GH_DESIGNATION_TOKEN:-}" ]; then
    printf '::error::Geste de désignation refusé : le jeton dédié est absent (secret TRIAGE_LABEL_TOKEN / variable GH_DESIGNATION_TOKEN). Aucun repli sur GITHUB_TOKEN — il ne déclencherait pas claude-autofix (issue 143).\n' >&2
    exit 1
  fi
  # Les arguments ne contiennent aucun secret : seul le NOM du jeton est journalisé.
  printf '::notice::Désignation — commande routée sur TRIAGE_LABEL_TOKEN : gh %s\n' "$*" >&2
  # Deux instructions plutôt qu'une affectation en préfixe d'`exec` (`GH_TOKEN=… exec …`, qui
  # transmet bien la valeur — vérifié) : il faut AUSSI retirer `GITHUB_TOKEN` de
  # l'environnement, et cela ne s'écrit pas en préfixe. `gh` retombe sur `GITHUB_TOKEN` quand
  # `GH_TOKEN` est vide : le laisser là rétablirait la panne de l'issue 143 sans le dire.
  export GH_TOKEN="$GH_DESIGNATION_TOKEN"
  unset GITHUB_TOKEN
  exec "$REAL_GH" "$@"
fi

exec "$REAL_GH" "$@"
