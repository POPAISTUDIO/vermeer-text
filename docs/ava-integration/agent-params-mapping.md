# Les fonctionnalités d'un assistant Vermeer — panorama pour Ava

## À quoi sert ce document

Ce document présente **tout ce qu'on peut paramétrer sur un assistant Vermeer**, expliqué en langage simple, avec pour chaque élément **son statut réel dans l'application aujourd'hui**.

L'objectif est de donner une vue complète de ce qui existe derrière un assistant Vermeer, pour décider de ce qui mérite d'être repris côté Ava.

> Ce document décrit les **fonctionnalités** et les **réglages** d'un assistant.


**Date** : 2026-06-18 · **Base** : Vermeer Chat (fork LibreChat v0.8.5), état V1.

---

## Légende des statuts

| Statut | Signification |
|---|---|
| **Actif** | Disponible et fonctionnel aujourd'hui. |
| **Exposé mais non opérationnel** | Visible dans l'interface, mais ne marche pas encore. |
| **Désactivé** | Présent dans le code mais coupé en configuration. |
| **POC / hors prod** | Validé en test local, pas encore déployé. |
| **Avancé / non exposé** | Existe, mais pas dans l'interface de création d'assistant. |


---

## Section A — Fonctionnalités de l'assistant

Ce que le créateur d'un assistant peut activer ou renseigner pour façonner son comportement.

| Fonctionnalité | En clair | Statut |
|---|---|---|
| **Nom & description** | Le nom de l'assistant et une courte description de son rôle. | Actif |
| **Instructions** | Les consignes de fond données à l'assistant : son rôle, son ton, ce qu'il doit faire ou éviter. C'est le cœur de sa personnalité. | Actif |
| **Recherche web** | L'assistant peut aller chercher des infos à jour sur le web pendant qu'il répond. | Actif *(voir note ci-dessous)* |
| **Base de connaissances (recherche dans des fichiers)** | Documents attachés à l'assistant pour qu'il puisse s'y référer et fonder ses réponses dessus. | Exposé mais non opérationnel |
| **Fichiers joints à la conversation** | Joindre un fichier dans l'échange pour que l'assistant le prenne en compte sur le moment. | Actif |
| **Exécution de code** | L'assistant peut écrire et lancer du code pour calculer, traiter des données ou produire un résultat. | POC / hors prod |
| **Outils intégrés** | Outils prêts à l'emploi qu'on peut activer sur un assistant via « Ajouter des outils » dans le constructeur. | Actif |
| **Connecteurs MCP** | Permet de brancher l'assistant à des sources/outils externes ; pas encore ouvert aux utilisateurs. | Présent mais non exposé en V1 — l'entrée de menu est masquée (feature flag SHOW_MCP_SIDEBAR_ITEM), non testé. |
| **Actions** | Connecter l'assistant à un service externe via son API pour qu'il déclenche des opérations (ex. créer une fiche, interroger un système). | Présent dans le builder — non testé à ce jour, aucune action préconfigurée. |
| **Compétences (skills)** | Activer un catalogue de savoir-faire prêts à l'emploi, soit en totalité, soit une sélection précise. | Actif |
| **Mémoire personnelle de l'utilisateur** | L'assistant retient des informations propres à chaque utilisateur d'une conversation à l'autre (ce que l'utilisateur a partagé sur lui, ses préférences). | Actif |
| **Mémoire personnelle rattachée à un assistant** | Mécanisme qui rattache une mémoire personnelle à un assistant donné, plutôt qu'au compte global de l'utilisateur (ce que l'utilisateur a confié à *cet* assistant reste avec lui). | Actif *(spécifique Vermeer)* |
| **Mémoire partagée de l'assistant** | Mémoire remplie à la main par le créateur de l'assistant, partagée avec tous ceux qui reçoivent l'assistant. Sert à transmettre un savoir « maison » avec l'assistant. | Actif *(spécifique Vermeer)* |
| **Phrases d'amorce (conversation starters)** | Suggestions de questions affichées au démarrage, pour aider l'utilisateur à lancer la discussion. | Actif |
| **Artefacts** | L'assistant peut produire un résultat affiché dans un panneau dédié (page web, petit composant d'interface, document mis en forme). | Actif |
| **Avatar** | L'image qui représente l'assistant. | Actif |
| **Catégorie** | Le classement de l'assistant, utile pour le retrouver dans la marketplace interne. | Actif |
| **Contact support** | Un nom et un email de contact affichés pour les questions sur l'assistant. | Actif |
| **Nombre max d'étapes (limite de récursion)** | Nombre maximum d'étapes que l'assistant peut enchaîner seul avant de s'arrêter (évite qu'il tourne en boucle). | Avancé / non exposé |
| **Enchaînement de plusieurs assistants (multi-agent)** | Faire travailler plusieurs assistants à la chaîne, en se passant la main. | Avancé / non exposé |
| **Sous-assistants** | Un assistant peut déléguer une partie du travail à des assistants « enfants » dans un espace isolé. | Avancé / non exposé |
| **Réglages fins de comportement des outils** | Options techniques sur la manière dont les outils sont chargés et qui peut les appeler. | Avancé / non exposé |

**Note recherche web** : elle repose sur la recherche native du fournisseur et fonctionne en appel direct à l'API du modèle. Elle ne fonctionnerait pas si le modèle était servi via une passerelle de type Vertex.

**Note multi-agent / sous-assistants** : ce sont des capacités réelles mais non proposées dans l'interface de création d'assistant aujourd'hui. *Le multi-agent reste à instruire côté portabilité plus tard.*

---

## Section B — Réglages du modèle

Ce sont les « boutons de réglage » de la façon dont le modèle génère ses réponses. Dans l'interface, seuls quelques-uns sont mis en avant (les essentiels) ; les autres sont rangés dans un volet « Paramètres avancés ».

La colonne **« Fournisseur »** indique le type de modèle auquel chaque réglage s'applique, lorsqu'un modèle de ce type est configuré. Ce document ne dit pas quels modèles sont actifs.

### B.1 — Réglages communs (tous fournisseurs)

| Réglage | En clair | Fournisseur |
|---|---|---|
| **Créativité (température)** | Règle si l'assistant répond plutôt de façon créative et variée, ou plutôt factuelle et prévisible. | Tous |
| **Longueur max de réponse** | La taille maximale de la réponse que l'assistant peut produire. | Tous |
| **Taille de contexte prise en compte** | La quantité de conversation et de documents que l'assistant garde « en tête » pour répondre. | Tous |
| **Diversité du vocabulaire (top P)** | Autre façon de doser la variété des réponses, en limitant le modèle aux formulations les plus probables. | Tous |
| **Consignes système additionnelles** | Un texte de cadrage supplémentaire ajouté en plus des instructions principales. | Tous |
| **Nom affiché du modèle** | Un libellé personnalisé pour le modèle. | Tous |
| **Renvoyer les fichiers à chaque tour** | Représente les fichiers joints à chaque échange (réglage par défaut qui convient presque toujours). | Tous |
| **Limite de taille par fichier** | Plafonne la quantité de texte lue dans un fichier donné. | Tous |
| **Séquences d'arrêt** | Des mots-clés qui font stopper la réponse dès qu'ils apparaissent. | Famille GPT |

### B.2 — Réglages propres à Claude (Anthropic)

| Réglage | En clair |
|---|---|
| **Recherche web** | L'assistant peut chercher des infos à jour sur le web pendant qu'il répond. |
| **Réflexion approfondie (thinking)** | L'assistant prend le temps de « réfléchir » avant de répondre, pour les questions complexes. |
| **Budget de réflexion** | La quantité d'effort de réflexion autorisée avant de répondre. |
| **Niveau d'effort** | Règle l'intensité de raisonnement, du plus léger au plus poussé. |
| **Affichage de la réflexion** | Choisit si le raisonnement de l'assistant est montré, résumé ou caché. |
| **Variété (top K)** | Encore une autre façon de doser la variété des réponses. |
| **Mise en cache du prompt** | Optimisation qui accélère et réduit le coût des échanges répétés. |

### B.3 — Réglages propres à GPT (OpenAI)

| Réglage | En clair |
|---|---|
| **Effort de raisonnement** | Règle combien le modèle « réfléchit » avant de répondre. |
| **Résumé du raisonnement** | Choisit le niveau de détail du raisonnement montré. |
| **Niveau de verbosité** | Règle si les réponses sont plutôt courtes ou plutôt détaillées. |
| **Détail d'analyse d'image** | Le niveau de finesse avec lequel les images sont analysées. |
| **Anti-répétition (pénalités)** | Deux réglages qui découragent l'assistant de se répéter. |
| **Mode de connexion à l'API** | Choix technique de la façon de dialoguer avec OpenAI. |
| **Désactiver le streaming** | Afficher la réponse d'un seul bloc plutôt que mot à mot. |

### B.4 — Réglages propres à d'autres fournisseurs

_S'appliquent aux modèles de ces fournisseurs lorsqu'un modèle de ce type est configuré._

| Réglage | En clair | Fournisseur |
|---|---|---|
| **Réflexion / budget / niveau de réflexion** | Équivalents des réglages de réflexion, version Google. | Google |
| **Recherche web** | Recherche web, version Google. | Google |
| **Région & consignes système** | Réglages d'hébergement et de cadrage propres à Amazon Bedrock. | Bedrock |

---

## Section C — Réglages au niveau de la plateforme

Ce sont des **interrupteurs globaux pour toute l'application**, décidés en configuration. Ils déterminent quelles grandes capacités sont disponibles pour les assistants — ils ne se règlent **pas** assistant par assistant.

| Capacité (interrupteur global) | En clair | Statut |
|---|---|---|
| **Recherche dans les fichiers** | Autorise les assistants à fonder leurs réponses sur des documents joints. | Exposé mais non opérationnel |
| **Exécution de code** | Autorise les assistants à lancer du code. | POC / hors prod |
| **Recherche web (pipeline interne)** | Une seconde voie de recherche web, via des services tiers — distincte de la recherche web native des modèles. Réservée à terme aux administrateurs. | Désactivé |
| **Artefacts** | Autorise la production de résultats affichés dans un panneau dédié. | Actif |
| **Actions** | Autorise la connexion des assistants à des services externes. | Présent dans le builder — non testé à ce jour, aucune action préconfigurée. |
| **Fichiers de contexte** | Autorise les fichiers joints au fil de la conversation. | Actif |
| **Outils** | Autorise le branchement d'outils. | Actif |
| **Connecteurs MCP** | Autorise le branchement à des sources/outils externes via MCP. | Présent mais non exposé en V1 — l'entrée de menu est masquée (feature flag SHOW_MCP_SIDEBAR_ITEM), non testé. |
| **Enchaînement d'assistants** | Autorise le multi-agent. | Actif *(non exposé dans l'interface)* |
| **Sous-assistants** | Autorise la délégation à des assistants enfants. | Actif *(non exposé dans l'interface)* |
| **Compétences (skills)** | Autorise l'usage des savoir-faire prêts à l'emploi. | Actif |
| **Reconnaissance de texte (OCR)** | Lecture de texte dans des images/documents (remplacé par les fichiers de contexte). | Désactivé *(déprécié)* |
| **Chargement différé d'outils** | Optimisation interne du chargement des outils. | Actif |
| **Outils programmatiques** | Capacité avancée nécessitant la dernière version du service d'exécution de code. | Désactivé |

D'autres réglages globaux existent aussi (profondeur max d'étapes par défaut, nombre de citations dans les réponses, seuil de pertinence des sources). Ils sont listés en annexe technique.

---

## Récapitulatif

- **Section A** : ce qui se paramètre sur un assistant, en clair, avec son statut.
- **Section B** : les boutons de réglage du modèle (créativité, réflexion, recherche web, etc.).
- **Section C** : les interrupteurs globaux de la plateforme.
- **Annexe** : tout le détail technique pour l'équipe tech d'Ava, + une version JSON.

---

# Annexe technique — pour l'équipe tech d'Ava si besoin

> Cette partie est volontairement plus technique. Elle n'est pas nécessaire pour la lecture produit ci-dessus.

## T.1 — Où vivent ces réglages

- La liste autoritative des champs éditables d'un assistant est définie côté serveur dans la validation des requêtes de création/mise à jour (`agentBaseSchema`). Les champs hors de cette liste sont ignorés.
- Le contenu des **réglages du modèle** (`model_parameters`) n'est **pas validé** champ par champ côté serveur : il est accepté tel quel. La liste exacte des réglages, leurs types et leurs valeurs par défaut est définie **côté interface**, par fournisseur. C'est donc une **convention de l'application**, pas une contrainte serveur stricte.
- Dans l'interface de création, seuls `temperature`, `thinking` et `web_search` sont affichés en « essentiels » ; tous les autres réglages du modèle sont dans un volet « avancés ».

## T.2 — Recherche web : appel direct vs passerelle

La recherche web native est activée par défaut, selon le fournisseur. Elle repose sur le mécanisme natif de chaque fournisseur :

- **Anthropic** : fonctionne en **appel direct à l'API**. Elle **ne fonctionnerait pas** si le modèle était servi via une passerelle de type **Vertex** (pas de recherche web sur Vertex). À vérifier de même pour Bedrock.
- **OpenAI** : passe par l'API Responses.
- **Google** : passe par le Search Grounding.
- Sur les **endpoints custom** (modèles servis via une passerelle compatible OpenAI), la recherche web est retirée automatiquement, car l'outil natif n'y existe pas (sinon erreur 400 garantie).

Note : le couplage **mise en cache du prompt + recherche web** déclenche une erreur 400 côté Anthropic, corrigée par un correctif temporaire spécifique à l'appel direct. Une autre stack technique pourrait soit ne pas avoir ce bug, soit le réintroduire.

## T.3 — Divergences de nommage des réglages selon le fournisseur / la passerelle

| Réglage produit | Anthropic (direct) | OpenAI | Bedrock | Remarque |
|---|---|---|---|---|
| Longueur max de réponse | `maxOutputTokens` | `max_tokens` | `maxTokens` | Nom différent à chaque fois ; plafonds par modèle codés en dur côté app. |
| Diversité (top P) | `topP` | `top_p` | `topP` | Casse différente (camelCase vs snake_case). |
| Variété (top K) | `topK` | — | `topK` | Pas toujours supporté ; incompatible avec certains modes de réflexion. |
| Identifiant du modèle | forme directe | id du fournisseur | préfixe éditeur | Les IDs diffèrent entre appel direct, Bedrock et Vertex (chemin éditeur). |
| Réflexion (thinking) | supporté | (raisonnement OpenAI) | format différent | Support et format de la réflexion varient entre direct, Vertex et Bedrock. |
| Affichage de la réflexion | `auto` est une valeur interne app | — | — | Le niveau « auto » n'existe pas tel quel côté API. |

## T.4 — Statuts : sources de vérité

- **Recherche de fichiers / base de connaissances → Actif (conditionné au déploiement du RAG)** : la fonction est exposée dans le constructeur d'assistant et opérationnelle dès que le service d'indexation (RAG API) est branché (`RAG_API_URL` défini). Le bug UX qui grisait la zone d'upload (capability `file_search` non ré-armée à la re-sélection d'un assistant) est corrigé ; reste à activer le service RAG en cible (déployé en POC local, à pousser en cluster).
- **Exécution de code → POC / hors prod** : faisabilité prouvée en local, déploiement prévu en V2 ; le service hébergé historique est en fin de vie, un hébergement maison est à prévoir.
- **Recherche web native → Actif** : exposée dans le panneau Paramètres pour les fournisseurs qui la supportent nativement.
- **Recherche web pipeline interne (tiers) → Désactivé** : masquée dans l'interface, réservée à terme aux administrateurs.
- **Multi-agent / sous-assistants → Avancé / non exposé** : capacités présentes mais absentes du constructeur d'assistant.

## T.5 — Autres réglages globaux de plateforme

- Profondeur max d'étapes par défaut (25) et plafond absolu (25).
- Nombre max de citations dans une réponse (30) et par fichier (7).
- Seuil minimal de pertinence des sources (0,45).
- Liste des fournisseurs autorisés pour les assistants.
- Possibilité de désactiver entièrement le constructeur d'assistant.

## T.6 — Version JSON

```json
[
  { "key": "name", "nom_lisible": "Nom & description", "description_simple": "Le nom de l'assistant et une courte description de son rôle.", "statut": "Actif", "provider": "all" },
  { "key": "instructions", "nom_lisible": "Instructions", "description_simple": "Les consignes de fond : rôle, ton, ce qu'il doit faire ou éviter. Le cœur de sa personnalité.", "statut": "Actif", "provider": "all" },
  { "key": "web_search", "nom_lisible": "Recherche web", "description_simple": "L'assistant peut aller chercher des infos à jour sur le web pendant qu'il répond.", "statut": "Actif", "provider": "anthropic, openai, google" },
  { "key": "tool_resources.file_search", "nom_lisible": "Base de connaissances (recherche dans des fichiers)", "description_simple": "Documents attachés à l'assistant pour qu'il puisse s'y référer.", "statut": "Actif (conditionné au déploiement du RAG)", "provider": "all" },
  { "key": "tool_resources.context", "nom_lisible": "Fichiers joints à la conversation", "description_simple": "Joindre un fichier dans l'échange pour que l'assistant le prenne en compte sur le moment.", "statut": "Actif", "provider": "all" },
  { "key": "execute_code", "nom_lisible": "Exécution de code", "description_simple": "L'assistant peut écrire et lancer du code pour calculer ou traiter des données.", "statut": "POC / hors prod", "provider": "all" },
  { "key": "tools", "nom_lisible": "Outils intégrés", "description_simple": "Outils prêts à l'emploi qu'on peut activer sur un assistant via « Ajouter des outils » dans le constructeur.", "statut": "Actif", "provider": "all" },
  { "key": "mcp", "nom_lisible": "Connecteurs MCP", "description_simple": "Permet de brancher l'assistant à des sources/outils externes ; pas encore ouvert aux utilisateurs.", "statut": "Présent mais non exposé en V1 — l'entrée de menu est masquée (feature flag SHOW_MCP_SIDEBAR_ITEM), non testé.", "provider": "all" },
  { "key": "actions", "nom_lisible": "Actions", "description_simple": "Connecter l'assistant à un service externe via son API pour déclencher des opérations.", "statut": "Présent dans le builder — non testé à ce jour, aucune action préconfigurée.", "provider": "all" },
  { "key": "skills", "nom_lisible": "Compétences (skills)", "description_simple": "Activer un catalogue de savoir-faire prêts à l'emploi, en totalité ou une sélection.", "statut": "Actif", "provider": "all" },
  { "key": "memory", "nom_lisible": "Mémoire personnelle de l'utilisateur", "description_simple": "L'assistant retient des infos propres à chaque utilisateur d'une conversation à l'autre.", "statut": "Actif", "provider": "all" },
  { "key": "agentId", "nom_lisible": "Mémoire personnelle rattachée à un assistant", "description_simple": "Rattache une mémoire personnelle à un assistant donné plutôt qu'au compte global de l'utilisateur.", "statut": "Actif (spécifique Vermeer)", "provider": "all" },
  { "key": "shared_memory", "nom_lisible": "Mémoire partagée de l'assistant", "description_simple": "Mémoire remplie à la main par le créateur, partagée avec tous ceux qui reçoivent l'assistant.", "statut": "Actif (spécifique Vermeer)", "provider": "all" },
  { "key": "conversation_starters", "nom_lisible": "Phrases d'amorce", "description_simple": "Suggestions de questions affichées au démarrage pour lancer la discussion.", "statut": "Actif", "provider": "all" },
  { "key": "artifacts", "nom_lisible": "Artefacts", "description_simple": "L'assistant peut produire un résultat affiché dans un panneau dédié.", "statut": "Actif", "provider": "all" },
  { "key": "avatar", "nom_lisible": "Avatar", "description_simple": "L'image qui représente l'assistant.", "statut": "Actif", "provider": "all" },
  { "key": "category", "nom_lisible": "Catégorie", "description_simple": "Le classement de l'assistant pour le retrouver dans la marketplace interne.", "statut": "Actif", "provider": "all" },
  { "key": "support_contact", "nom_lisible": "Contact support", "description_simple": "Un nom et un email de contact affichés pour les questions sur l'assistant.", "statut": "Actif", "provider": "all" },
  { "key": "recursion_limit", "nom_lisible": "Nombre max d'étapes", "description_simple": "Nombre maximum d'étapes que l'assistant peut enchaîner seul avant de s'arrêter.", "statut": "Avancé / non exposé", "provider": "all" },
  { "key": "edges", "nom_lisible": "Enchaînement de plusieurs assistants (multi-agent)", "description_simple": "Faire travailler plusieurs assistants à la chaîne en se passant la main.", "statut": "Avancé / non exposé", "provider": "all" },
  { "key": "subagents", "nom_lisible": "Sous-assistants", "description_simple": "Un assistant peut déléguer une partie du travail à des assistants enfants dans un espace isolé.", "statut": "Avancé / non exposé", "provider": "all" },
  { "key": "tool_options", "nom_lisible": "Réglages fins des outils", "description_simple": "Options techniques sur la manière dont les outils sont chargés et qui peut les appeler.", "statut": "Avancé / non exposé", "provider": "all" },
  { "key": "temperature", "nom_lisible": "Créativité (température)", "description_simple": "Règle si l'assistant répond plutôt de façon créative et variée, ou plutôt factuelle et prévisible.", "statut": "Actif", "provider": "all" },
  { "key": "maxOutputTokens", "nom_lisible": "Longueur max de réponse", "description_simple": "La taille maximale de la réponse que l'assistant peut produire.", "statut": "Actif", "provider": "all" },
  { "key": "maxContextTokens", "nom_lisible": "Taille de contexte prise en compte", "description_simple": "La quantité de conversation et de documents que l'assistant garde en tête pour répondre.", "statut": "Actif", "provider": "all" },
  { "key": "topP", "nom_lisible": "Diversité du vocabulaire (top P)", "description_simple": "Autre façon de doser la variété des réponses.", "statut": "Actif", "provider": "all" },
  { "key": "promptPrefix", "nom_lisible": "Consignes système additionnelles", "description_simple": "Un texte de cadrage ajouté en plus des instructions principales.", "statut": "Actif", "provider": "all" },
  { "key": "modelLabel", "nom_lisible": "Nom affiché du modèle", "description_simple": "Un libellé personnalisé pour le modèle.", "statut": "Actif", "provider": "all" },
  { "key": "resendFiles", "nom_lisible": "Renvoyer les fichiers à chaque tour", "description_simple": "Représente les fichiers joints à chaque échange (réglage par défaut qui convient presque toujours).", "statut": "Avancé / non exposé", "provider": "all" },
  { "key": "fileTokenLimit", "nom_lisible": "Limite de taille par fichier", "description_simple": "Plafonne la quantité de texte lue dans un fichier donné.", "statut": "Actif", "provider": "all" },
  { "key": "stop", "nom_lisible": "Séquences d'arrêt", "description_simple": "Des mots-clés qui font stopper la réponse dès qu'ils apparaissent.", "statut": "Actif", "provider": "openai" },
  { "key": "thinking", "nom_lisible": "Réflexion approfondie", "description_simple": "L'assistant prend le temps de réfléchir avant de répondre, pour les questions complexes.", "statut": "Actif", "provider": "anthropic, google" },
  { "key": "thinkingBudget", "nom_lisible": "Budget de réflexion", "description_simple": "La quantité d'effort de réflexion autorisée avant de répondre.", "statut": "Actif", "provider": "anthropic, google" },
  { "key": "effort", "nom_lisible": "Niveau d'effort", "description_simple": "Règle l'intensité de raisonnement, du plus léger au plus poussé.", "statut": "Actif", "provider": "anthropic" },
  { "key": "thinkingDisplay", "nom_lisible": "Affichage de la réflexion", "description_simple": "Choisit si le raisonnement de l'assistant est montré, résumé ou caché.", "statut": "Actif", "provider": "anthropic" },
  { "key": "topK", "nom_lisible": "Variété (top K)", "description_simple": "Encore une autre façon de doser la variété des réponses.", "statut": "Actif", "provider": "anthropic, google" },
  { "key": "promptCache", "nom_lisible": "Mise en cache du prompt", "description_simple": "Optimisation qui accélère et réduit le coût des échanges répétés.", "statut": "Actif", "provider": "anthropic" },
  { "key": "reasoning_effort", "nom_lisible": "Effort de raisonnement", "description_simple": "Règle combien le modèle réfléchit avant de répondre.", "statut": "Actif", "provider": "openai" },
  { "key": "reasoning_summary", "nom_lisible": "Résumé du raisonnement", "description_simple": "Choisit le niveau de détail du raisonnement montré.", "statut": "Actif", "provider": "openai" },
  { "key": "verbosity", "nom_lisible": "Niveau de verbosité", "description_simple": "Règle si les réponses sont plutôt courtes ou plutôt détaillées.", "statut": "Actif", "provider": "openai" },
  { "key": "imageDetail", "nom_lisible": "Détail d'analyse d'image", "description_simple": "Le niveau de finesse avec lequel les images sont analysées.", "statut": "Actif", "provider": "openai" },
  { "key": "frequency_penalty / presence_penalty", "nom_lisible": "Anti-répétition (pénalités)", "description_simple": "Deux réglages qui découragent l'assistant de se répéter.", "statut": "Actif", "provider": "openai" },
  { "key": "useResponsesApi", "nom_lisible": "Mode de connexion à l'API", "description_simple": "Choix technique de la façon de dialoguer avec OpenAI.", "statut": "Actif", "provider": "openai" },
  { "key": "disableStreaming", "nom_lisible": "Désactiver le streaming", "description_simple": "Afficher la réponse d'un seul bloc plutôt que mot à mot.", "statut": "Actif", "provider": "openai" },
  { "key": "thinkingLevel", "nom_lisible": "Niveau de réflexion (Google)", "description_simple": "Équivalent des réglages de réflexion, version Google.", "statut": "S'applique aux modèles de ce fournisseur lorsqu'ils sont configurés", "provider": "google" },
  { "key": "web_search_google", "nom_lisible": "Recherche web (Google)", "description_simple": "Recherche web, version Google.", "statut": "S'applique aux modèles de ce fournisseur lorsqu'ils sont configurés", "provider": "google" },
  { "key": "region / system", "nom_lisible": "Région & consignes système", "description_simple": "Réglages d'hébergement et de cadrage propres à Amazon Bedrock.", "statut": "S'applique aux modèles de ce fournisseur lorsqu'ils sont configurés", "provider": "bedrock" }
]
```
