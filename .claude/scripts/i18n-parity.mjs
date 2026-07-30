#!/usr/bin/env node
// Controle de parite EN/FR des fichiers de traduction Vermeer.
// Applique les regles de CLAUDE.md (Partie 2 > Localization) :
//   - EN fait foi : une cle FR absente de EN est une erreur
//   - interpolations {{xxx}} preservees a l'identique
//   - apostrophes ASCII uniquement, jamais typographiques
//   - pas d'espace insecable (U+00A0 / U+202F)
//   - JSON valide des deux cotes
// Usage : node .claude/scripts/i18n-parity.mjs [--json]
// Sortie : rapport texte (ou JSON) ; code 1 si au moins une ERREUR.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const EN = resolve(ROOT, 'client/src/locales/en/translation.json');
const FR = resolve(ROOT, 'client/src/locales/fr/translation.json');

const errors = [];
const warnings = [];
const info = [];

const load = (path, label) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    errors.push(`${label} : JSON invalide — ${err.message}`);
    return null;
  }
};

const en = load(EN, 'en/translation.json');
const fr = load(FR, 'fr/translation.json');

const interpolations = (value) =>
  typeof value === 'string' ? [...value.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1]).sort() : [];

if (en && fr) {
  const enKeys = Object.keys(en);
  const frKeys = Object.keys(fr);
  const enSet = new Set(enKeys);
  const frSet = new Set(frKeys);

  const orphans = frKeys.filter((k) => !enSet.has(k));
  if (orphans.length) {
    errors.push(`${orphans.length} cle(s) FR absente(s) de EN (EN fait foi) : ${orphans.slice(0, 10).join(', ')}`);
  }

  const missing = enKeys.filter((k) => !frSet.has(k));
  info.push(`Couverture FR : ${frKeys.length}/${enKeys.length} (${((frKeys.length / enKeys.length) * 100).toFixed(1)} %), ${missing.length} cle(s) EN sans FR`);

  for (const key of frKeys) {
    if (!enSet.has(key)) continue;
    const enValue = en[key];
    const frValue = fr[key];

    const a = interpolations(enValue).join('|');
    const b = interpolations(frValue).join('|');
    if (a !== b) {
      errors.push(`${key} : interpolations divergentes — EN {{${a || '—'}}} vs FR {{${b || '—'}}}`);
    }

    if (typeof frValue !== 'string') continue;
    if (frValue.includes('’')) {
      errors.push(`${key} : apostrophe typographique (U+2019) en FR — utiliser l'ASCII '`);
    }
    if (/[  ]/.test(frValue)) {
      errors.push(`${key} : espace insecable en FR (U+00A0/U+202F) — le repo utilise des espaces normaux`);
    }
    if (frValue.trim() === '') {
      warnings.push(`${key} : valeur FR vide`);
    }
  }

  const unsorted = frKeys.findIndex((k, i) => i > 0 && k.localeCompare(frKeys[i - 1], 'en') < 0);
  if (unsorted > 0) {
    warnings.push(
      `Ordre FR non alphabetique a partir de "${frKeys[unsorted]}" (apres "${frKeys[unsorted - 1]}") — verifier la convention d'insertion`,
    );
  }
}

const report = { errors, warnings, info };

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const line of info) console.log(`i18n · ${line}`);
  for (const line of warnings) console.log(`i18n WARN · ${line}`);
  for (const line of errors) console.log(`i18n ERREUR · ${line}`);
  if (!errors.length) console.log('i18n · parite EN/FR OK (cles, interpolations, apostrophes, espaces)');
}

process.exit(errors.length ? 1 : 0);
