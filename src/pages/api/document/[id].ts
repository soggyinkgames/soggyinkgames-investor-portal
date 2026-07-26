/**
 * /investors/api/document/[id]
 * 
 * Serves a document to an authenticated, approved investor.
 * 
 * Flow:
 * 1. Verify investor session + role
 * 2. Look up document record + check access_level
 * 3. Download file from Supabase Storage
 * 4. For PDFs: watermark with investor's email + timestamp
 * 5. Return the (watermarked) file bytes
 * 
 * Documents are NEVER served as public static links.
 * This endpoint is the only way to access document bytes.
 */
import type { APIRoute } from 'astro';
import { createSupabaseClient, createSupabaseAdmin } from '../../../lib/supabase';
import { watermarkPdf } from '../../../lib/watermark';
import { logEvent } from '../../../lib/events';

export const GET: APIRoute = async ({ params, cookies, request }) => {
  const documentId = params.id;

  if (!documentId) {
    return new Response('Document ID required', { status: 400 });
  }

  const supabase = createSupabaseClient(cookies, request);

  // Verify session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response('Unauthorised', { status: 401 });
  }

  // Look up investor
  const { data: investor } = await supabase
    .from('investors')
    .select('id, email, name, role, approved')
    .eq('email', user.email!)
    .single();

  if (!investor || !investor.approved) {
    return new Response('Forbidden', { status: 403 });
  }

  // Look up document
  const { data: document, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (docError || !document) {
    return new Response('Document not found', { status: 404 });
  }

  // Check access level
  if (document.access_level === 'invested' && investor.role !== 'invested') {
    return new Response('Forbidden — this document requires invested investor access', { status: 403 });
  }

  /**
 * Strips full host, bucket prefixes, or leading slashes 
 * leaving only the relative path inside the bucket.
 */
  function extractStoragePath(rawUrlOrPath: string, bucketName: string): string {
    if (!rawUrlOrPath) return '';

    let path = rawUrlOrPath;

    // 1. If it's a full URL, strip everything up to the bucket name
    if (path.includes('/storage/v1/object/')) {
      const parts = path.split(`/${bucketName}/`);
      if (parts.length > 1) {
        path = parts.slice(1).join(`/${bucketName}/`);
      }
    }

    // 2. Remove leading slashes if present
    path = path.replace(/^\/+/, '');

    // 3. If it starts with "bucketName/", strip it out
    if (path.startsWith(`${bucketName}/`)) {
      path = path.slice(bucketName.length + 1);
    }

    return path;
  }

  const storagePath = extractStoragePath(document.file_url, 'decks');

  // Use admin client to download from storage (bypasses RLS on storage)
  const adminSupabase = createSupabaseAdmin();
  const { data: fileData, error: downloadError } = await adminSupabase
    .storage
    .from('decks')
    .download(storagePath);

  if (downloadError || !fileData) {
    console.error('[document] Storage download failed:', downloadError);
    return new Response('Failed to retrieve document', { status: 500 });
  }

  const fileBytes = await fileData.arrayBuffer();
  const isPdf = document.file_url.toLowerCase().endsWith('.pdf') ||
    fileData.type === 'application/pdf';

  let responseBytes: Uint8Array | ArrayBuffer = fileBytes;
  let contentType = fileData.type || 'application/octet-stream';

  // Watermark PDFs
  if (isPdf) {
    try {
      responseBytes = await watermarkPdf(fileBytes, {
        viewerEmail: investor.email,
        viewerName: investor.name,
      });
      contentType = 'application/pdf';
    } catch (err) {
      console.error('[document] Watermarking failed:', err);
      // Fall back to un-watermarked (log the failure)
    }
  }

  // Log document_view event
  await logEvent(supabase, investor.id, 'document_view', documentId);

  // Return file with appropriate headers
  const filename = document.title.replace(/[^a-z0-9\-_. ]/gi, '_') + (isPdf ? '.pdf' : '');

  return new Response(responseBytes, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${filename}"`,
      // Prevent caching of sensitive documents
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
};
