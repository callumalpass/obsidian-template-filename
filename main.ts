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

	// Global counter for sequential numbering
	private globalCounter: number = 1;
	private namedCounters: Record<string, number> = {};
	private clipboard: string = '';

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
			.replace(/MMMM/g, this.getMonthName(now.getMonth()))
			.replace(/MMM/g, this.getMonthName(now.getMonth()).slice(0, 3))
			// Day
			.replace(/DD/g, now.getDate().toString().padStart(2, '0'))
			.replace(/D/g, now.getDate().toString())
			.replace(/dddd/g, this.getDayName(now.getDay()))
			.replace(/ddd/g, this.getDayName(now.getDay()).slice(0, 3))
			.replace(/DDD/g, this.getDayOfYear(now).toString().padStart(3, '0'))
			// Week
			.replace(/WW/g, this.getWeekNumber(now).toString().padStart(2, '0'))
			// Quarter
			.replace(/Q/g, (Math.floor(now.getMonth() / 3) + 1).toString())
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
	 * Get the full month name
	 * @param month Month index (0-11)
	 * @returns Full month name
	 */
	private getMonthName(month: number): string {
		const monthNames = [
			'January', 'February', 'March', 'April', 'May', 'June',
			'July', 'August', 'September', 'October', 'November', 'December'
		];
		return monthNames[month];
	}

	/**
	 * Get the full day name
	 * @param day Day index (0-6, starting with Sunday)
	 * @returns Full day name
	 */
	private getDayName(day: number): string {
		const dayNames = [
			'Sunday', 'Monday', 'Tuesday', 'Wednesday', 
			'Thursday', 'Friday', 'Saturday'
		];
		return dayNames[day];
	}

	/**
	 * Get the day of the year (1-366)
	 * @param date Date object
	 * @returns Day of year
	 */
	private getDayOfYear(date: Date): number {
		const start = new Date(date.getFullYear(), 0, 0);
		const diff = date.getTime() - start.getTime();
		const oneDay = 1000 * 60 * 60 * 24;
		return Math.floor(diff / oneDay);
	}

	/**
	 * Get the week number of the year (1-53)
	 * @param date Date object
	 * @returns Week number
	 */
	private getWeekNumber(date: Date): number {
		const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
		const dayNum = d.getUTCDay() || 7;
		d.setUTCDate(d.getUTCDate() + 4 - dayNum);
		const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
		return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
	}

	/**
	 * Generate a UUID v4
	 * @returns UUID string
	 */
	private generateUUID(): string {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			const r = Math.random() * 16 | 0;
			const v = c === 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});
	}

	/**
	 * Generate a short ID (8 characters)
	 * @returns Short unique ID
	 */
	private generateShortId(): string {
		return Math.random().toString(36).substring(2, 10);
	}

	/**
	 * Create a simple hash of a string
	 * @param str String to hash
	 * @returns Hash string
	 */
	private createHash(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32bit integer
		}
		return Math.abs(hash).toString(16);
	}

	/**
	 * Get system information like hostname and username
	 * @param type The type of system info to get ('hostname' or 'username')
	 * @returns The requested system information
	 */
	private getSystemInfo(type: string): string {
		// Note: Due to Obsidian's sandboxed environment, we use a fallback approach
		if (type === 'hostname') {
			// Try to get a device identifier, fall back to "device"
			return 'device';
		} else if (type === 'username') {
			// Try to get username, fall back to "user"
			return 'user';
		}
		return '';
	}

	/**
	 * Convert text to a URL-friendly slug
	 * @param text Text to slugify
	 * @returns Slugified text
	 */
	private slugify(text: string): string {
		return text
			.toString()
			.toLowerCase()
			.trim()
			.replace(/\s+/g, '-')        // Replace spaces with -
			.replace(/&/g, '-and-')      // Replace & with 'and'
			.replace(/[^\w\-]+/g, '')    // Remove all non-word chars
			.replace(/\-\-+/g, '-')      // Replace multiple - with single -
			.replace(/^-+/, '')          // Trim - from start of text
			.replace(/-+$/, '');         // Trim - from end of text
	}

	/**
	 * Process non-date placeholders in the template
	 * @param template Template string with date placeholders already processed
	 * @returns Final processed string
	 */
	processOtherPlaceholders(template: string): string {
		let result = template;
		let match;

		// Handle random string placeholder: {random:N} 
		const randomRegex = /{random:(\d+)}/g;
		while ((match = randomRegex.exec(template)) !== null) {
			const length = parseInt(match[1]);
			const randomStr = this.generateRandomString(length);
			result = result.replace(match[0], randomStr);
		}

		// Handle unix timestamp with base conversion: {unixtime:base}
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

		// UUID: {uuid}
		result = result.replace(/{uuid}/g, this.generateUUID());

		// Short ID: {shortid}
		result = result.replace(/{shortid}/g, this.generateShortId());

		// Hash: {hash:text}
		const hashRegex = /{hash:([^}]+)}/g;
		while ((match = hashRegex.exec(template)) !== null) {
			const text = match[1];
			const hash = this.createHash(text);
			result = result.replace(match[0], hash);
		}

		// Global counter: {counter}
		result = result.replace(/{counter}/g, this.globalCounter.toString());
		this.globalCounter++;

		// Named counter: {counter:name}
		const namedCounterRegex = /{counter:([^}]+)}/g;
		while ((match = namedCounterRegex.exec(template)) !== null) {
			const counterName = match[1];
			if (counterName === 'reset') {
				this.globalCounter = 1;
				this.namedCounters = {};
				result = result.replace(match[0], '');
			} else {
				if (!this.namedCounters[counterName]) {
					this.namedCounters[counterName] = 1;
				}
				result = result.replace(match[0], this.namedCounters[counterName].toString());
				this.namedCounters[counterName]++;
			}
		}

		// System info: {hostname}, {username}
		result = result.replace(/{hostname}/g, this.getSystemInfo('hostname'));
		result = result.replace(/{username}/g, this.getSystemInfo('username'));

		// Text transformations
		const lowercaseRegex = /{lowercase:([^}]+)}/g;
		while ((match = lowercaseRegex.exec(template)) !== null) {
			const text = match[1];
			result = result.replace(match[0], text.toLowerCase());
		}

		const uppercaseRegex = /{uppercase:([^}]+)}/g;
		while ((match = uppercaseRegex.exec(template)) !== null) {
			const text = match[1];
			result = result.replace(match[0], text.toUpperCase());
		}

		const slugifyRegex = /{slugify:([^}]+)}/g;
		while ((match = slugifyRegex.exec(template)) !== null) {
			const text = match[1];
			result = result.replace(match[0], this.slugify(text));
		}

		// Clipboard integration - placeholder for now
		// In a real implementation, this would use the clipboard API
		const clipboardRegex = /{clip(?::(\d+))?}/g;
		while ((match = clipboardRegex.exec(template)) !== null) {
			const charLimit = match[1] ? parseInt(match[1]) : undefined;
			// In a real implementation, we'd get from clipboard
			const clipText = "clipboard-content";
			if (charLimit) {
				result = result.replace(match[0], clipText.slice(0, charLimit));
			} else {
				result = result.replace(match[0], clipText.split(' ')[0]);
			}
		}

		const clipWordRegex = /{clipword:(\d+)}/g;
		while ((match = clipWordRegex.exec(template)) !== null) {
			const wordIndex = parseInt(match[1]) - 1;
			// In a real implementation, we'd get from clipboard
			const clipText = "clipboard content example";
			const words = clipText.split(' ');
			if (wordIndex >= 0 && wordIndex < words.length) {
				result = result.replace(match[0], words[wordIndex]);
			} else {
				result = result.replace(match[0], '');
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