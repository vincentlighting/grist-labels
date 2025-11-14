# Grist Print Labels Widget

An enhanced Grist widget for creating and printing labels with multiple fields and custom formatting options.

## Features

- **Multiple Fields**: Display multiple columns from your Grist table on each label (no need for a combined "label content" column)
- **Custom Formatting**: 
  - Adjustable font size
  - Font color picker
  - Text alignment (left, center, right)
  - Line spacing
  - Custom field separator
  - Option to show/hide field names
- **Label Templates**: Support for various label sheet sizes (8, 10, 20, 30, 60, 80 per sheet)
- **Label Counts**: Optional column to specify how many labels to print per row

## Installation

1. Copy the widget files to a web-accessible location (or use a local server for development)
2. In Grist, go to Add Widget → Custom → Enter URL
3. Enter the URL to your `index.html` file

## Usage

### Setting Up Columns

1. **Column Management**: Click the ⚙ button in the widget header to open the options panel
2. Scroll down to the **"Column Management"** section
3. **Show/Hide columns**: Check or uncheck the boxes next to column names to control visibility
4. **Reorder columns**: Use the ↑ and ↓ buttons to change the order columns appear on labels
5. Optionally add a "Label count" column (numeric) to specify how many labels to print per row

**Note**: The widget automatically detects all available columns from your table (excluding system columns like `id` and `manualSort`). You can control which ones appear and in what order using the Column Management section.

### Formatting Options

Click the ⚙ button in the header to access formatting options:

- **Leave initial blanks**: Number of blank labels to leave at the start
- **Font size**: Adjust the text size (8-24pt)
- **Font color**: Choose the text color using a color picker
- **Text alignment**: Left, center, or right
- **Line spacing**: Adjust line height (1.0-3.0)
- **Field separator**: Custom separator between fields (e.g., ", ", " | ", etc.)
- **Show field names**: Toggle to display column names on labels
- **Column Management**: 
  - Check/uncheck columns to show or hide them on labels
  - Use ↑ and ↓ buttons to reorder columns
  - Changes are saved automatically

### Label Templates

Select from various standard label sheet sizes:
- 8 per sheet (2-1/3" x 3-3/8")
- 10 per sheet (2" x 4")
- 20 per sheet (1" x 4")
- 30 per sheet (1" x 2-5/8")
- 60 per sheet (1/2" x 1-3/4")
- 80 per sheet (1/2" x 1-3/4")

## File Structure

- `index.html` - Main HTML file
- `editable-labels.js` - Widget logic and functionality
- `editable-labels.css` - Styling
- `package.json` - Widget metadata

## Development

To test locally:

1. Serve the files using a local web server (e.g., `python -m http.server` or `npx serve`)
2. Use the local URL in Grist widget configuration

## Differences from Original Print Labels Widget

- **Multiple fields**: No need to create a combined "Label text" column
- **Formatting**: More formatting options for customization including font color
- **Read-only**: Labels are display-only for printing (data must be edited in the Grist table)

## Notes

- The widget requires "read table" access level (read-only)
- Field types (text, numeric, date) are automatically detected and formatted appropriately
- To edit data, make changes directly in your Grist table - the labels will update automatically

