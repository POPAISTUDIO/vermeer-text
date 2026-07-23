export type ProviderErrorKey =
  | 'invalid_request'
  | 'auth'
  | 'not_found'
  | 'rate_limit'
  | 'unavailable'
  | 'timeout';

/**
 * Vermeer: le status HTTP n'existe que cote serveur (logge dans Loki via le
 * « Provider error detail » du #50). Le client ne recoit qu'une string d'erreur
 * du SDK provider — format axios stable « ...failed with status code NNN »,
 * eventuellement prefixee par le wrapper serveur « An error occurred while
 * processing the request: ... ». Faute de code d'erreur structure cote client,
 * on pattern-matche cette string : approche assumee, tolerante aux deux formes.
 */
export function mapProviderError(text: string): ProviderErrorKey | null {
  if (!text) {
    return null;
  }

  const lower = text.toLowerCase();

  if (/\btimeout\b|timed out|etimedout|esockettimedout|deadline exceeded/.test(lower)) {
    return 'timeout';
  }

  if (/\b529\b|overloaded/.test(lower)) {
    return 'unavailable';
  }

  const statusMatch = lower.match(/status code (\d{3})/);
  const status = statusMatch ? parseInt(statusMatch[1], 10) : null;

  if (status === 400) {
    return 'invalid_request';
  }
  if (status === 401 || status === 403) {
    return 'auth';
  }
  if (status === 404) {
    return 'not_found';
  }
  if (status === 429) {
    return 'rate_limit';
  }
  if (status !== null && status >= 500 && status <= 599) {
    return 'unavailable';
  }

  if (/rate limit|too many requests/.test(lower)) {
    return 'rate_limit';
  }
  if (/unauthorized|forbidden|authentication|invalid.*api.?key|permission denied/.test(lower)) {
    return 'auth';
  }
  if (/not found|no such model|model.*(?:does not exist|not found)/.test(lower)) {
    return 'not_found';
  }
  if (/internal server error|bad gateway|service unavailable|server had an error/.test(lower)) {
    return 'unavailable';
  }
  if (/invalid request|bad request/.test(lower)) {
    return 'invalid_request';
  }

  return null;
}
