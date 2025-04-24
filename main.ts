import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

interface TemplateFilenameSettings {
	defaultTemplate: string;
	defaultContent: string;
}

const DEFAULT_SETTINGS: TemplateFilenameSettings = {
	defaultTemplate: 'YYYY-MM-DD_HH-mm-ss',
	defaultContent: ''
}

export default class TemplateFilenamePlugin extends Plugin {
	settings: TemplateFilenameSettings;

	async onload() {
		await this.loadSettings();

		// Add ribbon icon
		this.addRibbonIcon('file-plus', 'Create note with template filename', () => {
			new TemplateFilenameModal(this.app, this).open();
		});

		// Add command to create note with template filename
		this.addCommand({
			id: 'create-note-with-template-filename',
			name: 'Create note with template filename',
			callback: () => {
				new TemplateFilenameModal(this.app, this).open();
			}
		});

		// Add settings tab
		this.addSettingTab(new TemplateFilenameSettingTab(this.app, this));
	}

	onunload() {
		// Nothing to clean up
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Process a filename template and return the processed string
	 * @param template The template string to process
	 * @returns The processed filename
	 */
	processTemplate(template: string): string {
		// Process date/time placeholders
		const now = new Date();
		
		// Replace date patterns
		const processedTemplate = template
			// Year
			.replace(/YYYY/g, now.getFullYear().toString())
			.replace(/YY/g, now.getFullYear().toString().slice(2))
			// Month
			.replace(/MM/g, (now.getMonth() + 1).toString().padStart(2, '0'))
			.replace(/M/g, (now.getMonth() + 1).toString())
			// Day
			.replace(/DD/g, now.getDate().toString().padStart(2, '0'))
			.replace(/D/g, now.getDate().toString())
			// Hour
			.replace(/HH/g, now.getHours().toString().padStart(2, '0'))
			.replace(/H/g, now.getHours().toString())
			// Minute
			.replace(/mm/g, now.getMinutes().toString().padStart(2, '0'))
			.replace(/m/g, now.getMinutes().toString())
			// Second
			.replace(/ss/g, now.getSeconds().toString().padStart(2, '0'))
			.replace(/s/g, now.getSeconds().toString())
			// Millisecond
			.replace(/SSS/g, now.getMilliseconds().toString().padStart(3, '0'));

		// Process other placeholders
		return this.processOtherPlaceholders(processedTemplate);
	}

	/**
	 * Process non-date placeholders in the template
	 * @param template Template string with date placeholders already processed
	 * @returns Final processed string
	 */
	processOtherPlaceholders(template: string): string {
		// Handle random string placeholder: {random:N} where N is the length
		const randomRegex = /{random:(\d+)}/g;
		let result = template;
		let match;

		while ((match = randomRegex.exec(template)) !== null) {
			const length = parseInt(match[1]);
			const randomStr = this.generateRandomString(length);
			result = result.replace(match[0], randomStr);
		}

		// Handle unix timestamp with base conversion: {unixtime:base} where base is between 2-36
		const unixTimeRegex = /{unixtime:(\d+)}/g;
		
		while ((match = unixTimeRegex.exec(template)) !== null) {
			const base = parseInt(match[1]);
			if (base >= 2 && base <= 36) {
				const unixTime = Math.floor(Date.now() / 1000);
				const convertedTime = unixTime.toString(base);
				result = result.replace(match[0], convertedTime);
			}
		}

		// Handle seconds since midnight with base conversion: {daytime:base}
		const daytimeRegex = /{daytime:(\d+)}/g;
		
		while ((match = daytimeRegex.exec(template)) !== null) {
			const base = parseInt(match[1]);
			if (base >= 2 && base <= 36) {
				const now = new Date();
				const secondsSinceMidnight = 
					now.getHours() * 3600 + 
					now.getMinutes() * 60 + 
					now.getSeconds();
				const convertedTime = secondsSinceMidnight.toString(base);
				result = result.replace(match[0], convertedTime);
			}
		}

		return result;
	}

	/**
	 * Generate a random string of specified length
	 * @param length Length of the random string
	 * @returns Random string
	 */
	generateRandomString(length: number): string {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		let result = '';
		for (let i = 0; i < length; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return result;
	}

	/**
	 * Create a new note with the given filename and content
	 * @param filename The filename for the new note
	 * @param content The content for the new note
	 */
	async createNote(filename: string, content: string): Promise<TFile> {
		// Ensure filename ends with .md
		if (!filename.endsWith('.md')) {
			filename += '.md';
		}

		// Create the note
		try {
			const file = await this.app.vault.create(filename, content);
			return file;
		} catch (error) {
			console.error('Error creating note:', error);
			new Notice('Error creating note: ' + error);
			throw error;
		}
	}
}

class TemplateFilenameModal extends Modal {
	plugin: TemplateFilenamePlugin;
	templateInput: HTMLInputElement;
	contentInput: HTMLTextAreaElement;
	previewEl: HTMLElement;

	constructor(app: App, plugin: TemplateFilenamePlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		
		// Title
		contentEl.createEl('h2', { text: 'Create Note with Template Filename' });
		
		// Template input
		contentEl.createEl('label', { text: 'Filename Template:' }).setAttribute('for', 'template-input');
		this.templateInput = contentEl.createEl('input', {
			type: 'text',
			value: this.plugin.settings.defaultTemplate
		});
		this.templateInput.id = 'template-input';
		this.templateInput.style.width = '100%';
		this.templateInput.addEventListener('input', () => this.updatePreview());
		
		// Help text for template syntax
		const helpText = contentEl.createEl('div', { cls: 'template-help' });
		helpText.innerHTML = `
			<details>
				<summary>Template syntax help</summary>
				<ul>
					<li><strong>YYYY</strong>: 4-digit year (e.g., 2025)</li>
					<li><strong>YY</strong>: 2-digit year (e.g., 25)</li>
					<li><strong>MM</strong>: 2-digit month (01-12)</li>
					<li><strong>M</strong>: Month without leading zero (1-12)</li>
					<li><strong>DD</strong>: 2-digit day (01-31)</li>
					<li><strong>D</strong>: Day without leading zero (1-31)</li>
					<li><strong>HH</strong>: 2-digit hour, 24-hour format (00-23)</li>
					<li><strong>H</strong>: Hour without leading zero (0-23)</li>
					<li><strong>mm</strong>: 2-digit minute (00-59)</li>
					<li><strong>m</strong>: Minute without leading zero (0-59)</li>
					<li><strong>ss</strong>: 2-digit second (00-59)</li>
					<li><strong>s</strong>: Second without leading zero (0-59)</li>
					<li><strong>SSS</strong>: 3-digit millisecond (000-999)</li>
					<li><strong>{random:N}</strong>: Random string of N characters</li>
					<li><strong>{unixtime:B}</strong>: Unix timestamp in base B (2-36)</li>
					<li><strong>{daytime:B}</strong>: Seconds since midnight in base B (2-36)</li>
				</ul>
			</details>
		`;
		helpText.style.marginBottom = '1rem';
		
		// Preview
		contentEl.createEl('label', { text: 'Preview:' });
		this.previewEl = contentEl.createEl('div', { cls: 'template-preview' });
		this.previewEl.style.padding = '8px';
		this.previewEl.style.marginBottom = '1rem';
		this.previewEl.style.borderRadius = '4px';
		this.previewEl.style.backgroundColor = 'var(--background-secondary)';
		
		// Note content
		contentEl.createEl('label', { text: 'Note Content:' }).setAttribute('for', 'content-input');
		this.contentInput = contentEl.createEl('textarea');
		this.contentInput.id = 'content-input';
		this.contentInput.style.width = '100%';
		this.contentInput.style.height = '150px';
		this.contentInput.value = this.plugin.settings.defaultContent;
		
		// Buttons
		const buttonContainer = contentEl.createEl('div');
		buttonContainer.style.marginTop = '1rem';
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		
		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => this.close());
		cancelButton.style.marginRight = '8px';
		
		const createButton = buttonContainer.createEl('button', { text: 'Create', cls: 'mod-cta' });
		createButton.addEventListener('click', () => this.createNote());
		
		// Update preview on initial load
		this.updatePreview();
	}

	updatePreview() {
		const template = this.templateInput.value;
		const processedFilename = this.plugin.processTemplate(template);
		this.previewEl.setText(processedFilename + '.md');
	}

	async createNote() {
		const template = this.templateInput.value;
		const content = this.contentInput.value;
		const processedFilename = this.plugin.processTemplate(template);
		
		try {
			const file = await this.plugin.createNote(processedFilename, content);
			
			// Save template as default if changed
			if (this.plugin.settings.defaultTemplate !== template) {
				this.plugin.settings.defaultTemplate = template;
				await this.plugin.saveSettings();
			}
			
			// Save content as default if changed
			if (this.plugin.settings.defaultContent !== content) {
				this.plugin.settings.defaultContent = content;
				await this.plugin.saveSettings();
			}
			
			// Show success notification
			new Notice(`Created note: ${file.name}`);
			
			// Open the new note
			this.app.workspace.getLeaf(false).openFile(file);
			
			// Close the modal
			this.close();
		} catch (error) {
			console.error('Error creating note:', error);
			new Notice('Error creating note');
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class TemplateFilenameSettingTab extends PluginSettingTab {
	plugin: TemplateFilenamePlugin;

	constructor(app: App, plugin: TemplateFilenamePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('template-filename-settings');

		containerEl.createEl('h2', { text: 'Template Filename Settings' });

		new Setting(containerEl)
			.setName('Default filename template')
			.setDesc('The default template to use for new notes')
			.addText(text => text
				.setPlaceholder('YYYY-MM-DD_HH-mm-ss')
				.setValue(this.plugin.settings.defaultTemplate)
				.onChange(async (value) => {
					this.plugin.settings.defaultTemplate = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default note content')
			.setDesc('The default content for new notes')
			.addTextArea(text => text
				.setPlaceholder('Enter default note content')
				.setValue(this.plugin.settings.defaultContent)
				.onChange(async (value) => {
					this.plugin.settings.defaultContent = value;
					await this.plugin.saveSettings();
				}));

		// Add help section
		containerEl.createEl('h3', { text: 'Template Syntax Help' });
		
		const helpList = containerEl.createEl('ul');
		const helpItems = [
			{ name: 'YYYY', desc: '4-digit year (e.g., 2025)' },
			{ name: 'YY', desc: '2-digit year (e.g., 25)' },
			{ name: 'MM', desc: '2-digit month (01-12)' },
			{ name: 'M', desc: 'Month without leading zero (1-12)' },
			{ name: 'DD', desc: '2-digit day (01-31)' },
			{ name: 'D', desc: 'Day without leading zero (1-31)' },
			{ name: 'HH', desc: '2-digit hour, 24-hour format (00-23)' },
			{ name: 'H', desc: 'Hour without leading zero (0-23)' },
			{ name: 'mm', desc: '2-digit minute (00-59)' },
			{ name: 'm', desc: 'Minute without leading zero (0-59)' },
			{ name: 'ss', desc: '2-digit second (00-59)' },
			{ name: 's', desc: 'Second without leading zero (0-59)' },
			{ name: 'SSS', desc: '3-digit millisecond (000-999)' },
			{ name: '{random:N}', desc: 'Random string of N characters' },
			{ name: '{unixtime:B}', desc: 'Unix timestamp in base B (2-36)' },
			{ name: '{daytime:B}', desc: 'Seconds since midnight in base B (2-36)' }
		];
		
		helpItems.forEach(item => {
			const listItem = helpList.createEl('li');
			listItem.createEl('strong', { text: item.name });
			listItem.createSpan({ text: ': ' + item.desc });
		});

		// Example section
		const examplesSection = containerEl.createDiv({ cls: 'examples' });
		examplesSection.createEl('h3', { text: 'Examples' });
		const examplesList = examplesSection.createEl('ul');
		[
			{ template: 'YYYY-MM-DD_note', desc: '2025-04-24_note.md' },
			{ template: 'YYYY-MM-DD_HH-mm-ss', desc: '2025-04-24_15-30-45.md' },
			{ template: 'note_{random:6}', desc: 'note_a7bF9c.md' },
			{ template: 'note_{unixtime:36}', desc: 'note_1c9rbbk.md (Unix time in base 36)' },
			{ template: 'log_{daytime:16}', desc: 'log_12ab3.md (Seconds since midnight in base 16)' }
		].forEach(example => {
			const listItem = examplesList.createEl('li');
			listItem.createEl('code', { text: example.template });
			listItem.createSpan({ text: ' → ' + example.desc });
		});
	}
}