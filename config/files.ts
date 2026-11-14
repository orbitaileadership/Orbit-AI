/** Safe release cap: accepted documents can be indexed without a hosted worker. */
export const MAX_DOCUMENT_UPLOAD_BYTES = 20 * 1024 * 1024;
/** Keep request-time parsing bounded. The upload cap must not exceed this while the worker is held. */
export const INLINE_INDEX_BYTES = 20 * 1024 * 1024;
/** Supabase recommends resumable uploads above 6 MiB. */
export const RESUMABLE_UPLOAD_BYTES = 6 * 1024 * 1024;
