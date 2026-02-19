function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHttpUrl(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return escapeHtml(parsed.toString());
  } catch {
    return null;
  }
}

export function renderSafeMarkdownHtml(
  content: string,
  renderViewerBlock: (rawJson: string) => string,
): string {
  const escaped = escapeHtml(String(content).slice(0, 200_000));
  const withViewerBlocks = escaped.replace(
    /```viewer\s*([\s\S]*?)```/g,
    (_full, rawJson: string) => renderViewerBlock(rawJson),
  );

  const withHeadings = withViewerBlocks
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>');

  const withInline = withHeadings
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, (_full, text: string, rawUrl: string) => {
      const safeUrl = sanitizeHttpUrl(rawUrl);
      if (!safeUrl) {
        return `<span>${text}</span>`;
      }
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    });

  return withInline
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => {
      if (
        /^<h[1-3]>/.test(block) ||
        /^<div class="preview-viewer-block/.test(block)
      ) {
        return block;
      }
      return `<p>${block.replace(/\n/g, '<br />')}</p>`;
    })
    .join('');
}
