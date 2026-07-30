#!/usr/bin/env node
// PreToolUse / Bash — garde-fous §6 du CLAUDE.md Vermeer.
// Deux regles seulement, toutes deux documentees :
//   1. "Ne pas pousser sur main sans review"  -> ask (validation explicite de l'humaine)
//   2. "Ne pas commit le .env"                -> deny (aucune exception ; .env.example est libre)
// Tout le reste passe sans bruit.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let payload;
try {
  payload = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const command = payload?.tool_input?.command;
if (typeof command !== 'string' || !command.trim()) process.exit(0);

const decide = (decision, reason) => {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
};

const segments = command
  .split(/&&|\|\||;|\n|\|/)
  .map((s) => s.trim())
  .filter(Boolean);

// Hors depot git (CI, sandbox), git ecrit "fatal: not a git repository" sur stderr : on l'etouffe.
// Un hook doit sortir proprement — pas de verdict, pas de bruit.
const currentBranch = () => {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
};

for (const segment of segments) {
  const args = segment.split(/\s+/);
  if (args[0] !== 'git') continue;
  const verb = args[1];

  if (verb === 'push') {
    const rest = args.slice(2).filter((a) => !a.startsWith('-'));
    const targetsMain = rest.some((a) => /(^|[:/])(main|master)$/.test(a));
    const noRefspec = rest.length <= 1;
    if (targetsMain || (noRefspec && /^(main|master)$/.test(currentBranch()))) {
      decide(
        'ask',
        "Garde-fou CLAUDE.md §6 : ne pas pousser sur main sans review. main est aussi protege par le ruleset « Ecluse main » cote GitHub — le chemin normal est une branche + PR. Confirme seulement si c'est un push de tag ou une poussee deliberement validee.",
      );
    }
  }

  if (verb === 'add' || (verb === 'commit' && args.includes('-a'))) {
    const dotEnv = args
      .slice(2)
      .filter((a) => !a.startsWith('-'))
      .find((a) => /(^|\/)\.env(\.[^/]*)?$/.test(a) && !/\.env\.example$/.test(a));
    if (dotEnv) {
      decide(
        'deny',
        `Garde-fou CLAUDE.md §6 : ne jamais indexer ${dotEnv} — il porte les cles API (Anthropic, OpenAI, AWS, CREDS_KEY/CREDS_IV). Le fichier versionne est .env.example.`,
      );
    }
  }
}

process.exit(0);
