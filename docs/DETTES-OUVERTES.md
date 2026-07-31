# Dettes ouvertes

**Un seul endroit citable.** Une dette par entrée, avec son **motif** — pourquoi elle a été contractée, et non pourquoi elle est regrettable — et sa **condition de levée**, qui dit à quoi on reconnaîtra qu'il est temps de s'en occuper.

Établi le **31/07/2026**, à la clôture documentaire du chantier 5, sous régime de standby.

Ce document ne duplique rien : le détail technique vit dans le code et dans les documents de référence, les constats instruits vivent dans l'issue **[#132](https://github.com/POPAISTUDIO/vermeer-text/issues/132)** (backlog documentaire), et les pouvoirs vivent dans le [registre des identités](registre-identites.md).

> **Ce qui n'est pas une dette et n'a donc pas sa place ici** : les choix gelés par décision datée (chantiers 4, 7, 8 — voir [`architecture-cible-v2.md`](architecture-cible-v2.md) §5) et les défauts produit tracés en issues. Une dette, ici, est un **écart entre ce que le dispositif fait et ce qu'il devrait faire**, assumé faute de temps ou de périmètre.

---

## 1. Noyau partagé — `e2e/prod` ↔ `e2e/staging`

**Ce que c'est.** `e2e/prod/lib/auth.mjs` duplique la logique de `e2e/staging/lib/auth.ts` : login programmatique et acceptation des CGU.

**Motif.** La suite staging tourne sous Playwright et manipule un `APIRequestContext` ; la sonde de production est un client HTTP pur, exécutable par `node` seul, sans dépendance installée. Les deux ne manipulent pas le même objet de requête, et un noyau commun devrait abstraire cette différence avant d'exister. Second motif, décisif : la sonde touche la **production** — elle ne doit pas casser parce qu'un refactoring de la recette staging a déplacé un helper.

**Ce qu'il faut tenir tant qu'elle n'est pas levée.** Toute correction dans l'un **doit** être reportée dans l'autre. Un commentaire croisé le rappelle des deux côtés.

**⚠️ Une divergence ne doit PAS être « alignée »** : le `BROWSER_UA` de la sonde. La suite staging n'en a pas besoin parce que Playwright envoie un vrai User-Agent de navigateur ; l'aligner casserait la sonde.

**Condition de levée.** Le réveil du développement, et un besoin réel de partager un troisième comportement. Extraire un module commun (login, CGU, extraction du texte des `content` parts) tant qu'il n'y a que deux consommateurs coûterait plus d'abstraction que de duplication.

## 2. Deux politiques de déduplication d'alerte opposées

**Ce que c'est.** `canary-providers.yml` (staging) titre ses issues avec la date — N jours rouges consécutifs créent **N issues** répétant le même incident. `prod-sonde.yml` utilise un titre **stable** et commente l'issue existante — un incident, une issue.

**Motif.** Aligner le canary staging aurait élargi le périmètre du chantier 5 à un workflow qui n'y était pas, et le canary est aujourd'hui **le seul œil sur staging** : on ne le retouche pas dans la séance qui met une sonde de production en place.

**Condition de levée.** Un jour calme, et un arbitrage dans **un sens ou dans l'autre** — les deux sont défendables : une issue par incident, ou une issue par jour rouge servant de trace quotidienne au triage. Ce qui n'est pas tenable durablement, c'est que deux alertes du même dépôt aient deux politiques opposées **sans qu'aucune ne dise laquelle est la bonne**.

**Détail.** [#132](https://github.com/POPAISTUDIO/vermeer-text/issues/132).

## 3. `vermeerchat-qa-session` — pouvoir vivant non décrit

**Ce que c'est.** Un jeton fine-grained du compte `Loisetoscer`, **`Never used`** (OBSERVED), qui ne correspond à aucun secret présent ni à aucun acteur du registre.

**Motif.** Il n'a été ni conservé pour un usage identifié, ni révoqué, parce que **ce qu'il est exactement n'est pas établi** : portée, permissions, raison de sa création. Le révoquer à l'aveugle risquerait de casser un usage non repéré.

**Gravité.** C'est un **écart ouvert au sens de [`GOVERNANCE.md`](GOVERNANCE.md) §1** — un pouvoir vivant qui n'est pas décrit. C'est la dette la plus sérieuse de cette liste, et la moins coûteuse à lever.

**Condition de levée.** Immédiate dès qu'on a accès à sa fiche : **établir ce qu'il est, puis le révoquer** s'il ne sert à rien. Dans cet ordre.

**Détail.** [Registre](registre-identites.md), inventaire des jetons fine-grained.

## 4. `addTitle` hors du verdict de la sonde

**Ce que c'est.** La sonde envoie `isTemporary: true`, ce qui **supprime** la génération de titre. Elle n'exerce donc ni ce chemin, ni le chemin de persistance par défaut.

**Motif.** `addTitle` émettait un appel LLM par conversation **qui n'entrait pas dans le verdict** : sa panne aurait été silencieuse et quotidienne. Entre « exercé mais non asservi » et « non exercé », le second est plus honnête. Les deux autres leviers d'`addTitle` étaient inutilisables : `TITLE_CONVO` est une variable d'environnement — toucher la config de production et le produit de tous les utilisateurs — et `client.options.titleConvo` ne vient pas du corps de requête.

**Condition de levée.** Le jour où l'on veut couvrir ce chemin, il faut **l'asservir** : assertion sur le titre obtenu. **Ne pas simplement retirer le drapeau** — cela restaurerait l'appel non couvert, c'est-à-dire exactement la situation qu'on a corrigée.

**Détail.** [`../e2e/prod/README.md`](../e2e/prod/README.md).

## 5. `BAN_VIOLATIONS` en production — UNKNOWN

**Ce que c'est.** La valeur réelle de `BAN_VIOLATIONS` en production n'est pas établie : absente du gitops, mais à `true` dans `.env.example`. Elle peut venir d'un ConfigMap non visible dans les dépôts.

**Motif.** Non instruit faute de périmètre — la lecture de la configuration réellement injectée relève de l'infra.

**Pourquoi ça compte.** Si elle est active, **une seule requête non-navigateur suffit à franchir un seuil de ban** (score 20, intervalle 20), pour 2 heures par défaut, et `deleteAllUserSessions` s'exécute même à durée nulle. Sur un compte de service au mot de passe **non rotable**, un ban se remédie par le rejeu complet de la fenêtre d'inscription en production.

**État empirique.** **OBSERVED inopérant** au 31/07/2026 : après trois violations, `POST /api/auth/login` — lui-même derrière `checkBan` — a répondu 200. C'est un constat, pas une garantie : il ne dit rien de ce que vaudra la variable demain.

**Condition de levée.** Lire la configuration effectivement injectée en production. Se règle en une question à l'infra.

## 6. Redis en production — UNKNOWN

**Ce que c'est.** Aucune mention de Redis dans `prod/llm/` du gitops de production. S'il est en service, sa configuration vient d'ailleurs.

**Pourquoi ça compte, au-delà de la curiosité.** La présence ou l'absence de Redis détermine si les **compteurs de violations** sont partagés entre pods ou **locaux à chacun** : sans Redis, repli sur un fichier local au pod, perdu à chaque rollout. Cela change la lecture de tout incident de violation — et accessoirement la pertinence du ticket [#127](https://github.com/POPAISTUDIO/vermeer-text/issues/127) sur `REDIS_PING_INTERVAL`.

**Condition de levée.** Même question à l'infra que la dette n° 5. Les deux se répondent ensemble.

## 7. Trois interdits du triage ne vivent que dans un prompt

**Ce que c'est.** Parmi les garde-fous du désignateur automatique, **trois interdits vivent dans un prompt** et non dans du code.

**Motif.** Ils n'étaient pas doublables mécaniquement au moment du câblage. Le principe de [`GOVERNANCE.md`](GOVERNANCE.md) §6 est explicite — _un interdit qui ne vit que dans un prompt est une intention_ — et la parade posée est un **test de garde**, `qa-triage-replay.yml`, qui rejoue le prompt **vivant** sur fixtures archivées, en dry-run vis-à-vis de GitHub. **✅ Premier rejeu vert OBSERVED le 31/07/2026.**

**Ce que le test de garde ne remplace pas.** Il vérifie que le prompt **tient encore**, pas que l'interdit soit **impossible à violer**. Un prompt s'érode : le modèle change, le fichier bouge.

**Condition de levée.** Dès qu'un doublage mécanique devient possible pour l'un des trois. Le point 2 de la revue mensuelle ([`GOVERNANCE.md`](GOVERNANCE.md) §7) est le moment prévu pour se poser la question.

## 8. Contrôle Loki reporté

**Ce que c'est.** La vérification systématique de l'image servie par les pods — le **Point 0** — reste **un geste manuel** : elle n'a pas été automatisée.

**Motif.** Le chantier 6 devait porter des crons d'observation ; le scan de nuit a été **abandonné** et le reste réduit. L'accès Loki passe par des wrappers locaux sur le Mac de l'atelier, donc **indisponible Mac éteint** — ce qui était précisément la raison d'être de la migration en crons GitHub, elle-même sans objet sous standby.

**Ce que ça coûte.** Le Point 0 est la **première étape** du diagnostic de toute sonde rouge et de toute MEP. Il est rappelé dans le corps des issues d'alerte et dans les deux runbooks, mais il repose sur quelqu'un qui le fait.

**Condition de levée.** Le réveil du développement **et** la disponibilité d'un accès Loki qui ne dépende pas d'un poste allumé. Les deux, pas l'un.

## 9. `401` sur Grafana staging

**Ce que c'est.** Un `401` rencontré côté Grafana staging, qui empêche la lecture des logs de cet environnement par les wrappers.

**Motif.** Non instruit — cause **UNKNOWN**. Deux hypothèses non tranchées, et il ne faut pas choisir sans preuve : un jeton invalidé, ou un changement côté service. À rapprocher du fait déjà consigné au registre que **le rôle exact des jetons Grafana est UNKNOWN** — seule leur nature read-only est INFERRED, depuis les appels qu'émettent les wrappers.

**Ce que ça coûte.** L'observabilité **staging** est aveugle par ce chemin. La production n'est pas affectée (wrapper distinct). Le canary staging, lui, ne dépend pas de Loki : il reste le seul œil fonctionnel sur staging.

**Condition de levée.** Une reprise du sujet observabilité avec l'infra — même interlocuteur que la relance Loki staging (`GATEWAY_TIMEOUT` + rétention), déjà au backlog. Consigner **OBSERVED** ce que vaut réellement le jeton à cette occasion, comme le demande la consigne de tenue n° 3 du registre.

---

## Renvois

| Sujet                                                 | Où                                                        |
| ----------------------------------------------------- | --------------------------------------------------------- |
| Constats instruits, lot documentaire                  | [#132](https://github.com/POPAISTUDIO/vermeer-text/issues/132)                            |
| `VERMEER_BUDGET_RESET_ENABLED`, `REDIS_PING_INTERVAL` | [#127](https://github.com/POPAISTUDIO/vermeer-text/issues/127)                            |
| Pouvoirs, jetons, remédiations                        | [`registre-identites.md`](registre-identites.md)          |
| Règles, marqueurs `⏳`, revue mensuelle               | [`GOVERNANCE.md`](GOVERNANCE.md)                          |
| Ce qui est gelé et pourquoi                           | [`architecture-cible-v2.md`](architecture-cible-v2.md) §5 |
| Écarts de configuration                               | [`CONFIG-DRIFT.md`](CONFIG-DRIFT.md)                      |
| Dette CI pré-existante                                | [#86](https://github.com/POPAISTUDIO/vermeer-text/issues/86)                              |
| Défaut produit WEB-01                                 | [#114](https://github.com/POPAISTUDIO/vermeer-text/issues/114)                            |
