# Vermeer Chat — Écarts de configuration (config drift)

**Version : v0.10.10 — 28 juin 2026**

Ce document recense les écarts entre la **configuration commitée** (`librechat.yaml`,
`.env.example`), la **configuration réellement déployée** (`librechat.gitops.yaml`
+ helm), et ce que décrit le **CLAUDE.md**. Objectif : réaligner les sources pour
qu'elles disent la même chose. Aucun de ces écarts n'apparaît dans
`FONCTIONNALITES.md` (qui décrit l'état déployé).

---

## 1. `balance` (credit management)

- **yaml commité** (`librechat.yaml:165`) : bloc **commenté** → désactivé.
- **gitops — les DEUX environnements, OBSERVED 31/07/2026** : `balance.enabled: true`
  en **staging** (`vermeer-gitops`, `staging/llm/librechat.yaml:109`) **et** en
  **production** (`vermeer-gitops-prod`, `prod/llm/librechat.yaml:109`). L'écart
  n'est pas propre à un environnement : il est **général**.
- **local** (`librechat.local.yaml:110`) : `enabled: true`.
- **CLAUDE.md** (§7, §9) : décrit `balance` comme « présent mais laissé commenté en
  config » et la BudgetCard comme nécessitant une édition admin préalable.
- **Constat** : le credit management est **actif partout où il tourne** — staging et
  production — contrairement à ce que disent le yaml commité et le CLAUDE.md. Les
  **deux** affirmations du CLAUDE.md sont fausses, pas seulement la première :
  - §7 « `balance` et `transactions` présents nativement mais laissés commentés en
    config » → faux en staging **et** en prod ;
  - §9 « BudgetCard visible uniquement pour les users ayant un document Balance […]
    un admin doit éditer un seuil pour le user » → **contredit par l'observation** :
    `GET /api/balance` sur un compte créé le 31/07/2026 en production renvoie un
    document complet (`monthlyBudget: 10000000`, `monthlyBudgetBaseline: 10000000`,
    `currentMonthSpend: 0`) **sans aucune intervention admin**. Le workaround décrit
    en §9 n'a plus d'objet dès lors que `balance.enabled: true`, et le backlog V2
    « auto-création Balance » (§8) est de fait **déjà satisfait** dans ces
    conditions.
- **Plafond effectif — OBSERVED** : `DEFAULT_MONTHLY_BUDGET = 10_000_000`
  tokenCredits = **10 USD/mois** (`packages/data-schemas/src/methods/budget.ts`),
  identique en staging et en production. Le **reset mensuel** est actif dans les deux
  cas : `VERMEER_BUDGET_RESET_ENABLED` est un **kill-switch à défaut activé** — seul
  `'false'` désarme le scheduler (`api/server/services/Vermeer/budgetResetScheduler.js:70`).
  Il est posé explicitement à `"true"` en staging et **absent** en production : c'est
  une différence d'**explicitation**, pas de comportement. *(Cf. issue #127, qui pose
  la question de l'alignement de cette variable en prod — la réponse est qu'il n'y a
  pas de risque fonctionnel, seulement un défaut implicite à rendre explicite.)*
- **À réaligner** : aligner `librechat.yaml` et le CLAUDE.md (§7, §8, §9) sur l'état
  déployé.

## 2. `transactions`

- **yaml commité** (`librechat.yaml:176`) : commenté.
- **gitops** (`librechat.gitops.yaml:118`) : commenté **mais** forcé à `true` au
  runtime car `balance.enabled: true` (comportement by-design, CLAUDE.md §11).
- **CLAUDE.md** : §11 documente correctement le forçage.
- **Constat** : transactions est **effectivement actif en prod** via le forçage,
  même si la clé reste commentée.
- **À réaligner** : expliciter le bloc `transactions` ou documenter clairement le
  forçage là où `balance` est activé.

## 3. `memory`

- **yaml commité** (`librechat.yaml:686`) : bloc **commenté**.
- **gitops** (`librechat.gitops.yaml:430-434`) : **actif** (`disabled: false`,
  `personalize: true`, `validKeys`, agent mémoire `gpt-4o-mini`).
- **local** (`librechat.local.yaml:434`) : actif.
- **CLAUDE.md** : §7 liste `memory` parmi les features « activées » (cohérent avec
  le déployé), mais le yaml commité la laisse commentée.
- **Constat** : la mémoire est **active en production** ; le yaml commité ne le
  reflète pas.
- **À réaligner** : décommenter/synchroniser `librechat.yaml`.

## 4. RAG (`RAG_API_URL`)

- **`.env.example:395`** : `# RAG_API_URL=...` commenté → undefined.
- **gitops / helm** : `RAG_API_URL` **injecté automatiquement**
  (`helm/librechat/templates/configmap-env.yaml:7`) dès que le sous-chart
  `librechat-rag-api` est activé ; package de déploiement `deploy/vermeer-rag-deploy/`.
- **CLAUDE.md** (§9) : « RAG API non opérationnelle en V1, `RAG_API_URL` undefined,
  indexation échoue silencieusement ».
- **Constat** : le RAG est **opérationnel en production** (confirmé) ; le CLAUDE.md
  est **périmé** sur ce point.
- **À réaligner** : mettre à jour le CLAUDE.md §9 (RAG = actif prod).

## 5. Auth / `socialLogins`

- **yaml commité** (`librechat.yaml:160`) : liste complète des providers
  (`github, google, discord, openid, facebook, apple, saml`).
- **gitops** (`librechat.gitops.yaml:104`) : `socialLogins: ['openid']` uniquement
  (OpenID/Keycloak).
- **`.env`** : `ALLOW_SOCIAL_LOGIN=false` (dev).
- **CLAUDE.md** (§2) : « SSO/social login désactivés, `ALLOW_SOCIAL_LOGIN=false`,
  `registration.socialLogins: []` ».
- **Constat** : en **production**, l'auth réelle est **OpenID/Keycloak**, ce que ne
  reflètent ni le yaml commité (liste complète) ni le CLAUDE.md (« désactivés »).
- **À réaligner** : clarifier la distinction dev (email/mdp) vs prod (OpenID) dans
  le CLAUDE.md et nettoyer la liste du yaml commité.

## 6. `REPORT_ISSUE_URL` (à confirmer)

- **`.env.example:713`** : `REPORT_ISSUE_URL=` (vide).
- **gitops / helm / deploy** : **aucune valeur** trouvée dans les configs du repo.
- **Constat** : le bouton « Signaler un problème » ne s'affiche que si l'URL est
  définie. Sa valeur en prod proviendrait d'un gitops externe non visible dans ce
  repo → **statut prod à confirmer**.
- **À réaligner** : confirmer si `REPORT_ISSUE_URL` est injectée côté gitops externe,
  et documenter la valeur cible.

---

## Synthèse

| Bloc | yaml commité | gitops (déployé) | CLAUDE.md | Action |
|---|---|---|---|---|
| `balance` | commenté | `enabled: true` en **staging ET prod** — OBSERVED 31/07/2026 | « commenté » (§7) **et** « BudgetCard nécessite une édition admin » (§9) — **les deux faux** | À réaligner (§7, §8, §9) |
| `transactions` | commenté | forcé `true` | forçage documenté | À expliciter |
| `memory` | commenté | actif | « activé » | À réaligner |
| RAG (`RAG_API_URL`) | undefined | injecté auto (actif) | « non opérationnel » | CLAUDE.md périmé |
| `socialLogins` | liste complète | `['openid']` | « désactivés » | À clarifier dev/prod |
| `REPORT_ISSUE_URL` | vide | introuvable repo | non mentionné | À confirmer |
