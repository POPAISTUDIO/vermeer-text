import type { TranslationKeys } from '~/hooks';

type LocalizeFn = (key: TranslationKeys, options?: Record<string, string>) => string;

/**
 * Structured upload-error codes emitted by the backend upload routes. Kept in
 * sync with `UploadErrorCode` in `@librechat/api` (packages/api/src/utils/files.ts).
 */
export const UploadErrorCode = {
  FILE_SIZE_EXCEEDED: 'file_size_exceeded',
  UNSUPPORTED_FILE_TYPE: 'unsupported_file_type',
  INDEXING_UNAVAILABLE: 'indexing_unavailable',
  CAPABILITY_DISABLED: 'capability_disabled',
  EXTRACTION_FAILED: 'extraction_failed',
  GENERIC: 'generic',
} as const;

export interface UploadErrorData {
  code?: string;
  fileName?: string;
  sizeLimitMB?: number;
  mimeType?: string;
}

interface UploadErrorShape {
  response?: { data?: UploadErrorData };
}

const isUploadError = (error: unknown): error is UploadErrorShape =>
  typeof error === 'object' && error !== null && 'response' in error;

/**
 * Builds a localized, interpolated message from a structured upload-route
 * rejection (`{ code, fileName, sizeLimitMB, mimeType }`). Every branch returns
 * a localized string — the backend ships a stable code + metadata, never
 * user-facing prose, so nothing raw is shown (Vermeer #81 / message facet of
 * #77). Unknown or absent code falls back to a generic message (with the
 * filename when the route supplied one).
 *
 * The size limit is always dynamic: `sizeLimitMB` is derived server-side from
 * the effective `fileConfig` (no hardcoded value); if it's ever absent the
 * message degrades to the plain upload error rather than inventing a number.
 */
export function getUploadErrorMessage(error: unknown, localize: LocalizeFn): string {
  const data = isUploadError(error) ? error.response?.data : undefined;
  const fileName = data?.fileName ?? '';

  switch (data?.code) {
    case UploadErrorCode.FILE_SIZE_EXCEEDED:
      return data?.sizeLimitMB != null
        ? localize('com_error_files_upload_too_large', { 0: String(data.sizeLimitMB) })
        : localize('com_error_files_upload');
    case UploadErrorCode.UNSUPPORTED_FILE_TYPE:
      return localize('com_error_files_unsupported_type', {
        0: fileName,
        1: data?.mimeType ?? '',
      });
    case UploadErrorCode.INDEXING_UNAVAILABLE:
      return localize('com_error_files_indexing_unavailable', { 0: fileName });
    case UploadErrorCode.CAPABILITY_DISABLED:
      return localize('com_ui_attach_error_disabled');
    case UploadErrorCode.EXTRACTION_FAILED:
      return localize('com_error_files_extraction_failed', { 0: fileName });
    default:
      return fileName
        ? localize('com_error_files_generic', { 0: fileName })
        : localize('com_error_files_process');
  }
}
