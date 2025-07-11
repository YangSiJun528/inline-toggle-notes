import { Plugin, MarkdownRenderer } from 'obsidian';

// Helper function to escape strings for use in a regular expression.
function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default class InlineTogglePlugin extends Plugin {
    async onload() {
        console.log('[InlineToggle] Plugin loaded. Registering post-processor.');

        this.registerMarkdownPostProcessor((element, context) => {
            // --- THIS IS THE MOST IMPORTANT LOG ---
            // It confirms that Obsidian is actually running the processor on a chunk of content.
            console.log('[InlineToggle] Post-processor is RUNNING on element:', element.tagName);

            // Find all internal links within the processed element.
            const links = element.findAll('a.internal-link');

            // If there are no links in this element, we don't need to do anything else.
            if (links.length === 0) {
                return;
            }

            console.log(`[InlineToggle] Found ${links.length} links in this element.`);

            for (const link of links) {
                const parent = link.parentElement;

                // In Reading View, the direct parent of a link in a list is the <li> or <p> tag.
                // We also need to check if the parent's parent is an <li>, to exclude links within lists.
                if (!parent || parent.tagName !== 'P' || (parent.parentElement && parent.parentElement.tagName === 'LI')) {
                    console.log(`[InlineToggle] -> Skipping link "${link.textContent}" because its parent is <${parent?.tagName}>, not <p>.`);
                    continue;
                }
				const parentText = parent.textContent?.trim() ?? '';
                const linkText = link.textContent?.trim() ?? '';

                if (!linkText) continue;

                console.log(`[InlineToggle]   - Checking link "${linkText}" in <${parent.tagName}>`);
                console.log(`[InlineToggle]     - Parent Text: "${parentText}"`);

                let isMatch = false;

                // Condition for <p>: The paragraph must start with the link.
                if (parent.tagName === 'P' && parentText.startsWith(linkText)) {
                    isMatch = true;
                    console.log(`[InlineToggle]     ✅ MATCH (Paragraph Start)`);
                }

                if (isMatch) {
                    // Create toggle icon
                    const toggleIcon = parent.createEl('span', { cls: 'inline-toggle-icon inline-toggle-icon-closed' });
                    parent.insertBefore(toggleIcon, link); // Insert before the link within the same parent

                    // Create hidden content container
                    const hiddenContent = parent.createEl('div', { cls: 'inline-toggle-content'});
                    hiddenContent.style.display = 'none'; // Initially hidden

                    // Insert hidden content as a child of the parent element
                    parent.appendChild(hiddenContent);

                    // Add click listener to toggle icon
                    toggleIcon.addEventListener('click', async () => {
                        const isHidden = hiddenContent.style.display === 'none';

                        if (isHidden) {
                            // --- Load content on demand ---
                            if (!hiddenContent.dataset.loaded) {
                                const href = link.dataset.href;
                                if (href) {
                                    const targetFile = this.app.metadataCache.getFirstLinkpathDest(href, context.sourcePath);

                                    if (targetFile) {
                                        try {
                                            const fileContent = await this.app.vault.read(targetFile);
                                            hiddenContent.empty(); // Clear placeholder
                                            await MarkdownRenderer.render(this.app, fileContent, hiddenContent, context.sourcePath, this);
                                            hiddenContent.dataset.loaded = 'true'; // Mark as loaded
                                        } catch (e) {
                                            hiddenContent.setText(`Error: Could not read file "${href}".`);
                                            console.error(e);
                                        }
                                    } else {
                                        hiddenContent.setText(`Error: File "${href}" not found.`);
                                    }
                                }
                            }
                            // --- End load content ---

                            hiddenContent.style.display = 'block';
                            toggleIcon.removeClass('inline-toggle-icon-closed');
                            toggleIcon.addClass('inline-toggle-icon-open');
                        } else {
                            hiddenContent.style.display = 'none';
                            toggleIcon.removeClass('inline-toggle-icon-open');
                            toggleIcon.addClass('inline-toggle-icon-closed');
                        }
                    });
                } else {
                    console.log(`[InlineToggle]     - NO MATCH`);
                }
            }
        });
    }

    onunload() {
        console.log('[InlineToggle] Plugin unloaded.');
    }
}
