import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fixturesDir } from './env';

const generator = path.join(fixturesDir, 'make.mjs');

/**
 * Rend le chemin d'une fixture, en la générant si elle est absente.
 * Les deux grosses fixtures ne sont pas versionnées (cf. .gitignore) : elles sont
 * reconstruites à l'identique par `fixtures/make.mjs`, y compris en CI.
 */
export function fixture(name: string): string {
  const target = path.join(fixturesDir, name);
  if (!fs.existsSync(target)) {
    execFileSync(process.execPath, [generator, name], { stdio: 'inherit' });
  }
  if (!fs.existsSync(target)) {
    throw new Error(`Fixture ${name} introuvable et non générable (${generator}).`);
  }
  return target;
}

export const SMALL_IMAGE = 'sample-small.png';
export const MEDIUM_IMAGE = 'sample-1.5mb.png';
export const LARGE_IMAGE = 'sample-8mb.png';
