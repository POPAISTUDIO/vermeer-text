#!/usr/bin/env bash
# Shim `gh` du rejeu du verdict de livrable — installé sous le nom `gh` en tête de PATH.
#
# Rôle : rendre le rejeu INOFFENSIF pour le tracker tout en gardant le raisonnement du gate
# intact. Les ÉCRITURES (`gh issue comment/edit`, `gh pr edit`) sont journalisées et simulées ;
# les LECTURES (`gh pr list`, `gh api .../comments`) reçoivent une réponse figée servie depuis
# la fixture. Rien n'atteint GitHub — aucun jeton n'est même nécessaire.
#
# Le verdict se lit dans le journal ($GH_DRYRUN_LOG) + le code de sortie du script rejoué,
# confrontés à l'`attendu.json` de la fixture (verifier.sh + rejouer.sh).
#
# Décalque de .github/scripts/triage-replay/gh-dryrun.sh, dont il partage le format de journal
# (une ligne par commande, corps masqué en <texte>) et donc le vérificateur.
set -uo pipefail

LOG="${GH_DRYRUN_LOG:?GH_DRYRUN_LOG non défini}"
FIXTURE="${GH_FIXTURE_DIR:?GH_FIXTURE_DIR non défini}"

# Le journal ne retient que la STRUCTURE de la commande : les valeurs de --body / --body-file
# sont remplacées par <texte>. Une ligne par commande, donc des motifs fiables ; et un corps
# rédigé peut CITER un motif interdit et déclencher un faux positif. La commande complète,
# corps inclus, part dans "$LOG.detail" — lecture humaine seulement, jamais le verdict.
printf 'gh %s\n' "$*" >> "$LOG.detail"

journal=()
valeur_a_masquer=0
for argument in "$@"; do
  if [ "$valeur_a_masquer" = 1 ]; then
    journal+=("<texte>")
    valeur_a_masquer=0
    continue
  fi
  case "$argument" in
    --body | --body-file | --title | -b | -t) journal+=("$argument"); valeur_a_masquer=1 ;;
    --body=* | --body-file=*) journal+=("--body=<texte>") ;;
    --title=*) journal+=("--title=<texte>") ;;
    *) journal+=("$argument") ;;
  esac
done
printf 'gh %s\n' "${journal[*]}" >> "$LOG"

# Un `--body-file -` lit stdin : il faut le consommer, sinon le heredoc du script rejoué
# part dans le vide et le shell peut recevoir un SIGPIPE.
for argument in "$@"; do
  if [ "$argument" = "-" ]; then
    cat > /dev/null
    break
  fi
done

servir() {
  local fichier="$1" expression="$2"
  local chemin="$FIXTURE/gh/$fichier"
  if [ ! -f "$chemin" ]; then
    printf 'SHIM: aucune réponse figée pour « %s » (attendu : %s)\n' "$*" "$chemin" >&2
    return 1
  fi
  if [ -n "$expression" ]; then
    jq -r "$expression" < "$chemin"
  else
    cat "$chemin"
  fi
}

# --jq / -q peut arriver n'importe où dans la ligne de commande.
expression_jq=''
arguments=("$@")
for ((i = 0; i < ${#arguments[@]}; i++)); do
  case "${arguments[i]}" in
    --jq | -q) expression_jq="${arguments[i + 1]:-}" ;;
  esac
done

case "${1:-}" in
  pr)
    case "${2:-}" in
      list) servir "pr-list.json" "$expression_jq" ;;
      edit | comment | ready | merge | close | reopen)
        printf 'DRY-RUN — « gh pr %s » journalisé, non exécuté.\n' "${2:-}"
        ;;
      *) printf 'SHIM: « gh pr %s » non prévu par le rejeu.\n' "${2:-}" >&2; exit 1 ;;
    esac
    ;;
  issue)
    case "${2:-}" in
      view | list) servir "issue-${2}.json" "$expression_jq" ;;
      comment | edit | close | reopen)
        printf 'DRY-RUN — « gh issue %s » journalisé, non exécuté.\n' "${2:-}"
        ;;
      *) printf 'SHIM: « gh issue %s » non prévu par le rejeu.\n' "${2:-}" >&2; exit 1 ;;
    esac
    ;;
  api)
    # Seule lecture REST du gate : les commentaires de l'issue. Le chemin porte l'issue et des
    # paramètres de tri ; on ne reconnaît que la ressource, pas la query exacte.
    if printf '%s' "${2:-}" | grep -qE '^repos/.+/issues/[0-9]+/comments'; then
      servir "comments.json" "$expression_jq"
    else
      printf 'SHIM: « gh api %s » non prévu par le rejeu.\n' "${2:-}" >&2
      exit 1
    fi
    ;;
  *)
    printf 'SHIM: « gh %s » non prévu par le rejeu.\n' "${1:-}" >&2
    exit 1
    ;;
esac
