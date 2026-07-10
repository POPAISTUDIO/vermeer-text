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
- **gitops** (`librechat.gitops.yaml:107-113`) : `balance.enabled: true` → **actif**.
- **local** (`librechat.local.yaml:110`) : `enabled: true`.
- **CLAUDE.md** (§7, §9) : décrit `balance` comme « présent mais laissé commenté en
  config » et la BudgetCard comme nécessitant une édition admin préalable.
- **Constat** : le credit management est **actif en production**, contrairement à ce
  que disent le yaml commité et le CLAUDE.md.
- **À réaligner** : aligner `librechat.yaml` et le CLAUDE.md sur l'état déployé.

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
| `balance` | commenté | `enabled: true` | « commenté » | À réaligner |
| `transactions` | commenté | forcé `true` | forçage documenté | À expliciter |
| `memory` | commenté | actif | « activé » | À réaligner |
| RAG (`RAG_API_URL`) | undefined | injecté auto (actif) | « non opérationnel » | CLAUDE.md périmé |
| `socialLogins` | liste complète | `['openid']` | « désactivés » | À clarifier dev/prod |
| `REPORT_ISSUE_URL` | vide | introuvable repo | non mentionné | À confirmer |
