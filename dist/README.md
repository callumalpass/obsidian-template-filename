# Obsidian Template Filename Plugin

An Obsidian plugin for creating notes with templatable filenames using date/time formats, random strings, and custom base numbering systems.

## Features

- Create notes with templated filenames
- Live preview of the generated filename
- Configurable default template and content
- Date and time formatting
- Random string generation
- Unix timestamp in various bases
- Seconds since midnight in various bases

## Usage

1. Open the command palette (Ctrl/Cmd+P)
2. Search for "Create note with template filename"
3. Enter your filename template
4. Enter note content (optional)
5. Click "Create"

Alternatively, click the "file plus" icon in the left ribbon.

## Template Syntax

| Placeholder | Description |
|-------------|-------------|
| `YYYY` | 4-digit year (e.g., 2025) |
| `YY` | 2-digit year (e.g., 25) |
| `MM` | 2-digit month (01-12) |
| `M` | Month without leading zero (1-12) |
| `DD` | 2-digit day (01-31) |
| `D` | Day without leading zero (1-31) |
| `HH` | 2-digit hour, 24-hour format (00-23) |
| `H` | Hour without leading zero (0-23) |
| `mm` | 2-digit minute (00-59) |
| `m` | Minute without leading zero (0-59) |
| `ss` | 2-digit second (00-59) |
| `s` | Second without leading zero (0-59) |
| `SSS` | 3-digit millisecond (000-999) |
| `{random:N}` | Random string of N characters |
| `{unixtime:B}` | Unix timestamp in base B (2-36) |
| `{daytime:B}` | Seconds since midnight in base B (2-36) |

## Examples

- `YYYY-MM-DD_note` → 2025-04-24_note.md
- `YYYY-MM-DD_HH-mm-ss` → 2025-04-24_15-30-45.md
- `note_{random:6}` → note_a7bF9c.md
- `note_{unixtime:36}` → note_1c9rbbk.md (Unix time in base 36)
- `log_{daytime:16}` → log_12ab3.md (Seconds since midnight in base 16)

## Installation

### From Obsidian

1. Open Settings > Community plugins
2. Turn off Safe mode if it's on
3. Click Browse community plugins
4. Search for "Template Filename"
5. Click Install
6. After installation is complete, click Enable

### Manual Installation

1. Download the latest release from the releases page
2. Extract the zip file to your Obsidian plugins folder: `<vault>/.obsidian/plugins/`
3. Reload Obsidian
4. Enable the plugin in Settings > Community plugins

## Development

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run dev` to start development server
4. Make changes to the code
5. Test your changes in Obsidian

## License

MIT