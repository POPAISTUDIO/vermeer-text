import { getUploadErrorMessage, UploadErrorCode } from './uploadError';

/**
 * The backend upload routes ship a structured `{ code, fileName, sizeLimitMB,
 * mimeType }` payload (Vermeer #81); this helper maps it to a localized,
 * interpolated message. A fake `localize` echoes `key|arg0|arg1` so each test
 * asserts BOTH the chosen i18n key and the interpolated values, and proves no
 * raw backend prose is ever surfaced.
 */
const localize = ((key: string, opts?: Record<string, string>) =>
  opts ? `${key}|${opts['0'] ?? ''}|${opts['1'] ?? ''}` : key) as never;

const asError = (data: Record<string, unknown>) => ({ response: { data } });

describe('getUploadErrorMessage (#81 code → localized message)', () => {
  test('FILE_SIZE_EXCEEDED → too-large key with the dynamic MB limit', () => {
    const msg = getUploadErrorMessage(
      asError({ code: UploadErrorCode.FILE_SIZE_EXCEEDED, fileName: 'big.pdf', sizeLimitMB: 20 }),
      localize,
    );
    expect(msg).toBe('com_error_files_upload_too_large|20|');
  });

  test('FILE_SIZE_EXCEEDED without a limit → plain upload error (never invents a number)', () => {
    const msg = getUploadErrorMessage(
      asError({ code: UploadErrorCode.FILE_SIZE_EXCEEDED, fileName: 'big.pdf' }),
      localize,
    );
    expect(msg).toBe('com_error_files_upload');
  });

  test('UNSUPPORTED_FILE_TYPE → type key with filename + MIME type', () => {
    const msg = getUploadErrorMessage(
      asError({
        code: UploadErrorCode.UNSUPPORTED_FILE_TYPE,
        fileName: 'logo.png',
        mimeType: 'image/png',
      }),
      localize,
    );
    expect(msg).toBe('com_error_files_unsupported_type|logo.png|image/png');
  });

  test('INDEXING_UNAVAILABLE → dedicated indexing key with filename', () => {
    const msg = getUploadErrorMessage(
      asError({ code: UploadErrorCode.INDEXING_UNAVAILABLE, fileName: 'notes.txt' }),
      localize,
    );
    expect(msg).toBe('com_error_files_indexing_unavailable|notes.txt|');
  });

  test('CAPABILITY_DISABLED → attach-disabled key (no interpolation)', () => {
    const msg = getUploadErrorMessage(
      asError({ code: UploadErrorCode.CAPABILITY_DISABLED, fileName: 'x.pdf' }),
      localize,
    );
    expect(msg).toBe('com_ui_attach_error_disabled');
  });

  test('EXTRACTION_FAILED → extraction key with filename', () => {
    const msg = getUploadErrorMessage(
      asError({ code: UploadErrorCode.EXTRACTION_FAILED, fileName: 'scan.pdf' }),
      localize,
    );
    expect(msg).toBe('com_error_files_extraction_failed|scan.pdf|');
  });

  test('GENERIC with filename → generic key with filename', () => {
    const msg = getUploadErrorMessage(
      asError({ code: UploadErrorCode.GENERIC, fileName: 'thing.bin' }),
      localize,
    );
    expect(msg).toBe('com_error_files_generic|thing.bin|');
  });

  test('unknown / missing code with filename → generic key (no raw prose)', () => {
    expect(getUploadErrorMessage(asError({ fileName: 'thing.bin' }), localize)).toBe(
      'com_error_files_generic|thing.bin|',
    );
    expect(getUploadErrorMessage(asError({ code: 'something_new' }), localize)).toBe(
      'com_error_files_process',
    );
  });

  test('no response payload (network error) → generic process key', () => {
    expect(getUploadErrorMessage(new Error('Network Error'), localize)).toBe(
      'com_error_files_process',
    );
    expect(getUploadErrorMessage(undefined, localize)).toBe('com_error_files_process');
  });
});
