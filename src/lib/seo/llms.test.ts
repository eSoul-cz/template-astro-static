import { describe, expect, it } from 'vitest';

import { buildLlmsTxt } from './llms';

describe('buildLlmsTxt', () => {
    it('lists the site name, the description and every indexable page with its description', () => {
        const text = buildLlmsTxt({
            siteName: 'Example',
            description: 'A short  description.',
            pages: [
                { url: 'https://example.com/', title: 'Home', description: 'The home page.' },
                { url: 'https://example.com/about/', title: 'About', description: null },
            ],
        });

        expect(text).toBe(
            [
                '# Example',
                '',
                '> A short description.',
                '',
                '## Pages',
                '',
                '- [Home](https://example.com/): The home page.',
                '- [About](https://example.com/about/)',
                '',
            ].join('\n'),
        );
    });

    it('never lists a noindex page', () => {
        const text = buildLlmsTxt({
            siteName: 'Example',
            description: null,
            pages: [
                { url: 'https://example.com/', title: 'Home', description: 'Home.' },
                { url: 'https://example.com/thanks/', title: 'Thanks', description: 'Thanks.', noindex: true },
            ],
        });

        expect(text).toContain('https://example.com/)');
        expect(text).not.toContain('thanks');
    });

    it('omits the page section when nothing is indexable', () => {
        expect(buildLlmsTxt({ siteName: 'Example', description: null, pages: [] })).toBe('# Example\n');
    });
});
