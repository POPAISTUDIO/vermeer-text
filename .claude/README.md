# `.claude/` — l'outillage atelier de Vermeer

Ce dossier est **versionné**, et c'est le fond de l'affaire : il porte des pouvoirs — des hooks qui
peuvent refuser une commande, des procédures qui autorisent des écritures. Un pouvoir non versionné
est un pouvoir non gouverné ([`docs/GOVERNANCE.md`](../docs/GOVERNANCE.md) §1 règle 6). Ici, tout se
relit en PR.

Seul `settings.local.json` reste local : ce sont des réglages de poste, pas des pouvoirs.

## Ce que contient chaque dossier

| Dossier | Rôle |
|---|---|
| `agents/` | **Sous-agents en lecture seule.** Ils cherchent, vérifient, rendent un verdict argumenté ; ils n'écrivent rien. `librechat-natif` répond à « est-ce que LibreChat le fait déjà nativement ? » (décision 5.1) ; `watchlist-auditor` confronte un fichier natif à son concern de `CLAUDE.md` §11. |
| `skills/` | **Procédures récurrentes**, chargées à la demande. Dont **`vermeer-operations` : le mandat capteur / greffier** — observation en lecture seule, discipline OBSERVED / INFERRED / UNKNOWN, et rédaction d'issues sur ordre explicite. C'est le seul fichier d'ici qui autorise des écritures ; il les énumère, et ce qu'il n'énumère pas est interdit. Les autres (`upstream-merge`, `watchlist`, `i18n-fr`, `config-drift`) sont des méthodes de travail. |
| `commands/` | **Raccourcis** (`/release`, `/roadmap`) : des prompts cadrés, rien de plus. |
| `hooks/` | **Garde-fous automatiques**, câblés dans `settings.json`. `guard-bash` (PreToolUse/Bash) applique deux garde-fous de `CLAUDE.md` §6 : `ask` sur une poussée vers `main`, `deny` sur l'indexation du `.env`. `check-edits` (PostToolUse/Write\|Edit) est non bloquant : il rappelle le concern §11 d'un fichier natif touché, contrôle la parité i18n EN/FR et parse les `librechat*.yaml`. |
| `scripts/` | **Outillage déterministe**, sans modèle dans la boucle : `watchlist.sh` (extraction de §11), `i18n-parity.mjs`, `patches-status.sh`. Un script dit ce qu'il a mesuré ; il ne juge pas. |

## La règle, une seule

> **Tout nouveau hook, toute nouvelle permission, tout nouveau pouvoir = une PR, et la ligne de
> registre dans la même PR.** Jamais d'ajout silencieux. Jamais de génération en masse. Jamais de
> skill auto-évolué.

Les trois « jamais », parce que chacun a une raison précise :

- **Ajout silencieux** — un pouvoir créé hors registre est un incident de gouvernance
  (`GOVERNANCE.md` §7), pas un oubli de documentation. Le registre se tient **au moment où le
  pouvoir change**, pas à la revue suivante.
- **Génération en masse** — un dossier d'outils produits en série n'est plus relisable, et ce qui
  n'est pas relu n'est pas gouverné. Ce qui entre ici entre un fichier à la fois, avec son motif.
- **Skill auto-évolué** — un fichier qui se réécrit lui-même contourne l'écluse par construction :
  le texte relu en PR n'est plus celui qui s'applique. Incompatible avec §1 règle 6, et c'est la
  raison pour laquelle les *self-evolving skills* ne sont pas employés sur ce projet.

## Renvois

- [`docs/GOVERNANCE.md`](../docs/GOVERNANCE.md) **§1 règle 6** — tout support de gouvernance d'un
  acteur (mandat, prompt, skill) est un fichier persistant, identifié au registre.
- [`docs/registre-identites.md`](../docs/registre-identites.md) — un tableau par acteur : identité,
  secrets (**noms seuls**), permis, interdits, fiabilité. Les sessions Claude Code de l'atelier y
  sont l'acteur n° 9 ; c'est cette identité qui porte le mandat capteur / greffier.
- [`CLAUDE.md`](../CLAUDE.md) — mémoire projet : §6 les garde-fous que les hooks appliquent, §11 les
  concerns que `check-edits` rappelle.
