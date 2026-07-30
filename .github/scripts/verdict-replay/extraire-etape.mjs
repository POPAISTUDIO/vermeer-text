#!/usr/bin/env node
// Extrait le script VIVANT de l'étape « Verdict livrable » depuis
// .github/workflows/claude.yml.
//
// Pourquoi ne pas recopier ce shell dans le harnais : une copie divergerait, et le test de
// garde ne testerait plus le gate réel mais son fossile. Même règle que le rejeu du triage
// (.github/scripts/triage-replay/extraire-prompt.py).
//
// Les expressions ${{ ... }} de contexte GitHub sont substituées par des variables shell,
// pour que la fixture pilote le contexte. Toute expression non prévue fait sortir en erreur —
// un placeholder renommé en amont doit CASSER le test, pas le contourner.
//
// Dépendance : js-yaml, déjà présent à la racine du dépôt.
//
// Usage : node extraire-etape.mjs <claude.yml>
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml');

const JOB = 'claude-autofix';
const ETAPE = 'Verdict livrable';

// Le shell de l'étape ne lit son contexte que par $GH_TOKEN / $REPO / $ISSUE / $RUN_URL,
// tous définis dans son bloc `env:`. Ce sont les valeurs de ce bloc qui portent les
// expressions GitHub — le script lui-même n'en contient aucune. On vérifie les deux.
const SUBSTITUTIONS = new Map([
  ['${{ secrets.GITHUB_TOKEN }}', '$GH_TOKEN'],
  ['${{ github.repository }}', '$REPO'],
  ['${{ github.event.issue.number }}', '$ISSUE'],
  ['${{ github.server_url }}', '$GITHUB_SERVER_URL'],
  ['${{ github.run_id }}', '$GITHUB_RUN_ID'],
]);

const echouer = (message) => {
  process.stderr.write(`ERREUR: ${message}\n`);
  process.exit(1);
};

const chemin = process.argv[2];
if (!chemin) {
  echouer('usage : node extraire-etape.mjs <claude.yml>');
}

const workflow = yaml.load(readFileSync(chemin, 'utf8'));
const job = workflow?.jobs?.[JOB];
if (!job) {
  echouer(`aucun job « ${JOB} » dans ${chemin} — le harnais ne sait plus quoi tester.`);
}

const correspondantes = (job.steps ?? []).filter((etape) => etape?.name === ETAPE);
if (correspondantes.length !== 1) {
  echouer(
    `${correspondantes.length} étape(s) nommée(s) « ${ETAPE} » dans ${chemin} — ` +
      'adapter ce script en même temps que le workflow.',
  );
}

const etape = correspondantes[0];
const script = etape.run;
if (!script) {
  echouer(`aucun bloc run: dans l'étape « ${ETAPE} ».`);
}
if (script.includes('${{')) {
  echouer(
    'le shell de l\'étape contient une expression GitHub en dur. Le harnais ne substitue ' +
      'que le bloc env: — déplacer cette valeur dans env:, ou étendre ce script.',
  );
}

// Le bloc env: devient un préambule shell : la fixture fournit REPO/ISSUE/... par
// l'environnement, le préambule ne fait que reproduire le câblage réel du workflow.
const lignesEnv = [];
for (const [nom, expression] of Object.entries(etape.env ?? {})) {
  let valeur = String(expression);
  for (const [jeton, remplacement] of SUBSTITUTIONS) {
    valeur = valeur.split(jeton).join(remplacement);
  }
  if (valeur.includes('${{')) {
    echouer(
      `l'entrée env: « ${nom} » contient une expression GitHub non prévue : ${expression}. ` +
        'Étendre SUBSTITUTIONS plutôt que neutraliser la vérification.',
    );
  }
  lignesEnv.push(`export ${nom}="${valeur}"`);
}

process.stdout.write(`${lignesEnv.join('\n')}\n\n${script}`);
