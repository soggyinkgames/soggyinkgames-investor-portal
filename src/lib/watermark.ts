/**
 * watermark.ts
 * 
 * Per-viewer PDF watermarking using pdf-lib.
 * 
 * Called at request time when serving documents to investors.
 * 
 * Two distinct elements, deliberately weighted differently:
 * 
 * 1. OWNERSHIP MARK (dominant) — tiled "COMPANY · CONFIDENTIAL" text
 *    repeated diagonally across every page. This is the primary visual
 *    signal: the document belongs to the company, not the reader.
 * 
 * 2. FORENSIC TRACER (subtle) — a small footer line with the viewing
 *    investor's email + timestamp. This is for leak attribution only,
 *    not meant to be the headline of the page.
 */
import { PDFDocument, rgb, degrees, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';

export interface WatermarkOptions {
  /** The investor's email address to stamp (forensic tracer only) */
  viewerEmail: string;
  /** The investor's name (optional, used alongside email in footer) */
  viewerName?: string;
  /** Company name shown in the dominant tiled mark */
  companyName?: string;
  /** Opacity of the tiled ownership mark (0–1, default 0.08) */
  markOpacity?: number;
  /** Font size of the tiled ownership mark (default 22) */
  markFontSize?: number;
  /** Font size of the footer tracer line (default 7) */
  footerFontSize?: number;
  /** Rotation angle of the tiled mark, in degrees (default 35) */
  markAngleDegrees?: number;
}

const DEFAULTS = {
  companyName: 'SOGGY INK GAMES',
  markOpacity: 0.08,
  markFontSize: 22,
  footerFontSize: 7,
  markAngleDegrees: 35,
};

/**
 * Draw the tiled ownership mark across a single page.
 * 
 * Approach: build a grid of tile origins in the page's own coordinate
 * space, spaced generously enough that repeats don't crowd each other
 * once rotated, then draw each tile's text rotated about its own
 * origin point. The grid is deliberately oversized beyond the visible
 * page bounds — since rotating text about a point on/near the page
 * edge sweeps part of it outside the nominal x/y box — so corners
 * aren't left blank after rotation.
 */
function drawTiledMark(
  page: PDFPage,
  font: PDFFont,
  text: string,
  opts: { opacity: number; fontSize: number; angleDegrees: number }
) {
  const { width, height } = page.getSize();
  const { opacity, fontSize, angleDegrees } = opts;

  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const textHeight = fontSize; // close enough approximation for spacing

  // Spacing between tile origins — generous gutter so repeats don't
  // visually collide once rotated.
  const colSpacing = textWidth + fontSize * 3;
  const rowSpacing = textHeight + fontSize * 4;

  // Pad the tiling grid out beyond the page on all sides so rotated
  // text still covers the corners rather than leaving them blank.
  const padX = textWidth;
  const padY = textHeight * 2;

  const startX = -padX;
  const startY = -padY;
  const endX = width + padX;
  const endY = height + padY;

  let row = 0;
  for (let y = startY; y <= endY; y += rowSpacing) {
    // Stagger alternate rows horizontally into a brick-like pattern —
    // harder to crop around than a rigid grid, less visually monotonous.
    const rowOffset = row % 2 === 0 ? 0 : colSpacing / 2;

    for (let x = startX - rowOffset; x <= endX; x += colSpacing) {
      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0.55, 0.55, 0.55),
        opacity,
        rotate: degrees(angleDegrees),
      });
    }
    row++;
  }
}

/**
 * Add a company ownership watermark + footer tracer to every page of a PDF.
 * 
 * @param pdfBytes - Raw PDF bytes (from Supabase Storage download)
 * @param options - Watermark configuration
 * @returns Watermarked PDF bytes
 */
export async function watermarkPdf(
  pdfBytes: Uint8Array | ArrayBuffer,
  options: WatermarkOptions
): Promise<Uint8Array> {
  const {
    viewerEmail,
    viewerName,
    companyName = DEFAULTS.companyName,
    markOpacity = DEFAULTS.markOpacity,
    markFontSize = DEFAULTS.markFontSize,
    footerFontSize = DEFAULTS.footerFontSize,
    markAngleDegrees = DEFAULTS.markAngleDegrees,
  } = options;

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const markText = `${companyName} · CONFIDENTIAL`;
  const footerText = viewerName
    ? `Prepared by SOGGY INK GAMES for ${viewerName} (${viewerEmail}) · viewed ${timestamp} · not for distribution`
    : `Prepared for ${viewerEmail} · viewed ${timestamp} · not for distribution`;

  for (const page of pages) {
    const { width } = page.getSize();

    drawTiledMark(page, font, markText, {
      opacity: markOpacity,
      fontSize: markFontSize,
      angleDegrees: markAngleDegrees,
    });

    // Forensic tracer: small, unobtrusive footer line.
    page.drawText(footerText, {
      x: 40,
      y: 18,
      size: footerFontSize,
      font,
      color: rgb(0.55, 0.55, 0.55),
      opacity: 0.8,
      maxWidth: width - 80,
    });
  }

  return pdfDoc.save();
}
