import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// PDF.js returns text in content-stream order, which is not necessarily the
// order a person reads it. Pleasanton transcripts are a concrete example: the
// numeric GPA is emitted before its label. Rebuild visual rows from the item
// coordinates before handing the text to the transcript parser.
export function textContentToText(content) {
  const rows = [];
  const items = (content?.items || [])
    .filter((item) => item?.str?.trim() && Array.isArray(item.transform))
    .map((item) => ({ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }))
    .sort((a, b) => b.y - a.y);

  for (const item of items) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 2);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }

  return rows
    .map((row) => row.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(' '))
    .join('\n');
}

export async function extractPdfText(blob) {
  const data = new Uint8Array(await blob.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(textContentToText(content));
  }
  return pages.join('\n');
}
