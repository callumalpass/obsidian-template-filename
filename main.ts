import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, normalizePath } from 'obsidian';

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
	private globalCounter: number = 1;
	private namedCounters: Record<string, number> = {};

	async onload() {
		await this.loadSettings();

		// Add ribbon icon
		this.addRibbonIcon('file-plus', 'Create note with template filename', () => {
			new TemplateFilenameModal(this.app, this).open();
		});

		// Add command to create note with template filename using modal
		this.addCommand({
			id: 'create-note-with-template-filename',
			name: 'Create note with template filename',
			callback: () => {
				new TemplateFilenameModal(this.app, this).open();
			}
		});
		
		// Add command to create note directly with default template
		this.addCommand({
			id: 'create-note-with-default-template',
			name: 'Create note with default template',
			callback: async () => {
				try {
					const processedFilename = this.processTemplate(this.settings.defaultTemplate);
					const file = await this.createNote(processedFilename, this.settings.defaultContent);
					new Notice(`Created note: ${file.name}`);
					
					// Open the new note
					const activeLeaf = this.app.workspace.getLeaf(false);
					if (activeLeaf) {
						await activeLeaf.openFile(file);
					}
				} catch (error) {
					// Already handled in createNote
				}
			}
		});

		// Add settings tab
		this.addSettingTab(new TemplateFilenameSettingTab(this.app, this));
	}

	onunload() {
		// Nothing to clean up since we're using the built-in
		// Plugin methods for resource management
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Process a template string to create a filename
	 * @param template The template string
	 * @returns The processed template with all variables replaced
	 */
	processTemplate(template: string): string {
		// Create a tokenizer to properly parse the template
		const tokens = this.tokenizeTemplate(template);
		let result = '';

		// Process each token
		for (const token of tokens) {
			if (token.type === 'text' && token.value !== undefined) {
				result += token.value;
			} else if (token.type === 'variable' && token.name !== undefined) {
				result += this.processVariable(token.name, token.params || []);
			}
		}

		return result;
	}

	/**
	 * Tokenize a template string into text and variable tokens
	 * @param template The template string
	 * @returns Array of tokens
	 */
	private tokenizeTemplate(template: string): Array<{type: string, value?: string, name?: string, params?: string[]}> {
		const tokens: Array<{type: string, value?: string, name?: string, params?: string[]}> = [];
		let currentPos = 0;
		
		// Date/time variables to look for
		const dateTimeVars = [
			'YYYY', 'YY', 'MMMM', 'MMM', 'MM', 'M', 
			'DDD', 'DD', 'D', 'dddd', 'ddd', 'WW', 'Q',
			'HH', 'H', 'mm', 'm', 'ss', 's', 'SSS'
		];
		
		while (currentPos < template.length) {
			// Look for date/time variables
			let foundDateTimeVar = false;
			for (const dtVar of dateTimeVars) {
				if (template.substring(currentPos).startsWith(dtVar)) {
					// Found a date/time variable
					// Add any text before it
					if (currentPos > 0) {
						const textBefore = template.substring(0, currentPos);
						if (textBefore) {
							tokens.push({
								type: 'text',
								value: textBefore
							});
						}
					}
					
					// Add the date/time variable
					tokens.push({
						type: 'variable',
						name: dtVar,
						params: []
					});
					
					// Move past the variable
					template = template.substring(currentPos + dtVar.length);
					currentPos = 0;
					foundDateTimeVar = true;
					break;
				}
			}
			
			// If we found a date/time variable, continue to the next iteration
			if (foundDateTimeVar) {
				continue;
			}
			
			// Look for special variables in curly braces
			if (template[currentPos] === '{') {
				const endBracePos = template.indexOf('}', currentPos);
				if (endBracePos !== -1) {
					// Found a complete variable in braces
					// Add any text before the opening brace
					if (currentPos > 0) {
						const textBefore = template.substring(0, currentPos);
						if (textBefore) {
							tokens.push({
								type: 'text',
								value: textBefore
							});
						}
					}
					
					// Parse the variable and its parameters
					const varContent = template.substring(currentPos + 1, endBracePos);
					const colonPos = varContent.indexOf(':');
					
					if (colonPos !== -1) {
						// Variable with parameters
						const varName = varContent.substring(0, colonPos);
						const varParams = varContent.substring(colonPos + 1).split(',');
						
						tokens.push({
							type: 'variable',
							name: varName,
							params: varParams
						});
					} else {
						// Variable without parameters
						tokens.push({
							type: 'variable',
							name: varContent,
							params: []
						});
					}
					
					// Move past the closing brace
					template = template.substring(endBracePos + 1);
					currentPos = 0;
					continue;
				}
			}
			
			// Move to the next character
			currentPos++;
			
			// If we've reached the end, add the remaining text
			if (currentPos === template.length) {
				tokens.push({
					type: 'text',
					value: template
				});
			}
		}
		
		return tokens;
	}

	/**
	 * Process a variable token
	 * @param name Variable name
	 * @param params Variable parameters
	 * @returns The processed value
	 */
	private processVariable(name: string, params: string[] = []): string {
		const now = new Date();
		
		// Date/time variables
		switch (name) {
			// Year
			case 'YYYY': return now.getFullYear().toString();
			case 'YY': return now.getFullYear().toString().slice(2);
			
			// Month
			case 'MMMM': return this.getMonthName(now.getMonth());
			case 'MMM': return this.getMonthName(now.getMonth()).slice(0, 3);
			case 'MM': return (now.getMonth() + 1).toString().padStart(2, '0');
			case 'M': return (now.getMonth() + 1).toString();
			
			// Day
			case 'DDD': return this.getDayOfYear(now).toString().padStart(3, '0');
			case 'DD': return now.getDate().toString().padStart(2, '0');
			case 'D': return now.getDate().toString();
			
			// Day names
			case 'dddd': return this.getDayName(now.getDay());
			case 'ddd': return this.getDayName(now.getDay()).slice(0, 3);
			
			// Week
			case 'WW': return this.getWeekNumber(now).toString().padStart(2, '0');
			
			// Quarter
			case 'Q': return (Math.floor(now.getMonth() / 3) + 1).toString();
			
			// Hour
			case 'HH': return now.getHours().toString().padStart(2, '0');
			case 'H': return now.getHours().toString();
			
			// Minute
			case 'mm': return now.getMinutes().toString().padStart(2, '0');
			case 'm': return now.getMinutes().toString();
			
			// Second
			case 'ss': return now.getSeconds().toString().padStart(2, '0');
			case 's': return now.getSeconds().toString();
			
			// Millisecond
			case 'SSS': return now.getMilliseconds().toString().padStart(3, '0');
			
			// Random string
			case 'random': {
				const length = parseInt(params[0]) || 6;
				return this.generateRandomString(length);
			}
			
			// Unique identifiers
			case 'uuid': return this.generateUUID();
			case 'shortid': return this.generateShortId();
			
			// Hash
			case 'hash': return this.createHash(params[0] || '');
			
			// Timestamps
			case 'unixtime': {
				const base = parseInt(params[0]) || 10;
				if (base >= 2 && base <= 36) {
					return Math.floor(Date.now() / 1000).toString(base);
				}
				return Math.floor(Date.now() / 1000).toString();
			}
			
			case 'daytime': {
				const base = parseInt(params[0]) || 10;
				const secondsSinceMidnight = 
					now.getHours() * 3600 + 
					now.getMinutes() * 60 + 
					now.getSeconds();
				
				if (base >= 2 && base <= 36) {
					return secondsSinceMidnight.toString(base);
				}
				return secondsSinceMidnight.toString();
			}
			
			// Counters
			case 'counter': {
				if (params.length > 0) {
					if (params[0] === 'reset') {
						this.globalCounter = 1;
						this.namedCounters = {};
						return '';
					} else {
						const counterName = params[0];
						if (!this.namedCounters[counterName]) {
							this.namedCounters[counterName] = 1;
						}
						const value = this.namedCounters[counterName];
						this.namedCounters[counterName]++;
						return value.toString();
					}
				} else {
					const value = this.globalCounter;
					this.globalCounter++;
					return value.toString();
				}
			}
			
			// System variables
			case 'hostname': return 'device';
			case 'username': return 'user';
			
			// Text formatting
			case 'lowercase': return (params[0] || '').toLowerCase();
			case 'uppercase': return (params[0] || '').toUpperCase();
			case 'slugify': return this.slugify(params[0] || '');
			
			// Clipboard (placeholder implementation)
			case 'clip': {
				const clipText = "clipboard-content";
				if (params.length > 0) {
					const charLimit = parseInt(params[0]);
					return clipText.slice(0, charLimit);
				}
				return clipText.split(' ')[0];
			}
			
			case 'clipword': {
				const clipText = "clipboard content example";
				const words = clipText.split(' ');
				const wordIndex = parseInt(params[0]) - 1 || 0;
				if (wordIndex >= 0 && wordIndex < words.length) {
					return words[wordIndex];
				}
				return '';
			}
			
			// Unknown variable
			default: return `{${name}${params.length > 0 ? ':' + params.join(',') : ''}}`;
		}
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
	 * Generate a random string of specified length
	 * @param length Length of the random string
	 * @returns Random string
	 */
	private generateRandomString(length: number): string {
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

		// Normalize the path to ensure cross-platform compatibility
		const normalizedPath = normalizePath(filename);

		// Create the note
		try {
			const file = await this.app.vault.create(normalizedPath, content);
			return file;
		} catch (error) {
			// Only show error message to user, don't log to console unnecessarily
			new Notice(`Error creating note: ${error}`);
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
		contentEl.createEl('h2', { text: 'Create note with template filename' });
		
		// Template input
		contentEl.createEl('label', { text: 'Filename template:' }).setAttribute('for', 'template-input');
		this.templateInput = contentEl.createEl('input', {
			attr: {
				type: 'text',
				id: 'template-input'
			},
			value: this.plugin.settings.defaultTemplate,
			cls: 'template-input-field'
		});
		this.templateInput.addEventListener('input', () => this.updatePreview());
		
		// Help text for template syntax
		const helpText = contentEl.createEl('div', { cls: 'template-help' });
		
		// Create details element
		const details = helpText.createEl('details');
		details.createEl('summary', { text: 'Template syntax help' });
		
		// Date & Time
		const dateTimeSection = details.createEl('div');
		dateTimeSection.createEl('h4', { text: 'Date & time' });
		
		const dateTimeList = dateTimeSection.createEl('ul');
		const dateTimeItems = [
			{ name: 'YYYY', desc: '4-digit year (e.g., 2025)' },
			{ name: 'YY', desc: '2-digit year (e.g., 25)' },
			{ name: 'MM', desc: '2-digit month (01-12)' },
			{ name: 'M', desc: 'Month without leading zero (1-12)' },
			{ name: 'MMMM', desc: 'Full month name (January, February...)' },
			{ name: 'MMM', desc: 'Short month name (Jan, Feb...)' },
			{ name: 'DD', desc: '2-digit day (01-31)' },
			{ name: 'D', desc: 'Day without leading zero (1-31)' },
			{ name: 'DDD', desc: 'Day of year (001-366)' },
			{ name: 'dddd', desc: 'Full weekday name (Monday, Tuesday...)' },
			{ name: 'ddd', desc: 'Short weekday name (Mon, Tue...)' },
			{ name: 'WW', desc: 'Week number of year (01-53)' },
			{ name: 'Q', desc: 'Quarter of year (1-4)' },
			{ name: 'HH', desc: '2-digit hour, 24-hour format (00-23)' },
			{ name: 'H', desc: 'Hour without leading zero (0-23)' },
			{ name: 'mm', desc: '2-digit minute (00-59)' },
			{ name: 'm', desc: 'Minute without leading zero (0-59)' },
			{ name: 'ss', desc: '2-digit second (00-59)' },
			{ name: 's', desc: 'Second without leading zero (0-59)' },
			{ name: 'SSS', desc: '3-digit millisecond (000-999)' }
		];
		
		this.createHelpList(dateTimeList, dateTimeItems);
		
		// Unique Identifiers
		const idSection = details.createEl('div');
		idSection.createEl('h4', { text: 'Unique identifiers & timestamps' });
		
		const idList = idSection.createEl('ul');
		const idItems = [
			{ name: '{random:N}', desc: 'Random string of N characters' },
			{ name: '{uuid}', desc: 'Generate a UUID/GUID' },
			{ name: '{shortid}', desc: 'Generate a shorter unique ID (8 chars)' },
			{ name: '{unixtime:B}', desc: 'Unix timestamp in base B (2-36)' },
			{ name: '{daytime:B}', desc: 'Seconds since midnight in base B (2-36)' },
			{ name: '{hash:text}', desc: 'Create a hash of provided text' }
		];
		
		this.createHelpList(idList, idItems);
		
		// Counter Variables
		const counterSection = details.createEl('div');
		counterSection.createEl('h4', { text: 'Counter variables' });
		
		const counterList = counterSection.createEl('ul');
		const counterItems = [
			{ name: '{counter}', desc: 'Global auto-incrementing counter' },
			{ name: '{counter:name}', desc: 'Named counter (separate sequence)' },
			{ name: '{counter:reset}', desc: 'Reset all counters' }
		];
		
		this.createHelpList(counterList, counterItems);
		
		// System Variables
		const systemSection = details.createEl('div');
		systemSection.createEl('h4', { text: 'System variables' });
		
		const systemList = systemSection.createEl('ul');
		const systemItems = [
			{ name: '{hostname}', desc: 'Computer/device name' },
			{ name: '{username}', desc: 'Current user\'s name' }
		];
		
		this.createHelpList(systemList, systemItems);
		
		// Text Formatting
		const formatSection = details.createEl('div');
		formatSection.createEl('h4', { text: 'Text formatting' });
		
		const formatList = formatSection.createEl('ul');
		const formatItems = [
			{ name: '{lowercase:text}', desc: 'Convert text to lowercase' },
			{ name: '{uppercase:text}', desc: 'Convert text to uppercase' },
			{ name: '{slugify:text}', desc: 'Convert text to URL-friendly slug' }
		];
		
		this.createHelpList(formatList, formatItems);
		
		// Clipboard
		const clipboardSection = details.createEl('div');
		clipboardSection.createEl('h4', { text: 'Clipboard integration' });
		
		const clipboardList = clipboardSection.createEl('ul');
		const clipboardItems = [
			{ name: '{clip}', desc: 'First word from clipboard' },
			{ name: '{clip:N}', desc: 'First N characters from clipboard' },
			{ name: '{clipword:N}', desc: 'Nth word from clipboard' }
		];
		
		this.createHelpList(clipboardList, clipboardItems);
		
		// Preview
		contentEl.createEl('label', { text: 'Preview:' });
		this.previewEl = contentEl.createEl('div', { cls: 'template-preview' });
		
		// Note content
		contentEl.createEl('label', { text: 'Note content:' }).setAttribute('for', 'content-input');
		this.contentInput = contentEl.createEl('textarea', {
			attr: { id: 'content-input' },
			cls: 'content-input-field',
			value: this.plugin.settings.defaultContent
		});
		
		// Buttons
		const buttonContainer = contentEl.createEl('div', { cls: 'button-container' });
		
		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => this.close());
		
		const createButton = buttonContainer.createEl('button', { text: 'Create', cls: 'mod-cta' });
		createButton.addEventListener('click', () => this.createNote());
		
		// Update preview on initial load
		this.updatePreview();
	}
	
	createHelpList(parentEl: HTMLElement, items: {name: string, desc: string}[]) {
		items.forEach(item => {
			const listItem = parentEl.createEl('li');
			listItem.createEl('strong', { text: item.name });
			listItem.createSpan({ text: ': ' + item.desc });
		});
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
			
			// Open the new note using proper API
			const activeLeaf = this.app.workspace.getLeaf(false);
			if (activeLeaf) {
				await activeLeaf.openFile(file);
			}
			
			// Close the modal
			this.close();
		} catch (error) {
			// Already handled in the plugin.createNote method
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

		// General settings (no heading per guidelines)
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

		// Help section (using Setting.setHeading as recommended)
		new Setting(containerEl).setName('Template syntax help').setHeading();
		
		// Date and time 
		new Setting(containerEl).setName('Date and time').setClass('setting-item-heading');
		
		const dateTimeSection = containerEl.createDiv({ cls: 'setting-item-description' });
		const dateTimeList = dateTimeSection.createEl('ul', { cls: 'help-list' });
		const dateTimeItems = [
			{ name: 'YYYY', desc: '4-digit year (e.g., 2025)' },
			{ name: 'YY', desc: '2-digit year (e.g., 25)' },
			{ name: 'MM', desc: '2-digit month (01-12)' },
			{ name: 'M', desc: 'Month without leading zero (1-12)' },
			{ name: 'MMMM', desc: 'Full month name (January, February...)' },
			{ name: 'MMM', desc: 'Short month name (Jan, Feb...)' },
			{ name: 'DD', desc: '2-digit day (01-31)' },
			{ name: 'D', desc: 'Day without leading zero (1-31)' },
			{ name: 'DDD', desc: 'Day of year (001-366)' },
			{ name: 'dddd', desc: 'Full weekday name (Monday, Tuesday...)' },
			{ name: 'ddd', desc: 'Short weekday name (Mon, Tue...)' },
			{ name: 'WW', desc: 'Week number of year (01-53)' },
			{ name: 'Q', desc: 'Quarter of year (1-4)' },
			{ name: 'HH', desc: '2-digit hour, 24-hour format (00-23)' },
			{ name: 'H', desc: 'Hour without leading zero (0-23)' },
			{ name: 'mm', desc: '2-digit minute (00-59)' },
			{ name: 'm', desc: 'Minute without leading zero (0-59)' },
			{ name: 'ss', desc: '2-digit second (00-59)' },
			{ name: 's', desc: 'Second without leading zero (0-59)' },
			{ name: 'SSS', desc: '3-digit millisecond (000-999)' }
		];
		
		this.createHelpList(dateTimeList, dateTimeItems);
		
		// IDs and timestamps
		new Setting(containerEl).setName('Unique identifiers and timestamps').setClass('setting-item-heading');
		
		const idSection = containerEl.createDiv({ cls: 'setting-item-description' });
		const idList = idSection.createEl('ul', { cls: 'help-list' });
		const idItems = [
			{ name: '{random:N}', desc: 'Random string of N characters' },
			{ name: '{uuid}', desc: 'Generate a UUID/GUID' },
			{ name: '{shortid}', desc: 'Generate a shorter unique ID (8 chars)' },
			{ name: '{unixtime:B}', desc: 'Unix timestamp in base B (2-36)' },
			{ name: '{daytime:B}', desc: 'Seconds since midnight in base B (2-36)' },
			{ name: '{hash:text}', desc: 'Create a hash of provided text' }
		];
		
		this.createHelpList(idList, idItems);
		
		// Counter variables
		new Setting(containerEl).setName('Counter variables').setClass('setting-item-heading');
		
		const counterSection = containerEl.createDiv({ cls: 'setting-item-description' });
		const counterList = counterSection.createEl('ul', { cls: 'help-list' });
		const counterItems = [
			{ name: '{counter}', desc: 'Global auto-incrementing counter' },
			{ name: '{counter:name}', desc: 'Named counter (separate sequence)' },
			{ name: '{counter:reset}', desc: 'Reset all counters' }
		];
		
		this.createHelpList(counterList, counterItems);
		
		// System variables
		new Setting(containerEl).setName('System variables').setClass('setting-item-heading');
		
		const systemSection = containerEl.createDiv({ cls: 'setting-item-description' });
		const systemList = systemSection.createEl('ul', { cls: 'help-list' });
		const systemItems = [
			{ name: '{hostname}', desc: 'Computer/device name' },
			{ name: '{username}', desc: 'Current user\'s name' }
		];
		
		this.createHelpList(systemList, systemItems);
		
		// Text formatting
		new Setting(containerEl).setName('Text formatting').setClass('setting-item-heading');
		
		const formatSection = containerEl.createDiv({ cls: 'setting-item-description' });
		const formatList = formatSection.createEl('ul', { cls: 'help-list' });
		const formatItems = [
			{ name: '{lowercase:text}', desc: 'Convert text to lowercase' },
			{ name: '{uppercase:text}', desc: 'Convert text to uppercase' },
			{ name: '{slugify:text}', desc: 'Convert text to URL-friendly slug' }
		];
		
		this.createHelpList(formatList, formatItems);
		
		// Clipboard integration
		new Setting(containerEl).setName('Clipboard integration').setClass('setting-item-heading');
		
		const clipboardSection = containerEl.createDiv({ cls: 'setting-item-description' });
		const clipboardList = clipboardSection.createEl('ul', { cls: 'help-list' });
		const clipboardItems = [
			{ name: '{clip}', desc: 'First word from clipboard' },
			{ name: '{clip:N}', desc: 'First N characters from clipboard' },
			{ name: '{clipword:N}', desc: 'Nth word from clipboard' }
		];
		
		this.createHelpList(clipboardList, clipboardItems);

		// Examples section
		new Setting(containerEl).setName('Examples').setHeading();
		
		const examplesSection = containerEl.createDiv({ cls: 'setting-item-description examples' });
		const examplesList = examplesSection.createEl('ul', { cls: 'example-list' });
		const examples = [
			{ template: 'YYYY-MM-DD_note', desc: '2025-04-24_note.md' },
			{ template: 'YYYY-MM-DD_HH-mm-ss', desc: '2025-04-24_15-30-45.md' },
			{ template: 'MMM-D-YYYY_meeting-notes', desc: 'Apr-24-2025_meeting-notes.md' },
			{ template: 'Q-YYYY-{random:6}', desc: '2-2025-a7bF9c.md' },
			{ template: 'note_{random:6}', desc: 'note_a7bF9c.md' },
			{ template: 'note_{shortid}', desc: 'note_2a9d8f7b.md' },
			{ template: '{uuid}', desc: '123e4567-e89b-12d3-a456-426614174000.md' },
			{ template: 'note_{unixtime:36}', desc: 'note_1c9rbbk.md (Unix time in base 36)' },
			{ template: 'log_{daytime:16}', desc: 'log_12ab3.md (Seconds since midnight in base 16)' },
			{ template: 'entry-{counter}', desc: 'entry-1.md, entry-2.md, etc.' },
			{ template: '{slugify:Meeting Notes 2025}', desc: 'meeting-notes-2025.md' }
		];
		
		examples.forEach(example => {
			const listItem = examplesList.createEl('li');
			listItem.createEl('code', { text: example.template });
			listItem.createSpan({ text: ' → ' + example.desc });
		});
	}
	
	createHelpList(parentEl: HTMLElement, items: {name: string, desc: string}[]) {
		items.forEach(item => {
			const listItem = parentEl.createEl('li');
			listItem.createEl('strong', { text: item.name });
			listItem.createSpan({ text: ': ' + item.desc });
		});
	}
}