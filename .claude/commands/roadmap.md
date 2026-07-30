---
description: Met à jour docs/ROADMAP.md en réconciliant la roadmap avec l'état réel du repo
argument-hint: [optionnel : "check" = audit sans écriture]
allowed-tools: Bash(git log:*), Bash(git tag:*), Bash(git describe:*), Bash(gh pr list:*), Bash(gh pr view:*), Read
---

Tu maintiens la roadmap produit de Vermeer Chat (docs/ROADMAP.md). Tu ne l'inventes pas : tu réconcilies ce qui est tracé dans le repo avec ce qui est écrit, et tu proposes des mises à jour. Lecture seule d'abord, montre les changements, attends mon GO avant d'écrire.

## 1. Lis l'état actuel
- docs/ROADMAP.md
- docs/CONFIG-DRIFT.md s'il existe (backlog technique)

## 2. Récupère les signaux du repo (lecture seule)
- Dernier tag : !`git describe --tags --abbrev=0`
- Tags récents : !`git tag --sort=-creatordate | head -10`
- PR mergées récentes : !`gh pr list --state merged --limit 20`
- PR ouvertes : !`gh pr list --state open --limit 30`

## 3. Réconcilie et PROPOSE (n'écris rien encore)
- Item de la roadmap correspondant à une PR mergée / un tag → propose de le passer en "Livré" (avec la réf).
- PR ouverte absente de la roadmap → propose de l'ajouter en "En cours".
- Item "En cours" ou "Next" sans PR / tag / activité correspondante → signale-le "à vérifier (peut avoir décroché)".
- Item du backlog CONFIG-DRIFT non présent → propose de l'ajouter dans "Next".

## Règles
- N'invente AUCUN item stratégique ni AUCUNE échéance. Le contenu stratégique (gouvernance, adoption, Ava) est curé par moi : tu n'y touches que pour ajuster un statut que je te confirme, ou pour signaler une incohérence.
- Conserve la structure (Livré / En cours / Next / Later), la légende et l'en-tête (mets à jour la version = dernier tag, et la date du jour).
- Présente un récapitulatif des changements proposés, puis attends mon GO. Si l'argument est "check", arrête-toi au récapitulatif sans jamais écrire.
- Ne commit rien.
