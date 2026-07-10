# Vermeer Chat — Roadmap produit

**Version : v0.10.10 — 28 juin 2026**

Légende : **Livré** · **En cours** · **Next** · **Later**.
Périmètre : Vermeer Chat (POP / BETC / BETC Fullsix).

## Livré
- Lancement production (v0.10.6) — plateforme en service POP / BETC / BETC Fullsix.
- Recherche dans les fichiers (RAG) — opérationnelle en prod.
- Gestion budgétaire, mémoire et SSO OpenID — actifs en prod.
- Nouveaux modèles Anthropic (#13) ; correctif d'affichage file search (#14).
- Correctif recherche web 400 (#23) — validé en staging.
- Bouton « Signaler un problème » (#22) — livré en dev / staging.
- Docs de référence : FONCTIONNALITES, annexe technique, CONFIG-DRIFT.

## En cours
- Déploiement prod de v0.10.10 (image + activation REPORT_ISSUE_URL) — BLOQUÉ : chemin gitops prod non résolu (pas de dossier prod/ dans vermeer-gitops). Dépend d'Oussama. [à valider]
- Comms & adoption — drafts Direction + utilisateurs prêts ; session avec Eugénie planifiée.

## Next
- SSO / gouvernance par profil — capture companyName/department en place ; concevoir le gating par BU (capture-only d'abord). Prérequis : OPENID_REUSE_TOKENS à confirmer (Oussama). Identité / Entra : Lionel.
- Activation prod du bouton « Signaler un problème » — une fois REPORT_ISSUE_URL figé en gitops. [à confirmer]
- Réalignement config drift + rafraîchissement du CLAUDE.md — issu de CONFIG-DRIFT.md (balance, mémoire, RAG, socialLogins).

## Later
- Interpréteur de code / agents L2 — POC validé localement ; port vers Coder (reco Antoine) après stabilisation et durcissement sécurité.

> Convergence Ava : suivie séparément, hors de cette roadmap produit.
