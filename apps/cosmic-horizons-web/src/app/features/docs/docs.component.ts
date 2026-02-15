import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
} from 'rxjs';

type DocEntry = {
  id: string;
  label: string;
  section: string;
  sourcePath: string;
};

type DocsCatalogResponse = {
  count: number;
  docs: DocEntry[];
};

type DocViewModel = {
  state: 'loading' | 'ready' | 'error';
  title: string;
  sourcePath: string;
  html: string;
  errorMessage: string;
};

type DocResponse = {
  docId: string;
  sourcePath: string;
  content: string;
};

type DocsSection = {
  title: string;
  icon: string;
  links: Array<{ label: string; path: string }>;
};

@Component({
  selector: 'app-docs',
  templateUrl: './docs.component.html',
  styleUrls: ['./docs.component.scss'],
  standalone: false,
})
export class DocsComponent {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private readonly apiBaseUrl = 'http://localhost:3000';

  readonly docId$ = this.route.params.pipe(
    map((params) => (params['docId'] as string | undefined) ?? null),
    distinctUntilChanged(),
  );

  readonly docEntries$ = this.http
    .get<DocsCatalogResponse>(`${this.apiBaseUrl}/api/internal-docs/catalog`)
    .pipe(
      map((response) => response.docs),
      catchError(() => of([])),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

  readonly sections$ = this.docEntries$.pipe(
    map((entries) => this.buildSections(entries)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly docViewModel$ = combineLatest([this.docId$, this.docEntries$]).pipe(
    switchMap(([docId, entries]) => {
      if (!docId) {
        return of(null);
      }

      const entry = entries.find((item) => item.id === docId);
      if (!entry) {
        return of({
          state: 'error',
          title: 'Unknown document',
          sourcePath: docId,
          html: '',
          errorMessage: `Unknown documentation key: ${docId}`,
        } as DocViewModel);
      }

      return this.http
        .get<DocResponse>(`${this.apiBaseUrl}/api/internal-docs/content/${entry.id}`)
        .pipe(
          map(
            (response) =>
              ({
                state: 'ready',
                title: entry.label,
                sourcePath: response.sourcePath,
                html: this.renderMarkdown(response.content),
                errorMessage: '',
              }) as DocViewModel,
          ),
          catchError(() =>
            of({
              state: 'error',
              title: entry.label,
              sourcePath: entry.sourcePath,
              html: '',
              errorMessage: 'Unable to load this document from the API.',
            } as DocViewModel),
          ),
          startWith({
            state: 'loading',
            title: entry.label,
            sourcePath: entry.sourcePath,
            html: '',
            errorMessage: '',
          } as DocViewModel),
        );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private buildSections(entries: DocEntry[]): DocsSection[] {
    const grouped = new Map<string, Array<{ label: string; path: string }>>();
    for (const entry of entries) {
      if (!grouped.has(entry.section)) {
        grouped.set(entry.section, []);
      }
      const sectionLinks = grouped.get(entry.section);
      if (!sectionLinks) {
        continue;
      }
      sectionLinks.push({
        label: entry.label,
        path: `/docs/${entry.id}`,
      });
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, links]) => ({
        title,
        icon: this.iconForSection(title),
        links: links.sort((a, b) => a.label.localeCompare(b.label)),
      }));
  }

  private iconForSection(sectionTitle: string): string {
    const lower = sectionTitle.toLowerCase();
    if (lower.includes('architecture')) return 'account_tree';
    if (lower.includes('quality')) return 'verified';
    if (lower.includes('reference')) return 'menu_book';
    if (lower.includes('operations')) return 'build';
    if (lower.includes('planning')) return 'timeline';
    if (lower.includes('product')) return 'dashboard';
    if (lower.includes('governance')) return 'gavel';
    return 'description';
  }

  private renderMarkdown(markdown: string): string {
    const codeBlocks: string[] = [];
    let content = this.escapeHtml(markdown).replace(
      /```([\w-]+)?\n([\s\S]*?)```/g,
      (_match, language = '', code) => {
        const safeLanguage = this.escapeHtml(language);
        const block = `<pre><code class="lang-${safeLanguage}">${code.trimEnd()}</code></pre>`;
        codeBlocks.push(block);
        return `@@CODE_BLOCK_${codeBlocks.length - 1}@@`;
      },
    );

    content = content
      .replace(/^###### (.*)$/gm, '<h6>$1</h6>')
      .replace(/^##### (.*)$/gm, '<h5>$1</h5>')
      .replace(/^#### (.*)$/gm, '<h4>$1</h4>')
      .replace(/^### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        (_match, label, href) =>
          `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`,
      );

    content = this.renderListBlocks(content, /^- (.*)$/gm, 'ul');
    content = this.renderListBlocks(content, /^\d+\. (.*)$/gm, 'ol');

    const blocks = content
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter((block) => block.length > 0)
      .map((block) => {
        if (this.isBlockHtml(block)) {
          return block;
        }
        return `<p>${block.replace(/\n/g, '<br />')}</p>`;
      });

    return blocks
      .join('\n')
      .replace(
        /@@CODE_BLOCK_(\d+)@@/g,
        (_match, index) => codeBlocks[Number(index)] ?? '',
      );
  }

  private renderListBlocks(
    content: string,
    regex: RegExp,
    listTag: 'ul' | 'ol',
  ) {
    const lines = content.split('\n');
    const rendered: string[] = [];
    let currentItems: string[] = [];

    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        currentItems.push(`<li>${match[1]}</li>`);
        continue;
      }
      if (currentItems.length > 0) {
        rendered.push(`<${listTag}>${currentItems.join('')}</${listTag}>`);
        currentItems = [];
      }
      rendered.push(line);
    }

    if (currentItems.length > 0) {
      rendered.push(`<${listTag}>${currentItems.join('')}</${listTag}>`);
    }

    return rendered.join('\n');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private isBlockHtml(block: string): boolean {
    return /^(<h\d|<ul>|<ol>|<li>|<pre>|<blockquote>|@@CODE_BLOCK_)/.test(
      block,
    );
  }
}
