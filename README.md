# Grist Editable Print Labels Widget

An enhanced Grist widget for creating, editing, and printing labels with multiple fields and custom formatting options.

## Features

- **Multiple Fields**: Display multiple columns from your Grist table on each label (no need for a combined "label content" column)
- **Editable Labels**: Click on any label to edit it directly - changes are saved back to your Grist table
- **Custom Formatting**: 
  - Adjustable font size
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

1. In the Grist Creator Panel for this widget, select which columns you want to display on labels
2. Optionally add a "Label count" column (numeric) to specify how many labels to print per row
3. The widget will automatically use all selected columns (except "Label count") as label fields

### Editing Labels

- Click on any label to edit it
- When field names are shown: Edit in the format "FieldName: value" (one per line)
- When field names are hidden: Edit values separated by your chosen separator (or line breaks)
- Press Enter or click away to save changes
- Changes are automatically synced back to your Grist table

### Formatting Options

Click the ⚙ button in the header to access formatting options:

- **Leave initial blanks**: Number of blank labels to leave at the start
- **Font size**: Adjust the text size (8-24pt)
- **Text alignment**: Left, center, or right
- **Line spacing**: Adjust line height (1.0-3.0)
- **Field separator**: Custom separator between fields (e.g., ", ", " | ", etc.)
- **Show field names**: Toggle to display column names on labels

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
- **Editing**: Labels are editable directly in the widget
- **Formatting**: More formatting options for customization
- **Access level**: Requires "full" access to enable editing (vs "read table" in original)

## Notes

- The widget requires "full" access level to enable editing capabilities
- Changes made in the widget are saved back to the original Grist table
- Field types (text, numeric, date) are automatically detected and formatted appropriately
- When editing, numeric and date fields are converted back to their proper types when saved

