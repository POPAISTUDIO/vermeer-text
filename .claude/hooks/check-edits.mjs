#!/usr/bin/env node
// PostToolUse / Write|Edit — trois controles Vermeer, non bloquants, injectes en contexte.
//   1. traduction touchee   -> parite EN/FR (.claude/scripts/i18n-parity.mjs)
//   2. librechat*.yaml       -> parse YAML (fail-fast §11 : un yaml invalide = appli down)
//   3. fichier sous concern  -> rappel de la watchlist CLAUDE.md §11 avec les lignes a relire
// Silencieux quand tout va bien et quand le fichier ne concerne aucun des trois cas.
// Silencieux aussi en degradation : si js-yaml n'est pas resoluble (CI sans node_modules) ou si
// CLAUDE.md est illisible, le controle concerne est saute — jamais d'alerte faute d'outil.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve, relative, basename } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

let payload;
try {
  payload = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const raw = payload?.tool_input?.file_path ?? payload?.tool_response?.filePath;
if (typeof raw !== 'string' || !raw) process.exit(0);

const abs = resolve(ROOT, raw);
const rel = relative(ROOT, abs);
if (rel.startsWith('..')) process.exit(0);

const notes = [];

if (/^client\/src\/locales\/(en|fr)\/translation\.json$/.test(rel)) {
  try {
    const out = execFileSync('node', [resolve(ROOT, '.claude/scripts/i18n-parity.mjs')], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    if (/ERREUR|WARN/.test(out)) notes.push(out.trim());
  } catch (err) {
    notes.push((err.stdout || err.message || '').toString().trim());
  }
}

if (/^librechat[^/]*\.ya?ml$/.test(rel)) {
  // Dependance irresoluble (CI sans node_modules) : on se tait. On ne signale que ce qu'on a
  // reellement pu parser — un "YAML INVALIDE" faute de js-yaml serait une fausse alerte.
  let yaml;
  try {
    yaml = createRequire(resolve(ROOT, 'package.json'))('js-yaml');
  } catch {
    yaml = null;
  }
  if (yaml) {
    try {
      yaml.load(readFileSync(abs, 'utf8'));
    } catch (err) {
      notes.push(
        `YAML INVALIDE dans ${rel} — ${err.message}\nRappel CLAUDE.md §11 : toute erreur de validation fait sortir le process en code 1 (boot casse, pas de mode degrade).`,
      );
    }
  }
}

// Les entrees en accolades (dir/{A,B}.tsx) n'ecrivent aucun chemin complet : on les eclate.
// Retourne le jeton tel qu'il figure dans CLAUDE.md, pour pouvoir en citer les lignes.
const braceEntry = (region) => {
  for (const m of region.matchAll(/`([\w@./-]+\/)\{([^}]+)\}(\.[\w.]+)`/g)) {
    for (const name of m[2].split(',')) {
      if (`${m[1]}${name.trim()}${m[3]}` === rel) return m[0].replaceAll('`', '');
    }
  }
  return null;
};

// Un basename ne vaut comme preuve que s'il ne designe qu'un seul fichier du depot : sinon
// editer packages/api/src/endpoints/xai/llm.ts declencherait le concern de google/llm.ts.
// Unique, il reste utile pour les fichiers que §11 ne cite que par leur nom (MemorySwitch.tsx).
const uniqueBasename = () => {
  const base = basename(rel);
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--', `*/${base}`, base], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const hits = out.split('\0').filter(Boolean);
    return hits.length === 1 && hits[0] === rel ? base : null;
  } catch {
    return null;
  }
};

try {
  const claudeMd = readFileSync(resolve(ROOT, 'CLAUDE.md'), 'utf8');
  const start = claudeMd.indexOf('- **Code natif LibreChat modifié');
  const end = claudeMd.indexOf('\n## 12', start);
  if (start !== -1) {
    const region = claudeMd.slice(start, end === -1 ? undefined : end);
    const base = uniqueBasename();
    const needle =
      (region.includes(rel) && rel) ||
      braceEntry(region) ||
      (base && region.includes(base) && base) ||
      null;
    if (needle) {
      const lines = claudeMd.split('\n');
      const at = lines
        .map((line, i) => (line.includes(needle) ? i + 1 : 0))
        .filter(Boolean)
        .slice(0, 4);
      notes.push(
        `WATCHLIST §11 · ${rel} est du code natif LibreChat porteur d'un concern Vermeer (CLAUDE.md, lignes ${at.join(', ')}).\n` +
          `Avant de valider cette edition : relire le concern, verifier qu'aucun garde-fou documente n'est retire sans remplacement, et mettre a jour le concern dans CLAUDE.md §11 si le comportement change (skill /watchlist).`,
      );
    }
  }
} catch {
  /* CLAUDE.md illisible : on ne bloque pas l'edition */
}

if (!notes.length) process.exit(0);

const context = notes.join('\n\n');
console.log(
  JSON.stringify({
    systemMessage: `Vermeer · ${notes.length} point(s) de vigilance sur ${rel}`,
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: context },
  }),
);
process.exit(0);
