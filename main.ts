import { Plugin } from 'obsidian';

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
                if (!parent || (parent.tagName !== 'P' && parent.tagName !== 'LI')) {
                    console.log(`[InlineToggle] -> Skipping link "${link.textContent}" because its parent is <${parent?.tagName}>, not <p> or <li>.`);
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
                // Condition for <li>: The list item must start with a list marker, optional space, and then the link.
                else if (parent.tagName === 'LI') {
                    const listRegex = new RegExp(`^[-*+]\\s*${escapeRegex(linkText)}`);
                    if (listRegex.test(parentText)) {
                        isMatch = true;
                        console.log(`[InlineToggle]     ✅ MATCH (List Item Start)`);
                    }
                }

                if (isMatch) {
                    // Create toggle icon
                    const toggleIcon = parent.createEl('span', { cls: 'inline-toggle-icon', text: '▶' });
                    parent.insertBefore(toggleIcon, link); // Insert before the link within the same parent

                    // Create hidden content container
                    const hiddenContent = parent.createEl('div', { cls: 'inline-toggle-content', text: 'This is the hardcoded hidden content for the toggle.' });
                    hiddenContent.style.display = 'none'; // Initially hidden

                    // Insert hidden content after the parent element (e.g., after the <p> or <li>)
                    if (parent.parentElement) {
                        parent.parentElement.insertBefore(hiddenContent, parent.nextSibling);
                    } else {
                        // Fallback if parent has no parent (unlikely in markdown rendering)
                        element.appendChild(hiddenContent);
                    }

                    // Add click listener to toggle icon
                    toggleIcon.addEventListener('click', () => {
                        if (hiddenContent.style.display === 'none') {
                            hiddenContent.style.display = 'block';
                            toggleIcon.textContent = '▼';
                        } else {
                            hiddenContent.style.display = 'none';
                            toggleIcon.textContent = '▶';
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
