// `llms.txt` (https://llmstxt.org): the site name, a one-line description and the key pages, each with a one-line
// description. Generated from the same data as the pages, never written by hand; a `noindex` page is never listed.
export interface LlmsPage {
    /** Absolute URL of the canonical page. */
    url: string;
    title: string;
    description: string | null;
    noindex?: boolean;
}

export interface LlmsInput {
    siteName: string;
    description: string | null;
    pages: LlmsPage[];
}

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

export function buildLlmsTxt({ siteName, description, pages }: LlmsInput): string {
    const lines = [`# ${oneLine(siteName)}`, ''];
    if (description) lines.push(`> ${oneLine(description)}`, '');

    const listed = pages.filter((page) => !page.noindex);
    if (listed.length > 0) {
        lines.push('## Pages', '');
        for (const page of listed) {
            const text = page.description ? `: ${oneLine(page.description)}` : '';
            lines.push(`- [${oneLine(page.title)}](${page.url})${text}`);
        }
        lines.push('');
    }

    return lines.join('\n');
}
