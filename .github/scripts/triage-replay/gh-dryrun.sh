#!/usr/bin/env bash
# Shim `gh` du rejeu de triage — installé sous le nom `gh` en tête de PATH.
#
# Rôle : rendre le rejeu INOFFENSIF pour le tracker tout en gardant le raisonnement du
# triage intact. Les commandes `gh issue` d'ÉCRITURE sont journalisées et simulées ; les
# commandes de LECTURE reçoivent une réponse figée, servie depuis la fixture. Tout ce qui
# n'est pas `gh issue` est délégué au vrai binaire.
#
# Le verdict du test de garde se lit dans le journal ($GH_DRYRUN_LOG), confronté au
# fichier `attendu.json` de la fixture par verifier.sh.
set -uo pipefail

LOG="${GH_DRYRUN_LOG:?GH_DRYRUN_LOG non défini}"
FIXTURE="${GH_FIXTURE_DIR:?GH_FIXTURE_DIR non défini}"
REAL_GH="${GH_REAL_BIN:?GH_REAL_BIN non défini}"

# Le journal ne retient que la STRUCTURE de la commande : les valeurs de `--body`, de
# `--title` et de `--body-file` sont remplacées par `<texte>`. Deux raisons, dans cet ordre :
#   - une ligne par commande, donc des motifs de vérification fiables (un corps multiligne
#     casserait le journal) ;
#   - un corps rédigé par le modèle peut CITER un interdit (« label non reposé via
#     --add-label ») et déclencher un faux positif du vérificateur.
# La commande complète, corps inclus, part dans "$LOG.detail" — pour la lecture humaine à la
# revue mensuelle, jamais pour le verdict.
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

# Tout ce qui n'est pas `gh issue` n'est pas du ressort du triage : au vrai gh.
# (Le job ne porte que `contents: read`, donc une écriture y échouerait de toute façon.)
if [ "${1:-}" != "issue" ]; then
  exec "$REAL_GH" "$@"
fi

sous_commande="${2:-}"
shift 2 2>/dev/null || shift $#
args=("$@")

expression_jq=''
champs_json=''
avec_commentaires=0
etiquette=''
numero=''

for ((i = 0; i < ${#args[@]}; i++)); do
  case "${args[i]}" in
    --jq | -q) expression_jq="${args[i + 1]:-}" ;;
    --json) champs_json="${args[i + 1]:-}" ;;
    --comments) avec_commentaires=1 ;;
    --label | -l) etiquette="${args[i + 1]:-}" ;;
    [0-9]*) [ -z "$numero" ] && numero="${args[i]}" ;;
  esac
done

case "$sous_commande" in
  list)
    fichier="list.json"
    [ -n "$etiquette" ] && fichier="list-${etiquette}.json"
    chemin="$FIXTURE/gh/$fichier"
    if [ ! -f "$chemin" ]; then
      printf 'SHIM: aucune réponse figée pour « gh issue list --label %s » (attendu : %s)\n' \
        "$etiquette" "$chemin" >&2
      exit 1
    fi
    if [ -n "$expression_jq" ]; then
      jq -r "$expression_jq" <"$chemin"
    elif [ -n "$champs_json" ]; then
      cat "$chemin"
    else
      jq -r '.[] | [(.number|tostring), .state, .title] | @tsv' <"$chemin"
    fi
    ;;
  view)
    chemin="$FIXTURE/gh/view-${numero}.json"
    if [ ! -f "$chemin" ]; then
      printf 'SHIM: aucune réponse figée pour « gh issue view %s » (attendu : %s)\n' \
        "$numero" "$chemin" >&2
      exit 1
    fi
    if [ -n "$expression_jq" ]; then
      jq -r "$expression_jq" <"$chemin"
    elif [ -n "$champs_json" ]; then
      cat "$chemin"
    elif [ "$avec_commentaires" = 1 ]; then
      jq -r '"#\(.number) \(.title) [\(.state)]\n\n\(.body)\n\n--- commentaires ---\n" + ([.comments[] | "[\(.createdAt)] \(.author.login):\n\(.body)"] | join("\n\n"))' <"$chemin"
    else
      jq -r '"#\(.number) \(.title) [\(.state)]\nlabels: " + ([.labels[].name] | join(",")) + "\n\n\(.body)"' <"$chemin"
    fi
    ;;
  create)
    printf 'DRY-RUN — aucune issue créée. https://github.com/%s/issues/999\n' \
      "${GITHUB_REPOSITORY:-POPAISTUDIO/vermeer-text}"
    ;;
  comment | edit | close | reopen | pin | unpin | lock | unlock | transfer | delete | develop)
    printf 'DRY-RUN — « gh issue %s » journalisé, non exécuté.\n' "$sous_commande"
    ;;
  *)
    printf 'SHIM: sous-commande « gh issue %s » non prévue par le rejeu.\n' "$sous_commande" >&2
    exit 1
    ;;
esac
