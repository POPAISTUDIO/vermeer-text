import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { requireBaseUrl, requireServiceCredentials } from './lib/env';

/**
 * Les prérequis sont validés au chargement de la config : la suite échoue immédiatement,
 * avec un message explicite, plutôt qu'au milieu d'un test.
 *
 * `requireServiceCredentials()` est appelé ici pour sa seule valeur de garde — la session
 * elle-même est obtenue test par test par la fixture `storageState` (`lib/test.ts`), qui
 * relit les identifiants au moment du login. Aucun `storageState` n'est posé dans `use` :
 * il n'y a plus de fichier de session, donc plus rien à capturer ni à republier.
 */
const baseURL = requireBaseUrl();
requireServiceCredentials();

export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  outputDir: path.join(__dirname, 'test-results'),
  /* Un seul compte QA et de vrais appels LLM facturés : exécution strictement sérielle. */
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 150_000,
  expect: { timeout: 20_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ?? 'report.json' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
    ignoreHTTPSErrors: true,
  },
  projects: [
    /**
     * Garde de session : tourne EN PREMIER. Les tests de `chromium` en dépendent, donc
     * un échec ici les laisse non exécutés (statut « did not run ») au lieu de produire
     * une avalanche de faux échecs produit.
     */
    {
      name: 'guard',
      testMatch: /guard\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      dependencies: ['guard'],
      testIgnore: /guard\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
