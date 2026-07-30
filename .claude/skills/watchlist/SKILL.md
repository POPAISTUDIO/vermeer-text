---
name: watchlist
description: Inscrit ou met à jour un concern Vermeer dans la watchlist merge upstream de CLAUDE.md §11, après modification d'un fichier natif LibreChat — rédige l'entrée au format maison (fichier, ce qui a été ajouté, pourquoi, « ne pas retirer sans… »), déduplique, tient le décompte. À utiliser dès qu'on touche du code natif LibreChat, qu'on pose un garde-fou qui doit survivre au prochain merge, ou qu'un concern existant a changé de comportement.
---

# Inscrire un concern à la watchlist §11

La watchlist est ce qui permet à un merge upstream, dans six mois, de ne pas rouvrir un bug
déjà corrigé. Une entrée mal écrite — « on a modifié ce fichier » — ne sert à rien : elle ne
dit pas ce qu'il faut protéger.

Vérifier d'abord si le fichier est déjà inscrit :

```bash
.claude/scripts/watchlist.sh | grep -F "<chemin>"
grep -n "<chemin>" CLAUDE.md
```

Si oui → **compléter l'entrée existante** avec un « Concern supplémentaire », jamais créer un
second bullet pour le même fichier.

## Anatomie d'une entrée

Un bullet dans la région « Code natif LibreChat modifié — watchlist merge upstream » (ou dans
le bloc thématique adéquat : mémoire, maxContextTokens), composé de :

1. **Le chemin** en `code`, suivi entre parenthèses de la nature du fichier
   (« upstream modifié Vermeer », « natif modifié », « nouveau fichier Vermeer »).
2. **Le concern nommé** — un titre court en gras, avec la référence de traçabilité :
   `(fix QA n°12 wagon rc5)`, `(fix P0 QA v0.10.22)`, `(PR #28)`, `(issue #128)`.
3. **Ce que fait le code Vermeer**, précisément : quel symbole, quelle branche, quelle
   condition, à quel endroit du fichier (avant/après quel appel — l'ordre compte souvent).
4. **Pourquoi** — le symptôme réel qu'on corrige, et pourquoi la solution évidente ne marchait
   pas (les options écartées valent de l'or au prochain merge).
5. **La clause de sortie** : « Ne pas retirer X sans Y ». C'est la ligne qu'un futur lecteur
   lira en premier.
6. Le cas échéant : la **spec de contrat** qui garde le comportement
   (`providerError.spec.ts`, `validation.spec.ts`…), et la mention **divergence assumée du
   pass-through upstream, tests adaptés** quand on a modifié un test amont.

Les **nouveaux fichiers Vermeer** (helpers) s'inscrivent en italique, explicitement **hors
décompte** : ils ne peuvent pas entrer en conflit de merge.

## Rédaction

Registre du fichier : dense, factuel, en français, au présent. Pas de « nous avons décidé de » :
on écrit la règle et sa raison. Les valeurs, bornes, noms de symboles et numéros d'issue sont
littéraux — un concern approximatif est un concern mort.

À faire aussi dans la même passe :

- mettre à jour le **décompte** annoncé en tête de la watchlist (« ces N fichiers »), en
  comptant les fichiers, pas les concerns, et hors nouveaux fichiers Vermeer ;
- vérifier la ligne **« Dernière mise à jour »** en tête de CLAUDE.md et la dernière passe ;
- si le concern touche un invariant produit (fermeture de modale, budget mensuel, défaut
  web_search), vérifier qu'il n'existe pas déjà un exemplaire du même pattern ailleurs dans la
  liste — le signaler comme « Nième exemplaire du pattern », comme fait pour les fermetures de
  modale.

## Ce qui ne va pas dans la watchlist

- Un flag de branding sans équivalent natif → §7 catégorie B, pas §11.
- Un fichier 100 % Vermeer sans code natif → mention hors décompte, ou rien.
- Un choix d'architecture → §5 (décisions) ; un risque d'exploitation → §11 mais dans les
  blocs de risques, pas la watchlist de merge.
