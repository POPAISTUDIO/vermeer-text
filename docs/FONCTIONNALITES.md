# Vermeer Chat — Fonctionnalités

**Version : v0.10.10 — 28 juin 2026**

Ce document décrit les fonctionnalités de Vermeer Chat telles qu'elles sont
disponibles pour les utilisateurs. Il sert de référence produit et de base aux
communications.

**Légende des statuts :**
- **Actif** — disponible pour les utilisateurs.
- **Désactivable** — présent dans l'outil mais volontairement masqué pour le moment.
- **Conditionnel** — dépend d'une configuration ou d'un paramétrage.

Sauf mention contraire, les fonctionnalités s'appliquent aux trois entités :
**POP, BETC et BETC Fullsix**.

---

## Modèles

- **Accès multi-modèles** — Vermeer Chat donne accès à Claude (Anthropic), GPT
  (OpenAI), Gemini (Google) ainsi qu'à des modèles français. *Actif.*
- **Choix du modèle** — vous sélectionnez le modèle utilisé pour chaque
  conversation. *Actif.*

## Recherche & sources

- **Recherche web intégrée** — Claude, GPT et Gemini peuvent consulter le web en
  temps réel pour enrichir leurs réponses. Activée par défaut, vous pouvez la
  désactiver à tout moment dans les paramètres de la conversation. *Actif.*

## Agents & assistants

- **Mes assistants (constructeur)** — créez vos propres assistants : nom,
  description, instructions, fichiers de référence et réglages. *Actif.*
- **Conversations partagées sur un assistant** — partagez une conversation avec
  les personnes ayant accès à un assistant, et reprenez celles des autres pour
  poursuivre le travail. *Actif* (selon vos droits d'accès à l'assistant).
- **Galerie d'assistants (Marketplace)** — espace de découverte d'assistants.
  *Désactivable* (masqué pour le moment).

## Connaissances (RAG)

- **Recherche dans vos fichiers** — joignez des documents à un assistant ; il
  s'appuie sur leur contenu pour répondre. *Actif.*

## Mémoire

- **Mémoire personnelle** — l'assistant peut retenir des informations vous
  concernant pour des échanges plus pertinents. Elle est strictement personnelle
  et ne circule jamais entre utilisateurs ni entre entités. *Actif.*
- **Mémoire partagée d'un assistant** — le créateur d'un assistant peut y inscrire
  une mémoire « métier » curée, qui accompagne l'assistant lorsqu'il est partagé.
  Portée par un partage volontaire, elle peut être commune à POP et BETC. *Actif.*

## Comparaison

- **Comparaison de modèles** — posez la même question à plusieurs modèles en
  parallèle pour comparer leurs réponses. *Actif.*

## Interface & expérience

- **Thème sombre Vermeer** — interface premium en mode sombre, à l'identité
  Vermeer. *Actif.*
- **Suggestions d'accueil** — à l'ouverture, quatre pistes d'usage orientées
  métier agence pour démarrer plus vite. *Actif.*
- **Barre de saisie épurée** — composer simplifié, centré sur l'essentiel.
  *Actif.*
- **Français et anglais** — interface en français (et anglais). *Actif*
  (francisation en cours sur certaines zones plus récentes).

## Remontée & support

- **Signaler un problème** — un bouton dans le menu de compte ouvre un formulaire
  de remontée. *Conditionnel* (visible si l'adresse de remontée est configurée).
- **Contact support d'un assistant** — un assistant peut afficher un contact
  (nom et e-mail) pour les questions le concernant. *Actif.*

## Gouvernance & accès

- **Connexion sécurisée (SSO)** — en production, l'accès se fait via le SSO de
  l'organisation. *Actif.*
- **Rattachement à votre entité** — chaque utilisateur est automatiquement
  rattaché à son entité (POP, BETC, BETC Fullsix, BETC Etoile Rouge, Maison
  BETC), ce qui permet un suivi de consommation par entité. *Actif.*

## Budget

- **Jauge de consommation** — sous la barre de saisie, une jauge indique votre
  consommation du mois par rapport à votre budget. *Actif.*
- **Administration des budgets** — les administrateurs définissent les seuils par
  utilisateur et consultent les tableaux de consommation (analytics, répartition
  par modèle, export). *Actif.*
