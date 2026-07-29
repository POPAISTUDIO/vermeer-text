#!/usr/bin/env python3
"""Extrait le prompt VIVANT du triage depuis .github/workflows/qa-triage.yml.

Pourquoi ne pas recopier le prompt dans le workflow de rejeu : une copie divergerait, et
le test de garde ne testerait plus le désignateur réel mais son fossile. Le rejeu lit donc
la source, et remplace les deux seules expressions de contexte GitHub qu'elle contient.

Sortie : le prompt substitué sur stdout. Toute substitution manquante fait sortir en
erreur — un placeholder renommé en amont doit casser le test, pas le contourner.

Usage : extraire-prompt.py <qa-triage.yml> <url-du-run> <outcome-artefacts>
"""

import sys

import yaml

ETAPE = "Classification des échecs"
JETONS = {
    "${{ github.event.workflow_run.html_url }}": None,
    "${{ steps.artifacts.outcome }}": None,
}


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__, file=sys.stderr)
        return 2

    chemin, url_run, outcome = sys.argv[1], sys.argv[2], sys.argv[3]
    JETONS["${{ github.event.workflow_run.html_url }}"] = url_run
    JETONS["${{ steps.artifacts.outcome }}"] = outcome

    with open(chemin, encoding="utf-8") as fichier:
        workflow = yaml.safe_load(fichier)

    etapes = workflow["jobs"]["triage"]["steps"]
    correspondantes = [e for e in etapes if e.get("name") == ETAPE]
    if len(correspondantes) != 1:
        print(
            f"ERREUR: {len(correspondantes)} étape(s) nommée(s) « {ETAPE} » dans {chemin} — "
            "le rejeu ne sait plus quel prompt tester. Adapter ce script en même temps que "
            "le workflow.",
            file=sys.stderr,
        )
        return 1

    prompt = correspondantes[0].get("with", {}).get("prompt")
    if not prompt:
        print(f"ERREUR: aucun prompt dans l'étape « {ETAPE} » de {chemin}.", file=sys.stderr)
        return 1

    for jeton, valeur in JETONS.items():
        if jeton not in prompt:
            print(
                f"ERREUR: le jeton {jeton} est absent du prompt de triage. Il a été renommé "
                "ou retiré : mettre ce script à jour, ne pas neutraliser la vérification.",
                file=sys.stderr,
            )
            return 1
        prompt = prompt.replace(jeton, valeur)

    if "${{" in prompt:
        print(
            "ERREUR: une expression GitHub non substituée subsiste dans le prompt — le rejeu "
            "ne doit pas envoyer de placeholder au modèle.",
            file=sys.stderr,
        )
        return 1

    sys.stdout.write(prompt)
    return 0


if __name__ == "__main__":
    sys.exit(main())
