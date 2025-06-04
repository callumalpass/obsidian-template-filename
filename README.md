# Template Filename

An Obsidian plugin for creating notes with templatable filenames using date/time formats, random strings, and custom base numbering systems.

## Features

- Create notes with templated filenames
- Live preview of the generated filename
- Configurable default template and content
- Extensive date and time formatting options
- Random string generation and unique identifiers
- Unix timestamp in various bases
- Seconds since midnight in various bases
- Counter variables for sequential naming
- Text formatting utilities
- System information variables
- Clipboard integration

## Usage

1. Open the command palette (Ctrl/Cmd+P)
2. Search for "Create note with template filename"
3. Enter your filename template
4. Enter note content (optional)
5. Click "Create"

Alternatively, click the "file plus" icon in the left ribbon.

## Template Syntax

### Date & Time

| Placeholder | Description |
|-------------|-------------|
| `YYYY` | 4-digit year (e.g., 2025) |
| `YY` | 2-digit year (e.g., 25) |
| `MM` | 2-digit month (01-12) |
| `M` | Month without leading zero (1-12) |
| `MMMM` | Full month name (January, February...) |
| `MMM` | Short month name (Jan, Feb...) |
| `DD` | 2-digit day (01-31) |
| `D` | Day without leading zero (1-31) |
| `DDD` | Day of year (001-366) |
| `dddd` | Full weekday name (Monday, Tuesday...) |
| `ddd` | Short weekday name (Mon, Tue...) |
| `WW` | Week number of year (01-53) |
| `Q` | Quarter of year (1-4) |
| `HH` | 2-digit hour, 24-hour format (00-23) |
| `H` | Hour without leading zero (0-23) |
| `mm` | 2-digit minute (00-59) |
| `m` | Minute without leading zero (0-59) |
| `ss` | 2-digit second (00-59) |
| `s` | Second without leading zero (0-59) |
| `SSS` | 3-digit millisecond (000-999) |

### Unique Identifiers & Timestamps

| Placeholder | Description |
|-------------|-------------|
| `{random:N}` | Random string of N characters |
| `{uuid}` | Generate a UUID/GUID |
| `{shortid}` | Generate a shorter unique ID (8 chars) |
| `{unixtime:B}` | Unix timestamp in base B (2-36) |
| `{daytime:B}` | Seconds since midnight in base B (2-36) |
| `{hash:text}` | Create a hash of provided text |

### Counter Variables

| Placeholder | Description |
|-------------|-------------|
| `{counter}` | Global auto-incrementing counter |
| `{counter:name}` | Named counter (separate sequence) |
| `{counter:reset}` | Reset all counters |

### System Variables

| Placeholder | Description |
|-------------|-------------|
| `{hostname}` | Computer/device name |
| `{username}` | Current user's name |

### Text Formatting

| Placeholder | Description |
|-------------|-------------|
| `{lowercase:text}` | Convert text to lowercase |
| `{uppercase:text}` | Convert text to uppercase |
| `{slugify:text}` | Convert text to URL-friendly slug |

### Clipboard Integration

| Placeholder | Description |
|-------------|-------------|
| `{clip}` | First word from clipboard |
| `{clip:N}` | First N characters from clipboard |
| `{clipword:N}` | Nth word from clipboard |

## Examples

- `YYYY-MM-DD_note` → 2025-04-24_note.md
- `YYYY-MM-DD_HH-mm-ss` → 2025-04-24_15-30-45.md
- `MMM-D-YYYY_meeting-notes` → Apr-24-2025_meeting-notes.md
- `Q-YYYY-{random:6}` → 2-2025-a7bF9c.md
- `note_{random:6}` → note_a7bF9c.md
- `note_{shortid}` → note_2a9d8f7b.md
- `{uuid}` → 123e4567-e89b-12d3-a456-426614174000.md
- `note_{unixtime:36}` → note_1c9rbbk.md (Unix time in base 36)
- `log_{daytime:16}` → log_12ab3.md (Seconds since midnight in base 16)
- `entry-{counter}` → entry-1.md, entry-2.md, etc.
- `{slugify:Meeting Notes 2025}` → meeting-notes-2025.md

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
