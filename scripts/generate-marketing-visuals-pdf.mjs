import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(__dirname, '..');

const sourceMd = resolve(workspaceRoot, 'documentation', 'MARKETING-VISUAL-GUIDE.md');
const htmlOut = resolve(workspaceRoot, 'documentation', 'marketing', 'vlass-marketing-visuals.html');
const pdfOut = resolve(workspaceRoot, 'documentation', 'marketing', 'vlass-marketing-visuals.pdf');
const canonicalPdfOut = resolve(workspaceRoot, 'documentation', 'marketing', 'vlass-marketing.pdf');

const pandocResult = spawnSync(
  'pandoc',
  [
    sourceMd,
    '--from=gfm',
    '--to=html5',
    '--standalone',
    '--toc',
    '--metadata=title:VLASS Portal Marketing Visuals',
    '-o',
    htmlOut,
  ],
  { cwd: workspaceRoot, stdio: 'inherit' },
);

if (pandocResult.status !== 0) {
  process.exit(pandocResult.status ?? 1);
}

const html = readFileSync(htmlOut, 'utf8');
const injected = html.replace(
  '</head>',
  `
<style>
@page {
  size: A4;
  margin: 0.6in 0.5in 0.7in 0.5in;
}
body {
  font-family: "Lucida Sans", "Lucida Grande", "Segoe UI", Arial, sans-serif;
  font-size: 12pt;
  margin: 24px;
  line-height: 1.45;
}
h1, h2, h3 { page-break-after: avoid; break-after: avoid-page; }
h1 { font-size: 22pt; line-height: 1.2; margin: 0.4em 0 0.3em; }
h2 { font-size: 16pt; line-height: 1.25; margin: 0.9em 0 0.35em; }
h3 { font-size: 13pt; line-height: 1.3; margin: 0.7em 0 0.3em; }
pre, table, ul, ol, blockquote { break-inside: avoid-page; page-break-inside: avoid; }
pre.mermaid {
  width: 100%;
  background: #f8fbff;
  border: 1px solid #d9e4f2;
  border-radius: 8px;
  padding: 14px;
  page-break-inside: avoid;
  overflow: visible;
}
pre.mermaid svg {
  width: 100% !important;
  max-width: 100% !important;
  height: auto !important;
  display: block;
  margin: 0 auto;
}
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #d0d0d0; padding: 6px; text-align: left; }
</style>
</head>`,
);

writeFileSync(htmlOut, injected, 'utf8');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  page.setDefaultTimeout(120000);
  await page.goto(`file:///${htmlOut.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
  await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js' });
  const status = await page.evaluate(async () => {
    const total = document.querySelectorAll('pre.mermaid').length;
    document.querySelectorAll('pre.mermaid').forEach((pre) => {
      const code = pre.querySelector('code');
      if (!code) return;
      const raw = code.textContent || '';
      const sanitized = raw.replace(/[^\x00-\x7F]/g, '');
      pre.textContent = sanitized;
    });
    try {
      // @ts-ignore
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        securityLevel: 'loose',
        themeVariables: {
          fontFamily: '"Lucida Sans", "Lucida Grande", "Segoe UI", Arial, sans-serif',
          primaryColor: '#eaf3ff',
          primaryTextColor: '#123455',
          primaryBorderColor: '#5e89b8',
          lineColor: '#4a6f99',
          secondaryColor: '#f4f9ff',
          tertiaryColor: '#fff4e8',
          background: '#ffffff',
        },
        flowchart: { htmlLabels: true, curve: 'linear' },
      });
      // @ts-ignore
      await mermaid.run({ querySelector: '.mermaid' });
      // Enforce full-width diagram rendering in the generated PDF.
      document.querySelectorAll('pre.mermaid svg').forEach((svg) => {
        svg.style.width = '100%';
        svg.style.maxWidth = '100%';
        svg.style.height = 'auto';
      });
      const rendered = document.querySelectorAll('svg[id^="mermaid-"]').length;
      const hasSyntaxText = [...document.querySelectorAll('svg')].some((s) =>
        /syntax error in text/i.test((s.textContent || '').toLowerCase()),
      );
      return { ok: rendered === total && !hasSyntaxText, total, rendered, hasSyntaxText, error: null };
    } catch (error) {
      return {
        ok: false,
        total,
        rendered: document.querySelectorAll('svg[id^="mermaid-"]').length,
        hasSyntaxText: true,
        error: String(error),
      };
    }
  });
  if (!status?.ok) {
    throw new Error(
      `Mermaid render validation failed (total=${status?.total}, rendered=${status?.rendered}, hasSyntaxText=${status?.hasSyntaxText}, error=${status?.error ?? 'none'})`,
    );
  }
  await page.pdf({
    path: pdfOut,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `<div></div>`,
    footerTemplate: `
      <div style="width:100%; font-size:9px; color:#666; padding:0 0.45in; display:flex; justify-content:space-between;">
        <span>VLASS Portal Marketing Visuals</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `,
    margin: { top: '0.6in', right: '0.5in', bottom: '0.8in', left: '0.5in' },
  });
} finally {
  await browser.close();
}

copyFileSync(pdfOut, canonicalPdfOut);
console.log(`Generated: ${htmlOut}`);
console.log(`Generated: ${pdfOut}`);
console.log(`Updated:   ${canonicalPdfOut}`);
