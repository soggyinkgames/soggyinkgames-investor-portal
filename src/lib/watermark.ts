/**
 * watermark.ts
 * 
 * Per-viewer PDF watermarking using pdf-lib.
 * 
 * Called at request time when serving documents to investors.
 * Stamps the viewing investor's email + timestamp diagonally
 * across every page of the PDF.
 * 
 * This prevents forwarding of documents — each copy is traceable.
 */
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

export interface WatermarkOptions {
  /** The investor's email address to stamp */
  viewerEmail: string;
  /** The investor's name (optional, used alongside email) */
  viewerName?: string;
  /** Opacity of the watermark (0–1, default 0.12) */
  opacity?: number;
  /** Font size (default 14) */
  fontSize?: number;
}

/**
 * Add a diagonal watermark to every page of a PDF.
 * 
 * @param pdfBytes - Raw PDF bytes (from Supabase Storage download)
 * @param options - Watermark configuration
 * @returns Watermarked PDF bytes
 */
export async function watermarkPdf(
  pdfBytes: Uint8Array | ArrayBuffer,
  options: WatermarkOptions
): Promise<Uint8Array> {
  const { viewerEmail, viewerName, opacity = 0.12, fontSize = 13 } = options;

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const watermarkText = viewerName
    ? `${viewerName} · ${viewerEmail} · ${timestamp}`
    : `${viewerEmail} · ${timestamp}`;

  for (const page of pages) {
    const { width, height } = page.getSize();

    // Draw watermark text diagonally across the page
    // Multiple passes for full coverage
    const positions = [
      { x: width * 0.1, y: height * 0.25 },
      { x: width * 0.1, y: height * 0.5 },
      { x: width * 0.1, y: height * 0.75 },
    ];

    for (const pos of positions) {
      page.drawText(watermarkText, {
        x: pos.x,
        y: pos.y,
        size: fontSize,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity,
        rotate: degrees(35),
        maxWidth: width * 0.9,
      });
    }

    // Confidentiality notice at the bottom of each page
    page.drawText(`CONFIDENTIAL — For ${viewerEmail} only`, {
      x: 40,
      y: 20,
      size: 8,
      font,
      color: rgb(0.6, 0.6, 0.6),
      opacity: 0.5,
    });
  }

  return pdfDoc.save();
}
