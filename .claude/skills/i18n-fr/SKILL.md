---
name: i18n-fr
description: Ajoute ou traduit des clés i18n Vermeer (EN source → FR) selon la procédure manuelle post-Locize — validation terminologique par le PMO avant traduction, conventions strictes (interpolations à l'identique, apostrophes ASCII, sigles métier non traduits), insertion ordonnée, contrôle de parité. À utiliser pour toute clé com_*, tout texte d'interface à franciser, tout useLocalize à ajouter, ou tout écart EN/FR à corriger.
---

# i18n Vermeer — EN source, FR validée à la main

Locize a été retiré (`d58c249a2`). Les traductions FR sont ajoutées manuellement, et **l'EN
fait foi** : une clé FR qui n'existe pas en EN est un déchet, pas une traduction.

Fichiers : `client/src/locales/en/translation.json` (source) et
`client/src/locales/fr/translation.json`. Couverture FR actuelle ~79 % — l'écart est assumé,
on ne comble pas en masse sans demande.

## Séquence

1. **Écrire la clé EN** dans `en/translation.json`, préfixe sémantique correct
   (`com_ui_`, `com_assistants_`, `com_agents_`, `com_budget_`, `com_usage_`…). Une clé
   existante réutilisable est toujours préférable à une nouvelle.
2. **Faire valider la terminologie EN par Loïse (PMO) AVANT de traduire.** C'est une étape du
   process, pas une politesse : le vocabulaire produit (registre atelier d'art, IA à la
   première personne, « assistant » et non « agent » côté UI) se décide là.
3. **Traduire en FR** et insérer dans `fr/translation.json` à sa place alphabétique.
4. **Contrôler** : `node .claude/scripts/i18n-parity.mjs` (le hook PostToolUse le lance déjà
   à chaque édition d'un des deux fichiers).

## Conventions non négociables

- **Interpolations `{{xxx}}` identiques à l'EN**, y compris le nom de la variable.
  `{{name}}` ne devient jamais `{{nom}}` — le code passe `name`, la variable non résolue
  s'affiche telle quelle à l'écran.
- **Apostrophes ASCII** (`'`), jamais typographiques (`’`).
- **Pas d'espace insécable** (U+00A0 / U+202F) : le repo utilise des espaces normaux.
- **Sigles métier non traduits** : POP, BETC, BU, USD, CSV.
- **Références techniques non traduites** : `librechat.yaml`, noms de fichiers, noms de champs.
- **Posture éditoriale** : premium, registre atelier d'art, orienté métier agence. L'IA parle
  à la première personne (« Comment veux-tu que je t'appelle ? »).
- Accords et pluriels : vérifier les formes `_one` / `_many` quand la clé en a.

## Vérifications de sortie

- `JSON.parse` valide sur les deux fichiers (le script le fait).
- Aucune clé FR absente de EN.
- Interpolations alignées clé par clé.
- Diff des noms de clés EN vs FR : seul écart admis = clés EN pas encore traduites.

Passes de référence pour le style d'insertion : commits `7fd9af216` (27 clés `com_budget_*`)
et `6068ec993` (40 clés `com_usage_*`).

## Écarts connus au 30/07/2026

Le contrôle de parité remonte aujourd'hui des dettes préexistantes — les corriger **seulement
si c'est le sujet demandé**, jamais en passager clandestin d'une autre feature :

- 5 clés FR orphelines (absentes de EN) : `com_ui_feedback_tag_many`, `com_ui_feedback_tag_one`,
  `com_ui_memory_key_placeholder`, `com_ui_memory_value_placeholder`, `com_ui_reference_files`.
- `com_agents_agent_card_label` : `{{name}}` traduit en `{{nom}}` → interpolation cassée.
- `com_ui_special_variables` : la FR porte des interpolations que l'EN n'a pas.
- Ordre alphabétique FR rompu autour de `com_agents_category_empty`.

Note : `client/src/locales/en/translation.json` est un fichier de la **watchlist §11** (clés
`com_budget_*` / `com_usage_*` Vermeer + subtitle modifié) — au merge upstream, vérifier que
ces clés survivent.
