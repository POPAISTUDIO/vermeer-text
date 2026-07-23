import { SKILL_NAME_MAX_LENGTH } from 'librechat-data-provider';

/**
 * Fallback identifier when a display title contains no Latin-alphanumeric
 * characters (e.g. a fully non-latin name). Guarantees the derived slug is
 * always a valid `SKILL_NAME_PATTERN` string.
 */
const FALLBACK_SLUG = 'skill';

/**
 * How many suffixed retries the create flow attempts before giving up when a
 * derived slug keeps colliding with an existing skill (same author + tenant).
 * In practice one or two suffixes always clear; the cap is a safety net.
 */
export const SLUG_COLLISION_MAX_ATTEMPTS = 25;

/** Trim leading/trailing hyphens produced by slicing or edge separators. */
function trimHyphens(value: string): string {
  return value.replace(/^-+|-+$/g, '');
}

/**
 * Derive a kebab-case skill identifier from a free-form display title.
 *
 * The result always satisfies the backend `SKILL_NAME_PATTERN`
 * (`/^[a-z0-9][a-z0-9-]*$/`) and the `SKILL_NAME_MAX_LENGTH` (64) limit:
 * diacritics are transliterated, everything outside `[a-z0-9]` collapses to a
 * single hyphen, and leading/trailing hyphens are stripped. An empty result
 * (fully non-latin input) falls back to `"skill"`.
 */
export function slugifySkillName(input: string): string {
  const slug = trimHyphens(
    input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-'),
  );
  const truncated = trimHyphens(slug.slice(0, SKILL_NAME_MAX_LENGTH));
  return truncated.length > 0 ? truncated : FALLBACK_SLUG;
}

/**
 * Append a numeric collision suffix (`-2`, `-3`, …) to a base slug, keeping the
 * total within `SKILL_NAME_MAX_LENGTH` by trimming the base if needed.
 */
export function withSlugSuffix(baseSlug: string, suffix: number): string {
  const tail = `-${suffix}`;
  const base = trimHyphens(baseSlug.slice(0, SKILL_NAME_MAX_LENGTH - tail.length)) || FALLBACK_SLUG;
  return `${base}${tail}`;
}

/**
 * Whether an error thrown by the create-skill mutation is a name-collision
 * (HTTP 409). Drives the silent suffix-retry loop; any other error surfaces
 * through the mutation's own error handler.
 */
export function isSkillNameConflict(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 409;
}
