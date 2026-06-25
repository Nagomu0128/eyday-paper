import type { ExtractedDoc } from "./extraction";

export interface TextChunk {
  idx: number;
  section: string | null;
  text: string;
  charLen: number;
}

const DEFAULT_MAX_CHARS = 1200;

/**
 * Chunk on semantic boundaries: accumulate paragraphs within a section up to
 * `maxChars`, never splitting a paragraph (keeps tables/formulas intact). Each
 * section starts a fresh chunk. Extraction quality flows straight through here.
 */
export const chunkDocument = (doc: ExtractedDoc, maxChars = DEFAULT_MAX_CHARS): TextChunk[] => {
  const chunks: TextChunk[] = [];
  let idx = 0;

  for (const section of doc.sections) {
    let buf: string[] = [];
    let bufLen = 0;

    const flush = () => {
      if (buf.length === 0) return;
      const head = section.heading ? `${section.heading}\n` : "";
      const text = head + buf.join("\n\n");
      chunks.push({ idx: idx++, section: section.heading, text, charLen: text.length });
      buf = [];
      bufLen = 0;
    };

    for (const raw of section.paragraphs) {
      const para = raw.trim();
      if (para.length === 0) continue;
      if (bufLen > 0 && bufLen + para.length > maxChars) flush();
      buf.push(para);
      bufLen += para.length;
    }
    flush();
  }

  return chunks;
};
