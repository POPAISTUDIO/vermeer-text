# Runbook — mise en production manuelle

**Héritage du chantier 7, gelé.** L'agent MEP n'existe pas et n'a pas été créé : son jeton branches-only n'a jamais été émis, et `vermeer-gitops-prod` ne porte donc **aucun secret**. Ce runbook est ce qui tient sa place — et il est entièrement humain, par construction.

Une page, cinq étapes, dans cet ordre.

---

## 1. Tag de version

```bash
git checkout main && git pull origin main    # code mergé et relu
git tag v0.10.24                             # préfixe v obligatoire
git push origin v0.10.24                     # c'est CE push qui produit l'image ECR
```

Le tag se pose sur un commit de `main` **déjà relu et mergé** — jamais sur du local. Le numéro doit rester cohérent avec le champ `version` de `package.json`. Le build est à suivre dans l'onglet **Actions** ; une fois vert, l'image `…/vermeer-text:v0.10.24` est disponible sur ECR.

⚠️ **Jamais un tag mutable** (`latest`, `feat-build`) pour une release de production : sans tag immuable, il n'y a ni traçabilité ni rollback.

## 2. Digest, relu ligne à ligne

Le digest est la liste des changements que la MEP fait passer de staging à production — typiquement une PR sur `vermeer-gitops-prod` qui aligne `prod/llm/` sur ce que staging a certifié.

**Relu ligne à ligne, sans exception.** Ce n'est pas une formalité : la production est le seul environnement où une erreur de configuration se paie devant les utilisateurs, et le fail-fast du yaml fait sortir le process en code 1 — un yaml invalide, c'est l'application par terre, sans mode dégradé.

Deux règles apprises et non négociables :

- **ce qui n'est pas dans le digest ne part pas.** Une variable « pendant qu'on y est » est un changement non relu ;
- **une variable absente ne vaut pas désactivée.** Vérifié le 31/07/2026 sur `VERMEER_BUDGET_RESET_ENABLED` : c'est un **kill-switch à défaut activé**, donc son absence en production laissait le scheduler tourner alors qu'un ticket le décrivait comme « à activer ». Avant de conclure qu'une clé absente est inerte, **lire son défaut dans le code**.

## 3. Merge par l'écluse — et le bypass se trace

Le merge passe par l'écluse humaine ([`GOVERNANCE.md`](GOVERNANCE.md) §4). Le ruleset de `vermeer-gitops-prod` exige la PR ; le bypass actor existe pour les cas où le circuit normal est impraticable.

**Tout usage du bypass se trace, dans le format déjà posé** : date, PR concernée, ce qui empêchait le circuit normal, ce qui a été mergé sans le contrôle, et la règle qui en découle. Le premier exemplaire est l'issue **n° 69** de `vermeer-gitops-prod` (« Incident de gouvernance — bypass merge MEP v0.10.23 ») ; les suivantes reprennent ce format.

Un bypass non tracé est un incident de gouvernance, pas un raccourci.

## 4. Attendre la CONVERGENCE, pas la première réponse

**C'est la leçon du 31/07/2026, et elle change la façon de vérifier une MEP.**

L'intervalle de réconciliation Flux en production est de **5 minutes** (`spec.interval` de la HelmRelease — OBSERVED). Mais un changement n'atteint pas la production d'un coup : pendant le rolling update, les **~3 pods servent deux configurations différentes** et le load balancer distribue sur le mélange. Mesuré sur la manœuvre de fenêtre d'inscription du chantier 5 :

|             | Première réponse nouvelle config | Convergence des 3 pods | Phase mixte    |
| ----------- | -------------------------------- | ---------------------- | -------------- |
| Ouverture   | +4 min 03 s                      | +5 min 40 s            | **1 min 37 s** |
| Refermeture | +4 min 46 s                      | +8 min 13 s            | **3 min 27 s** |

Trois conséquences pratiques :

1. **une preuve de bascule exige N réponses consécutives identiques**, jamais une seule. Un `curl` unique tombant sur le bon pod est un faux positif ; sur le mauvais, un faux négatif ;
2. **une action gardée par la clé qu'on vient de basculer peut répondre l'ancien comportement** alors que la config « est » déployée. Il faut réessayer, et ne pas conclure du premier échec ;
3. **l'exposition se mesure, elle ne se déduit pas des horodatages de merge.** Sur la même manœuvre : **22 min 46 s d'exposition réelle** contre 18 min 36 s entre les deux merges — la refermeture converge plus lentement que l'ouverture, donc l'exposition est **structurellement plus longue** que l'intervalle entre les deux gestes. Une gouvernance qui daterait l'exposition sur les merges la sous-estimerait de quatre minutes.

Vérification concrète, en boucle jusqu'à N réponses identiques :

```bash
for i in $(seq 1 12); do
  curl -s -H 'Cache-Control: no-cache' "https://llm.vermeer.ai/api/config?_=$(date +%s)-$i" \
    | grep -o '"<la-clé-attendue>":[a-z]*'
done
```

## 5. Point 0, puis la sonde — elle EST le smoke

**Point 0 — vérifier l'image réellement servie par les pods** (Loki). Tant que l'image n'est pas confirmée, aucune conclusion produit n'est valide : la cause la plus fréquente d'un comportement inattendu après MEP est un environnement qui ne fait pas tourner le build attendu.

**Puis la sonde, en `workflow_dispatch`** :

```
Actions → Sonde de production → Run workflow    (sans forcer_rouge)
```

**Il n'y a pas d'autre smoke prod à chercher.** Elle vérifie que les trois fournisseurs — Anthropic, OpenAI, Google — rendent une réponse non vide à un utilisateur réel, nettoie derrière elle et vérifie son nettoyage. Verdict attendu : `3/3 fournisseurs VERT`.

Ce qu'elle **ne** couvre pas, et qu'il ne faut donc pas croire vérifié : le contenu des réponses, l'interface, la génération de titre (`addTitle`, délibérément hors verdict). Détail : [`e2e/prod/README.md`](../e2e/prod/README.md).

Un détail qui a de la valeur ici : la sonde utilise `gemini-2.5-flash-lite` **délibérément**, parce que c'est le modèle visé par la garde `thinkingConfig` (`CLAUDE.md` §11). Une MEP qui régresserait cette garde ferait rougir la sonde — c'est le seul endroit du dispositif où ce défaut se voit automatiquement.

---

## Ce qui n'existe pas, et qu'il ne faut pas chercher

| Attendu par la feuille de route initiale           | Réalité                                                                                             |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Workflow MEP (`préparation tag + digest + checks`) | **n'existe pas** — chantier 7 gelé                                                                  |
| Jeton branches-only de l'agent MEP                 | **jamais créé** — `vermeer-gitops-prod` ne porte aucun secret                                       |
| Dossier MEP (jumeau du Dossier QA)                 | **n'existe pas** — la trace d'une MEP est la PR du digest et, s'il y a bypass, son issue d'incident |
| Comm' de release automatique                       | **n'existe pas** — chantier 8 gelé                                                                  |

## Renvois

| Sujet                                            | Où                                               |
| ------------------------------------------------ | ------------------------------------------------ |
| Build d'image, registre ECR, logique de tag      | [`../CLAUDE.md`](../CLAUDE.md) §12               |
| Écluse, doctrine du bypass, invariants           | [`GOVERNANCE.md`](GOVERNANCE.md) §4              |
| Sonde, Point 0, diagnostic d'un rouge            | [`../e2e/prod/README.md`](../e2e/prod/README.md) |
| Écarts de configuration entre commité et déployé | [`CONFIG-DRIFT.md`](CONFIG-DRIFT.md)             |
| Reprise après standby                            | [`RUNBOOK-REVEIL.md`](RUNBOOK-REVEIL.md)         |
