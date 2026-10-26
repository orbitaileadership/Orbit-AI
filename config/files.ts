/** Maximum original document size accepted by private Storage (512 MiB). */
export const MAX_DOCUMENT_UPLOAD_BYTES = 512 * 1024 * 1024;
/** Keep request-time parsing small; larger files are processed by the document worker. */
export const INLINE_INDEX_BYTES = 20 * 1024 * 1024;
/** Supabase recommends resumable uploads above 6 MiB. */
export const RESUMABLE_UPLOAD_BYTES = 6 * 1024 * 1024;
