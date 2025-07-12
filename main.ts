import {App, Plugin, MarkdownRenderer, PluginSettingTab, Setting, MarkdownPostProcessorContext} from 'obsidian';

interface InlineToggleSettings {
    matchOnlyAtStart: boolean;
}

const DEFAULT_SETTINGS: InlineToggleSettings = {
    matchOnlyAtStart: true,
};

export default class InlineTogglePlugin extends Plugin {
    settings: InlineToggleSettings;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new InlineToggleSettingTab(this.app, this));

        this.registerMarkdownPostProcessor((element, context) => {
            const links = element.findAll('a.internal-link');

            if (links.length === 0) {
                return;
            }

            for (const link of links) {
				const parent = link.parentElement;
				const isInvalidTarget = !parent || !this.isTargetLink(parent);

				if (isInvalidTarget) {
					continue;
				}

                if (this.shouldProcessLink(link, parent)) {
                    this.renderToggle(link, parent, context);
                }
            }
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

	private isTargetLink(parent: HTMLElement) {
		return parent.tagName === 'P' && (parent.parentElement && parent.parentElement.tagName !== 'LI');
	}

    private shouldProcessLink(link: HTMLElement, parent: HTMLElement): boolean {
        const parentText = parent.textContent?.trim() ?? '';
        const linkText = link.textContent?.trim() ?? '';

        if (!linkText) return false;

        if (this.settings.matchOnlyAtStart) {
            const firstLinkInParent = parent.querySelector('a.internal-link');
            return firstLinkInParent === link && parentText.startsWith(linkText);
        } else {
            return true;
        }
    }

    private async renderToggle(link: HTMLElement, parent: HTMLElement, context: MarkdownPostProcessorContext) {
        const toggleIcon = parent.createEl('span', { cls: 'inline-toggle-icon inline-toggle-icon-closed' });
        parent.insertBefore(toggleIcon, link);

        const hiddenContent = parent.createEl('div', { cls: 'inline-toggle-content inline-toggle-hidden'});

        parent.appendChild(hiddenContent);

        toggleIcon.addEventListener('click', async () => {
            const isHidden = hiddenContent.classList.contains('inline-toggle-hidden');

            if (isHidden) {
                if (!hiddenContent.dataset.loaded) {
					await this.loadContent(link, context, hiddenContent);
				}

                hiddenContent.removeClass('inline-toggle-hidden');
                toggleIcon.removeClass('inline-toggle-icon-closed');
                toggleIcon.addClass('inline-toggle-icon-open');
            } else {
                hiddenContent.addClass('inline-toggle-hidden');
                toggleIcon.removeClass('inline-toggle-icon-open');
                toggleIcon.addClass('inline-toggle-icon-closed');
            }
        });
    }

	private async loadContent(link: HTMLElement, context: MarkdownPostProcessorContext, hiddenContent: HTMLDivElement) {
		const href = link.dataset.href;
		if (href) {
			const targetFile = this.app.metadataCache.getFirstLinkpathDest(href, context.sourcePath);

			if (targetFile) {
				try {
					const fileContent = await this.app.vault.read(targetFile);
					hiddenContent.empty();
					await MarkdownRenderer.render(this.app, fileContent, hiddenContent, context.sourcePath, this);
					hiddenContent.dataset.loaded = 'true';
				} catch (e) {
					hiddenContent.setText(`Error: Could not read file "${href}".`);
					console.error(e);
				}
			} else {
				hiddenContent.setText(`Error: File "${href}" not found.`);
			}
		}
	}
}

class InlineToggleSettingTab extends PluginSettingTab {
    plugin: InlineTogglePlugin;

    constructor(app: App, plugin: InlineTogglePlugin) {
        super(app, plugin);
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Match only at paragraph start')
            .setDesc('If enabled, the toggle will only appear for links that are at the very beginning of a paragraph.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.matchOnlyAtStart)
                .onChange(async (value) => {
                    this.plugin.settings.matchOnlyAtStart = value;
                    await this.plugin.saveSettings();
                }));
    }
}
