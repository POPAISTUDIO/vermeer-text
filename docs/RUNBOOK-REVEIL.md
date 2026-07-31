# Runbook de réveil

**Pour qui reprend le projet après une période de standby.** Lisez cette page en entier avant de toucher à quoi que ce soit — elle est courte, et l'ordre des gestes compte.

État de départ : **standby depuis le 31/07/2026**. La production tourne en `v0.10.23`, plus aucun flux de développement n'est actif, et l'essentiel du dispositif est **endormi et non démonté** — c'est-à-dire qu'il repart sans reconstruction.

---

## Geste n° 1 — vérifier le canal d'alerte. Avant tout le reste.

**Un silence de la sonde ne prouve rien tant que sa voix n'a pas été vérifiée.**

La sonde de production tourne chaque jour à 05h30 UTC pendant tout le standby. Si elle est verte, personne ne reçoit rien — c'est voulu. Mais l'absence de mail a **deux causes indiscernables** : tout va bien, ou l'alerte ne part plus. Une boîte qui a changé, des notifications GitHub mises en sourdine pendant l'absence, un jeton expiré : et le dispositif devient muet sans devenir rouge.

```
Actions → Sonde de production → Run workflow → forcer_rouge = true
```

Attendu, et **confirmé OBSERVED le 31/07/2026** — les deux mails arrivent :

| Canal                                                | Objet                                    | Statut               |
| ---------------------------------------------------- | ---------------------------------------- | -------------------- |
| Mail de **création d'issue** (`github-actions[bot]`) | l'issue `🔴 Sonde de production KO`      | **canal recommandé** |
| Mail **Actions**                                     | `Run failed: Sonde de production — main` | secondaire           |

`forcer_rouge` sort **avant tout appel LLM** et sans rien créer en production : l'issue portera « fournisseurs en cause : indéterminés » et la mention d'échec **simulé**. C'est normal. Fermez l'issue de test, et notez la date de vérification.

**Si aucun mail n'arrive** : le reste du runbook est sans objet tant que ce point n'est pas réglé. Détail des canaux et suggestion de règle de boîte : [`e2e/prod/README.md`](../e2e/prod/README.md).

## Geste n° 2 — la sonde à blanc, puis la QA

**Sonde sans `forcer_rouge`** — `workflow_dispatch`, aucune option. Verdict attendu : `3/3 fournisseurs VERT`, nettoyage confirmé, coût relevé. C'est la vérification que la production répond, et **c'est aussi le smoke** : il n'y en a pas d'autre à chercher.

Si elle est rouge, l'ordre de diagnostic est dans [`e2e/prod/README.md`](../e2e/prod/README.md) et commence par le **Point 0** — vérifier l'image réellement servie par les pods. Une sonde rouge signifie très souvent que l'environnement ne fait pas tourner le build attendu.

**Puis la QA nightly** — `workflow_dispatch` sur `qa-nightly.yml`. Son `schedule` est **retiré** (mise en sommeil du 31/07/2026) : elle ne tourne que sur ordre. Le verdict se lit au **Dossier QA, issue [#112](https://github.com/POPAISTUDIO/vermeer-text/issues/112)**, qui est le journal de référence des runs et de leurs verdicts.

Attention en lisant un verdict ancien : le périmètre P0 est de **11 cas** et non 13 — WEB-01a et WEB-01b portent `@known-issue-114` et sont hors verdict. Ce n'est pas un oubli, c'est l'application de la règle « pas de rouge d'habitude » (`GOVERNANCE.md` §5).

## Geste n° 3 — reprendre le développement normal

**Rien à réactiver.** Le circuit passe par l'écluse comme avant : branche → PR → relecture humaine → merge. Le ruleset de `main` est en vigueur et n'a pas été touché.

- **Le release train repart seul.** Il se déclenche sur les événements du dépôt ; il n'a ni cron à remettre ni interrupteur à rallumer. Son jeton `GITOPS_PUSH_TOKEN` a été **conservé délibérément pendant le standby, précisément pour ce réveil** (registre, inventaire des jetons fine-grained).
- **Les agents se réveillent au premier label posé.** Une issue sans label dort — c'est un invariant, pas une mise en veille. Poser `claude-fix` sur une issue suffit à remettre la boucle en marche. Aucun agent n'a été désarmé.

## Geste n° 4 — et seulement si le développement redevient quotidien

**Remettre le `schedule` de la QA nightly.** Une PR de trois lignes : réintroduire le bloc `schedule` dans `qa-nightly.yml`.

**Ne le faites pas par réflexe.** La nightly a été endormie parce qu'une recette qui tourne chaque nuit sans personne pour lire son verdict produit du bruit, pas du signal — et, avec la désignation automatique, chaque rouge non tracé déclenche du travail d'agent. Le critère n'est pas « le projet a redémarré » mais **« quelqu'un lit le verdict le matin »**. Tant que la réponse est non, le `workflow_dispatch` du geste n° 2 suffit.

## Geste n° 5 — instruire la dette n° 3

**Établir ce qu'est le jeton `vermeerchat-qa-session`, puis le révoquer si rien ne le consomme.** Dans cet ordre : sa fiche se lit sur `github.com/settings/tokens?type=beta`.

**Pourquoi ce geste est dans ce runbook et pas seulement au backlog.** C'est un **pouvoir vivant qui n'est décrit nulle part** — `Never used`, rattaché à aucun secret présent et à aucun acteur du registre. Un tel pouvoir qui traverse six mois de standby ne doit pas être **découvert le jour du redémarrage**, au moment précis où l'attention est ailleurs et où l'on a le moins de temps pour instruire une question ouverte. C'est un **écart au sens de [`GOVERNANCE.md`](GOVERNANCE.md) §1**, et il coûte deux minutes à lever.

Ce geste ne dépend d'aucun des quatre précédents : faites-le quand vous voulez, y compris en premier.

Motif complet, portée et condition de levée : [`DETTES-OUVERTES.md`](DETTES-OUVERTES.md), dette n° 3.

---

## Éveillé / endormi / gelé

C'est le tableau à consulter avant de se demander si quelque chose est cassé.

### 🟢 Éveillé — tourne pendant le standby

| Quoi                                                     | Régime                                                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Sonde de production** (`prod-sonde.yml`)               | cron quotidien 05h30 UTC, **sept jours sur sept** — la production ne connaît pas le week-end |
| **Canary providers staging** (`canary-providers.yml`)    | cron 05h00 UTC, lundi-vendredi — **le seul œil sur staging**                                 |
| **Flux** (dev, staging, production)                      | réconciliation continue, intervalle **5 min** en production                                  |
| **Écluse `main`** (ruleset)                              | en vigueur, jamais suspendue                                                                 |
| **Comptes de service** 13a (staging) et 13b (production) | vivants, mots de passe **non rotables**                                                      |

### 🟡 Endormi — repart sans reconstruction

| Quoi                                 | Comment le réveiller                                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **QA nightly**                       | `workflow_dispatch` immédiat ; `schedule` à remettre seulement si le dev redevient quotidien (geste n° 4) |
| **Release train**                    | rien à faire, il repart sur les événements du dépôt                                                       |
| **Agents (codeur, autofix, triage)** | au premier label posé                                                                                     |
| **Développement**                    | par l'écluse, comme avant                                                                                 |

### 🔴 Gelé — décidé, pas oublié

| Quoi                                            | Ce qui existe à la place                                                                                                                                                                                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chantier 7 — agent MEP**                      | [`RUNBOOK-MEP-MANUEL.md`](RUNBOOK-MEP-MANUEL.md). Le jeton branches-only **n'a jamais été créé** : `vermeer-gitops-prod` ne porte donc **aucun secret**, et c'est la règle « aucun agent n'écrit vers la production » lisible dans l'infrastructure |
| **Chantier 8 — agent comm'**                    | rien. Les communications de release restent manuelles                                                                                                                                                                                               |
| **Chantier 4 — extensions**                     | le socle est livré (triage, désignation, garde-fous) ; les extensions prévues sont gelées                                                                                                                                                           |
| **Scan de nuit Loki**                           | **abandonné**, pas reporté — voir [`architecture-cible-v2.md`](architecture-cible-v2.md) §5                                                                                                                                                         |
| **Check de drift hebdomadaire staging ↔ prod** | au backlog avec son motif ([`DETTES-OUVERTES.md`](DETTES-OUVERTES.md))                                                                                                                                                                              |

**Ce qui est gelé l'est par décision datée, et les marqueurs `⏳` de `GOVERNANCE.md` disent lesquelles.** Un marqueur `⏳` n'est pas une tâche en cours : c'est un trou connu, et il vaut mieux qu'un texte qui prétendrait le contraire.

## Avant de faire confiance à quoi que ce soit

Trois faits qui périment plus vite que le reste, et qu'il faut revérifier plutôt que croire :

1. **Les échéances de jetons.** Aucune n'est lisible par l'API — `gh secret list` ne rend que la date de dernière mise à jour. Les échéances du registre sont **INFERRED à ~juillet 2027** sauf une. Après six mois de standby, la question « lequel a expiré ? » est ouverte et se répond en interface GitHub, pas en ligne de commande.
2. **Les mots de passe des comptes de service ne sont pas rotables par l'application.** Un compte perdu ou banni se remédie par le **rejeu complet de la fenêtre d'inscription**, en production pour 13b. Procédure : registre, entrées 13a et 13b. Ne l'improvisez pas.
3. **Les dettes ouvertes ne se sont pas résorbées toutes seules.** Elles sont rassemblées dans [`DETTES-OUVERTES.md`](DETTES-OUVERTES.md), chacune avec son motif et sa condition de levée.

## Renvois

| Sujet                                        | Où                                                        |
| -------------------------------------------- | --------------------------------------------------------- |
| Sonde, canal d'alerte, diagnostic d'un rouge | [`e2e/prod/README.md`](../e2e/prod/README.md)             |
| Mise en production manuelle                  | [`RUNBOOK-MEP-MANUEL.md`](RUNBOOK-MEP-MANUEL.md)          |
| Identités, pouvoirs, remédiations            | [`registre-identites.md`](registre-identites.md)          |
| Règles, écluse, invariants, marqueurs `⏳`   | [`GOVERNANCE.md`](GOVERNANCE.md)                          |
| Feuille de route réelle sous standby         | [`architecture-cible-v2.md`](architecture-cible-v2.md) §5 |
| Dettes ouvertes                              | [`DETTES-OUVERTES.md`](DETTES-OUVERTES.md)                |
| Recette staging                              | [`../e2e/staging/README.md`](../e2e/staging/README.md)    |
| Écarts de configuration                      | [`CONFIG-DRIFT.md`](CONFIG-DRIFT.md)                      |
