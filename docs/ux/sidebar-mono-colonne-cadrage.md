# Cadrage — Sidebar mono-colonne (réf. Claude.ai) + épinglage

> Statut : **chantier planifié, non démarré.** Cadrage produit validé le 2026-07-08.
> Aucun code n'est écrit sur ce chantier cette semaine. Ce document consigne
> l'analyse read-only et les arbitrages, pour servir de point de départ au
> kickoff ultérieur.

## Contexte

La sidebar gauche de Vermeer est un composant **custom** (`client/src/components/UnifiedSidebar/`),
pas le Nav stock de LibreChat. Elle suit un modèle **à deux panneaux** :

- un rail d'icônes étroit (`ExpandedPanel.tsx`), toujours visible ;
- un panneau de contenu large (`SidePanel/Nav.tsx` = `SidePanelNav`) qui affiche
  la section active, visible seulement quand la sidebar est ouverte.

La référence UX visée (Claude.ai) est **mono-colonne** : entrées de nav en haut,
liste des conversations en dessous, dans une seule colonne.

Ce cadrage évalue (1) la refonte mono-colonne et (2) un mécanisme d'épinglage
de conversations.

## 1. Architecture cible mono-colonne

La plomberie « deux panneaux » est mince et **100 % custom Vermeer** :

- `client/src/components/SidePanel/Nav.tsx` (~14 lignes) — rend le `Component`
  de l'unique section active.
- `client/src/Providers/ActivePanelContext.tsx` (~45 lignes) — `active`/`setActive`,
  `DEFAULT_PANEL = 'conversations'`, persisté en `localStorage`.
- `client/src/components/UnifiedSidebar/ExpandedPanel.tsx` + `Sidebar.tsx` —
  rail + panneau côte à côte.

Chaque entrée de nav (`client/src/hooks/Nav/useSideNavLinks.ts`) est aujourd'hui
un `link.Component` affiché dans le panneau large — **sauf** `admin-usage` qui
fait déjà `navigate('/d/usage')`.

### Enjeu central : destination des sections non-conversation

Dans une colonne étroite (~300px), les builders/tables ne tiennent pas. Chaque
section doit devenir **une route** ou **une modale**. La moitié a déjà une route.

| Section | Composant actuel | Destination cible | Effort | Risque |
|---|---|---|---|---|
| Conversations | `ConversationsSection` | Reste inline (liste sous la nav) | S | Faible |
| Skills | `SkillsAccordion` | Route existante `/skills*` | S | Faible |
| Prompts (masqué) | `PromptsAccordion` | Route existante `/prompts*` | S | Faible |
| Agents (builder) | `AgentPanelSwitch` | Route/plein écran (Marketplace `/agents*` existe déjà) | L | Moyen |
| Assistants (builder) | `PanelSwitch` | Builder route/plein écran | M-L | Moyen |
| Mémoires | `MemoryPanel` (autonome) | Modale ou route | M | Faible-Moyen |
| Fichiers | `FilesPanel` (autonome) | Modale | S-M | Faible |
| Signets | `BookmarkPanel` (autonome) | Modale | S | Faible |
| Paramètres | `Parameters` (lié `useChatContext`) | Modale/popover (contrôle live par conv) | M-L | Moyen |
| Usage (admin) | — | Déjà route `/d/usage` | — | Nul |

**Foyers de complexité** : `Parameters` (contrôle live lié au contexte chat, à
porter en modale sans perdre le `ChatContext`) et le **builder Agents/Assistants**
(UI large, nouveau « chez-soi » route/plein écran). Le reste est déjà routé ou
facilement modalisable.

La liste de conversations (`ConversationsSection` → `Conversations`, react-virtualized
+ `AutoSizer`) tombe directement sous la nav ; elle exige juste un conteneur
`flex-1 min-h-0 overflow-hidden` pour résoudre sa hauteur. Pas de couplage au
modèle deux-panneaux.

## 2. Épinglage (pin)

État des lieux vérifié :

- **Pin de conversation natif : n'existe pas.** Aucun champ `pinned`/`favorite`/
  `starred` sur `Conversation` (`packages/data-schemas/src/schema/convo.ts`). Tri
  **uniquement par date** (`updatedAt` desc) ; le backend `getConvosByCursor`
  whiteliste les champs de tri (`title|createdAt|updatedAt`) et les encode dans
  le curseur de pagination.
- **Upstream : rien à backporter pour les conversations.** Les commits « pin »
  upstream visent agents / modèles / model-specs / MCP OAuth — pas les conversations.
- **Pattern pin déjà présent dans le fork** : « User Favorites — pinned agents,
  models, and model specs » (`packages/data-provider/src/types/queries.ts`) — pin
  **scopé utilisateur**, pas un champ sur l'objet épinglé. C'est le pattern à copier.
- **Système tags/bookmarks existant** : `tags: string[]` sur la conv + collection
  `ConversationTag` (avec `position`) + tag système `'Saved'`. Mais les tags
  **filtrent** seulement, ils ne **trient pas** vers le haut.

### Options évaluées

| Option | Principe | Modif schéma Conversation | Effort | Risque |
|---|---|---|---|---|
| A — tag `'Saved'` comme pin | Réutiliser le tag système | Non | M | Sémantique bancale (tag visible comme signet) ; tri à construire quand même |
| B — champ dédié `isPinned`/`pinnedAt` | Champ natif propre | **Oui** (garde-fou §6 + refonte tri/curseur backend) | M-H | Moyen-élevé |
| **C — liste `pinnedConversationIds` scopée user** | Miroir du pattern favorites | **Non** | M | **Faible-Moyen** |

Piège commun : une conv épinglée peut être en page 3 (non chargée) → un simple
tri front ne suffit pas. L'option C le contourne : le front connaît l'ensemble
épinglé de l'user, fetch ces convs par ids dans un groupe « Épinglé » rendu
au-dessus des groupes de date (`client/src/utils/convos.ts` → `groupConversationsByDate`),
sans modifier le tri paginé ni le curseur.

## 3. Effort & risque de divergence

Contexte : le fork est déjà ~160 commits devant / ~387 derrière upstream — les
merges sont non triviaux. Règle : rester dans le code custom Vermeer
(`UnifiedSidebar/*`) est peu risqué ; toucher les panneaux upstream ou le schéma
augmente le coût de merge futur.

| Bloc | Effort | Risque divergence |
|---|---|---|
| 1. Shell mono-colonne (retrait deux-panneaux) | M (~1,5-2 j) | Faible (fichiers custom Vermeer) |
| 2a. Re-homing sections routées (Skills/Prompts/Agents/Usage) | S (~0,5 j) | Faible (routes existent) |
| 2b. Modaliser Fichiers/Signets/Mémoires | M (~1-1,5 j) | Faible-Moyen |
| 2c. Paramètres en modale (préserver `ChatContext`) | M-L (~1-1,5 j) | Moyen |
| 2d. Home builder Agents/Assistants | L (~2-3 j) | Moyen |
| 3. Liste convs inline | S-M (~0,5-1 j) | Faible |
| 4. Pin — couche données (option C) | M (~1-1,5 j) | Faible-Moyen |
| 5. Pin — UI (menu pin/unpin + groupe « Épinglé ») | M (~1-1,5 j) | Faible |

**Total indicatif** : mono-colonne ~6-9 j, épinglage ~2-3 j.

## Arbitrages validés (2026-07-08)

1. **Priorité** : on livre d'abord le **rail labellisé** (branche `feat/sidebar-labels`,
   additif, faible risque). Le mono-colonne devient un **chantier planifié pour plus
   tard** — rien ne se code dessus cette semaine. Le rail labellisé et le mono-colonne
   sont des directions **alternatives** (le mono-colonne remplacerait le rail).
2. **Routes vs modales** : direction validée **dans le principe** ; on re-tranchera
   **écran par écran au kickoff** du chantier.
3. **Épinglage** : **option C** validée comme cible (liste `pinnedConversationIds`
   scopée user, miroir du pattern favorites, **sans modif du schéma Conversation**).
