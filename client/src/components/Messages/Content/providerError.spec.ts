import { mapProviderError } from './providerError';

describe('mapProviderError', () => {
  describe('both string forms (bare and server-prefixed)', () => {
    const prefix = 'An error occurred while processing the request: ';

    it('matches the bare axios SDK form', () => {
      expect(mapProviderError('Google request failed with status code 400')).toBe(
        'invalid_request',
      );
    });

    it('matches the server-prefixed form', () => {
      expect(mapProviderError(`${prefix}Google request failed with status code 400`)).toBe(
        'invalid_request',
      );
    });
  });

  describe('HTTP status code families', () => {
    it('maps 400 to invalid_request', () => {
      expect(mapProviderError('request failed with status code 400')).toBe('invalid_request');
    });

    it('maps 401 and 403 to auth', () => {
      expect(mapProviderError('request failed with status code 401')).toBe('auth');
      expect(mapProviderError('request failed with status code 403')).toBe('auth');
    });

    it('maps 404 to not_found', () => {
      expect(mapProviderError('request failed with status code 404')).toBe('not_found');
    });

    it('maps 429 to rate_limit', () => {
      expect(mapProviderError('request failed with status code 429')).toBe('rate_limit');
    });

    it('maps 5xx to unavailable', () => {
      expect(mapProviderError('request failed with status code 500')).toBe('unavailable');
      expect(mapProviderError('request failed with status code 502')).toBe('unavailable');
      expect(mapProviderError('request failed with status code 503')).toBe('unavailable');
    });
  });

  describe('non-status families', () => {
    it('maps Anthropic 529 overloaded to unavailable', () => {
      expect(mapProviderError('Anthropic error 529 overloaded_error: Overloaded')).toBe(
        'unavailable',
      );
      expect(mapProviderError('the service is overloaded, please retry')).toBe('unavailable');
    });

    it('maps timeouts to timeout', () => {
      expect(mapProviderError('timeout of 30000ms exceeded')).toBe('timeout');
      expect(mapProviderError('ETIMEDOUT')).toBe('timeout');
      expect(mapProviderError('the operation timed out')).toBe('timeout');
    });

    it('falls back to keyword matching when no status code is present', () => {
      expect(mapProviderError('rate limit reached for requests')).toBe('rate_limit');
      expect(mapProviderError('Too Many Requests')).toBe('rate_limit');
      expect(mapProviderError('invalid x-api-key')).toBe('auth');
      expect(mapProviderError('Unauthorized')).toBe('auth');
      expect(mapProviderError('The model `gpt-x` does not exist or you do not have access')).toBe(
        'not_found',
      );
      expect(mapProviderError('Internal Server Error')).toBe('unavailable');
      expect(mapProviderError('Bad Request: unsupported parameter')).toBe('invalid_request');
    });
  });

  describe('precedence', () => {
    it('prefers timeout over an incidental status code', () => {
      expect(mapProviderError('request timed out with status code 504')).toBe('timeout');
    });

    it('prefers 529/overloaded over the generic 5xx branch', () => {
      expect(mapProviderError('overloaded, status code 503')).toBe('unavailable');
    });
  });

  describe('no match', () => {
    it('returns null for unrecognized text', () => {
      expect(mapProviderError('something completely unexpected happened')).toBeNull();
    });

    it('returns null for empty input', () => {
      expect(mapProviderError('')).toBeNull();
    });
  });
});
