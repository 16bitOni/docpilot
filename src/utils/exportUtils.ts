// Export utilities that convert markdown to formatted output
export interface ExportOptions {
  filename: string;
  content: string;
  format: 'pdf' | 'docx' | 'txt' | 'md';
}

// Simple markdown to HTML converter
const markdownToHtml = (markdown: string): string => {
  let html = markdown;
  
  // Convert headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Convert bold and italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Convert lists
  html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
  
  // Wrap consecutive list items in ul tags
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');
  
  // Convert line breaks to paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';
  
  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h[1-6]>)/g, '$1');
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  
  return html;
};

// Convert markdown to plain text with basic formatting
const markdownToPlainText = (markdown: string): string => {
  let text = markdown;
  
  // Remove markdown syntax but keep structure
  text = text.replace(/^### (.*$)/gim, '$1');
  text = text.replace(/^## (.*$)/gim, '$1');
  text = text.replace(/^# (.*$)/gim, '$1');
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  text = text.replace(/\*(.*?)\*/g, '$1');
  text = text.replace(/^\* /gim, '• ');
  text = text.replace(/^- /gim, '• ');
  
  return text;
};

// Simple download function
const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Export as formatted TXT (with basic formatting preserved)
export const exportAsTxt = (filename: string, content: string) => {
  const formattedText = markdownToPlainText(content);
  downloadFile(formattedText, `${filename}.txt`, 'text/plain;charset=utf-8');
};

// Export as Markdown (raw)
export const exportAsMarkdown = (filename: string, content: string) => {
  downloadFile(content, `${filename}.md`, 'text/markdown;charset=utf-8');
};

// Export as formatted PDF
export const exportAsPdf = async (filename: string, content: string) => {
  const htmlContent = markdownToHtml(content);
  
  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${filename}</title>
      <meta charset="utf-8">
      <style>
        @page {
          margin: 1in;
          size: A4;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          font-size: 12pt;
          margin: 0;
          padding: 0;
        }
        h1 {
          font-size: 24pt;
          font-weight: 600;
          margin: 24pt 0 16pt 0;
          color: #1a1a1a;
          page-break-after: avoid;
        }
        h2 {
          font-size: 20pt;
          font-weight: 600;
          margin: 20pt 0 14pt 0;
          color: #1a1a1a;
          page-break-after: avoid;
        }
        h3 {
          font-size: 16pt;
          font-weight: 600;
          margin: 16pt 0 12pt 0;
          color: #1a1a1a;
          page-break-after: avoid;
        }
        p {
          margin: 0 0 12pt 0;
          text-align: justify;
        }
        ul, ol {
          margin: 12pt 0;
          padding-left: 24pt;
        }
        li {
          margin: 4pt 0;
        }
        strong {
          font-weight: 600;
        }
        em {
          font-style: italic;
        }
        pre {
          background: #f8f9fa;
          padding: 12pt;
          border-radius: 4pt;
          font-family: 'Courier New', monospace;
          font-size: 10pt;
          overflow-x: auto;
          margin: 12pt 0;
        }
        code {
          background: #f8f9fa;
          padding: 2pt 4pt;
          border-radius: 2pt;
          font-family: 'Courier New', monospace;
          font-size: 10pt;
        }
        blockquote {
          border-left: 3pt solid #ddd;
          padding-left: 12pt;
          margin: 12pt 0;
          color: #666;
          font-style: italic;
        }
        @media print {
          body { print-color-adjust: exact; }
          h1, h2, h3 { page-break-after: avoid; }
          ul, ol, blockquote { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      ${htmlContent}
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 500);
        }
      </script>
    </body>
    </html>
  `;
  
  const blob = new Blob([fullHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');
  
  // Clean up after a delay
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 2000);
};

// Export as formatted DOCX (RTF format that Word can open)
export const exportAsDocx = async (filename: string, content: string) => {
  const htmlContent = markdownToHtml(content);
  
  // Convert HTML to RTF format
  let rtfContent = htmlContent;
  
  // Convert HTML tags to RTF formatting
  rtfContent = rtfContent.replace(/<h1>(.*?)<\/h1>/g, '{\\fs32\\b $1\\par}');
  rtfContent = rtfContent.replace(/<h2>(.*?)<\/h2>/g, '{\\fs28\\b $1\\par}');
  rtfContent = rtfContent.replace(/<h3>(.*?)<\/h3>/g, '{\\fs24\\b $1\\par}');
  rtfContent = rtfContent.replace(/<strong>(.*?)<\/strong>/g, '{\\b $1}');
  rtfContent = rtfContent.replace(/<em>(.*?)<\/em>/g, '{\\i $1}');
  rtfContent = rtfContent.replace(/<p>(.*?)<\/p>/g, '$1\\par\\par');
  rtfContent = rtfContent.replace(/<ul>/g, '');
  rtfContent = rtfContent.replace(/<\/ul>/g, '');
  rtfContent = rtfContent.replace(/<li>(.*?)<\/li>/g, '\\bullet $1\\par');
  
  // Clean up any remaining HTML tags
  rtfContent = rtfContent.replace(/<[^>]*>/g, '');
  
  // Create RTF document
  const rtfDocument = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0\\fswiss\\fcharset0 Arial;}} {\\colortbl;\\red0\\green0\\blue0;} \\f0\\fs24\\cf1 ${rtfContent}}`;
  
  downloadFile(rtfDocument, `${filename}.rtf`, 'application/rtf');
};

// Main export function
export const exportFile = async (options: ExportOptions) => {
  const { filename, content, format } = options;
  
  try {
    switch (format) {
      case 'txt':
        exportAsTxt(filename, content);
        break;
      case 'md':
        exportAsMarkdown(filename, content);
        break;
      case 'pdf':
        await exportAsPdf(filename, content);
        break;
      case 'docx':
        await exportAsDocx(filename, content);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
};