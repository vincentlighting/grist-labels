function ready(fn) {
  if (document.readyState !== 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

const templates = [{
  id: 'labels8',
  name: '8 per sheet (2-1/3" x 3-3/8")',
  perPage: 8,
}, {
  id: 'labels10',
  name: '10 per sheet (2" x 4")',
  perPage: 10,
}, {
  id: 'labels20',
  name: '20 per sheet (1" x 4")',
  perPage: 20,
}, {
  id: 'labels30',
  name: '30 per sheet (1" x 2-5/8")',
  perPage: 30,
}, {
  id: 'labels60',
  name: '60 per sheet (1/2" x 1-3/4")',
  perPage: 60,
}, {
  id: 'labels80',
  name: '80 per sheet (1/2" x 1-3/4")',
  perPage: 80,
}];

// For backward compatibility we will read starting template from a URL's hash or store, but
// this should not be used any more.
const defaultTemplate =
  findTemplate(document.location.hash.slice(1)) ||
  findTemplate('labels30');

function findTemplate(id) {
  return templates.find(t => t.id === id);
}

let app = undefined;
let data = {
  status: 'waiting',
  labelData: null,
  template: defaultTemplate,
  showOptions: false,
  // Blanks, if positive, tells to leave this number of labels blank before starting to populate
  // them with data.
  blanks: 0,
  rows: null,
  // Formatting options
  fontSize: 11,
  fontColor: '#000000',
  textAlign: 'left',
  lineSpacing: 1.2,
  separator: ', ',
  showFieldNames: false,
  // Column mappings - will be populated from Grist
  columnMappings: {},
  // Store original row indices for editing
  rowIndices: [],
  // Column configuration: visibility and order
  columnConfig: [],
  // Visual editor mode
  visualEditorMode: false,
  selectedField: null,
  dragging: false,
  dragStartPos: { x: 0, y: 0 },
  dragField: null
};

// Columns we expect - now supports multiple fields
const LabelCount = 'LabelCount';

// Guard to prevent infinite loops
let isUpdating = false;

function arrangeLabels(labelData, template, blanks) {
  const pages = [];
  let page = [];
  blanks = blanks || 0;
  for (let i = 0; i < blanks + labelData.length; i++) {
    if (page.length >= template.perPage) {
      pages.push(page);
      page = [];
    }
    if (i < blanks) {
      page.push(null);
    } else {
      const label = labelData[i - blanks];
      if (label) {
        page.push(label);
      }
    }
  }
  while (page.length < template.perPage) {
    page.push(null);
  }
  pages.push(page);
  return pages;
}

function handleError(err) {
  console.error('ERROR', err);
  const target = app || data;
  target.labelData = null;
  const errorMsg = err instanceof Error ? err.message : String(err);
  target.status = errorMsg.replace(/^Error: /, '');
  // Make sure status is visible
  if (target.status && target.status !== 'waiting') {
    console.error('Widget error:', target.status);
  }
}

function formatField(field) {
  if (field.value === null || field.value === undefined) {
    return '';
  }
  // Apply formatting based on field type
  if (field.type === 'Numeric' || field.type === 'Int') {
    // Format numbers with appropriate precision
    const num = parseFloat(field.value);
    if (isNaN(num)) return String(field.value);
    // Check if it's a whole number
    if (num % 1 === 0) {
      return num.toString();
    }
    // For decimals, show up to 2 decimal places
    return num.toFixed(2).replace(/\.?0+$/, '');
  }
  if (field.type === 'Date') {
    // Format dates
    const date = new Date(field.value);
    if (isNaN(date.getTime())) return String(field.value);
    return date.toLocaleDateString();
  }
  return String(field.value);
}

function updateRecords() {
  // Prevent infinite loops
  if (isUpdating) {
    return;
  }
  isUpdating = true;
  try {
    data.status = '';
    const rows = data.rows;
    if (!rows || !rows.length) {
      throw new Error("No data. Please add some rows");
    }
    
    // Get columns from the mapped rows
    // When columns are selected in Creator Panel, grist.mapColumnNames() returns only selected columns
    // Otherwise, it returns all columns (we'll filter out system columns)
    const allColumns = Object.keys(rows[0]);
    
    // Filter out system columns and LabelCount
    const availableColumns = allColumns.filter(col => 
      col !== LabelCount && 
      col !== 'id' && 
      col !== 'manualSort' &&
      !col.startsWith('_')
    );
    
    if (availableColumns.length === 0) {
      throw new Error(`Please select columns to display on labels. In the Creator Panel, click "Select by" and choose which columns to include.`);
    }
    
    // Initialize or update column configuration
    // Check if we have a valid saved config
    const hasSavedConfig = data.columnConfig && Array.isArray(data.columnConfig) && data.columnConfig.length > 0;
    
    if (!hasSavedConfig) {
      // First time: initialize with all columns
      // Calculate default positions (stacked vertically)
      data.columnConfig = availableColumns.map((col, idx) => ({
        name: col,
        position: { x: 5, y: 5 + (idx * 15) }, // Default: left-aligned, stacked
        formatting: {
          fontSize: data.fontSize || 11,
          color: data.fontColor || '#000000',
          align: 'left',
          fontWeight: 'normal'
        }
      }));
    } else {
      // Ensure columnConfig is properly structured first
      data.columnConfig = data.columnConfig.map((col, idx) => {
        if (typeof col === 'string') {
          // Handle case where config was saved as just strings
          return { 
            name: col, 
            position: { x: 5, y: 5 + (idx * 15) },
            formatting: {
              fontSize: data.fontSize || 11,
              color: data.fontColor || '#000000',
              align: 'left',
              fontWeight: 'normal'
            }
          };
        }
        return {
          name: col.name,
          position: col.position || { x: 5, y: 5 + (idx * 15) },
          formatting: col.formatting || {
            fontSize: data.fontSize || 11,
            color: data.fontColor || '#000000',
            align: 'left',
            fontWeight: 'normal'
          }
        };
      });
      
      // Update: add new columns, remove deleted ones, preserve positions and formatting
      const existingNames = new Set(data.columnConfig.map(c => c.name));
      const newColumns = availableColumns.filter(col => !existingNames.has(col));
      
      // Add new columns at the end
      const lastY = data.columnConfig.length > 0 
        ? Math.max(...data.columnConfig.map(c => c.position ? c.position.y : 0)) + 15
        : 5;
      newColumns.forEach((col, idx) => {
        data.columnConfig.push({ 
          name: col, 
          position: { x: 5, y: lastY + (idx * 15) },
          formatting: {
            fontSize: data.fontSize || 11,
            color: data.fontColor || '#000000',
            align: 'left',
            fontWeight: 'normal'
          }
        });
      });
      
      // Remove columns that no longer exist
      data.columnConfig = data.columnConfig.filter(c => availableColumns.includes(c.name));
      
      // Ensure all current columns are in the config (in case config was corrupted)
      availableColumns.forEach(col => {
        if (!existingNames.has(col)) {
          // Already added above, but double-check
          const exists = data.columnConfig.some(c => c.name === col);
          if (!exists) {
            const idx = availableColumns.indexOf(col);
            data.columnConfig.push({ 
              name: col,
              position: { x: 5, y: 5 + (idx * 15) },
              formatting: {
                fontSize: data.fontSize || 11,
                color: data.fontColor || '#000000',
                align: 'left',
                fontWeight: 'normal'
              }
            });
          }
        }
      });
    }
    
    // Use all available columns (no filtering)
    const labelColumns = availableColumns;
    
    if (labelColumns.length === 0) {
      throw new Error(`No columns available. Please ensure your table has data columns.`);
    }
    
    // Store column metadata
    data.columnMappings = {};
    labelColumns.forEach(col => {
      data.columnMappings[col] = col;
    });
    
    const haveCounts = rows[0].hasOwnProperty(LabelCount);
    const labelData = [];
    data.rowIndices = [];
    
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const r = rows[rowIndex];
      // parseFloat to be generous about the type of LabelCount. Text will be accepted.
      const count = haveCounts ? parseFloat(r[LabelCount]) || 1 : 1;
      
      for (let i = 0; i < count; i++) {
        const fields = labelColumns.map(colName => {
          // Try to infer type from the value
          let fieldType = 'Text';
          const value = r[colName];
          if (value !== null && value !== undefined) {
            if (typeof value === 'number' || (!isNaN(parseFloat(value)) && value !== '')) {
              fieldType = 'Numeric';
            } else if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)) && value.length > 0)) {
              fieldType = 'Date';
            }
          }
          
          // Get column config for this field
          const colConfig = data.columnConfig.find(c => c.name === colName);
          
          return {
            name: colName,
            value: value,
            type: fieldType,
            columnId: colName,
            rowId: r.id,
            position: colConfig ? (colConfig.position || { x: 5, y: 5 }) : { x: 5, y: 5 },
            formatting: colConfig ? (colConfig.formatting || {
              fontSize: data.fontSize || 11,
              color: data.fontColor || '#000000',
              align: 'left',
              fontWeight: 'normal'
            }) : {
              fontSize: data.fontSize || 11,
              color: data.fontColor || '#000000',
              align: 'left',
              fontWeight: 'normal'
            }
          };
        });
        
        labelData.push({
          fields: fields,
          rowIndex: rowIndex,
          rowId: r.id
        });
        data.rowIndices.push(rowIndex);
      }
    }
    data.labelData = labelData;
    // Clear any previous error status
    if (data.status && data.status !== 'waiting') {
      data.status = '';
    }
  } catch (err) {
    handleError(err);
    // Ensure we don't have invalid data
    data.labelData = null;
  } finally {
    isUpdating = false;
  }
}


// Page width before any scaling is applied.
let pageWidth = null;

function updateSize() {
  const page = document.querySelector('.page-outer');
  if (!page) { return; }
  if (!pageWidth) {
    pageWidth = page.getBoundingClientRect().width;
  }
  document.body.style.setProperty('--page-scaling', window.innerWidth / pageWidth);
}

ready(function() {
  grist.ready({
    requiredAccess: 'read table',
    columns: [
      {
        name: LabelCount,
        title: "Label count",
        type: "Numeric",
        optional: true
      }
    ]
  });
  
  // Listen to configuration change.
  grist.onOptions((options) => {
    if (options) {
      // Read saved options.
      data.template = findTemplate(options.template) || defaultTemplate;
      data.blanks = options.blanks || 0;
      data.fontSize = options.fontSize || 11;
      data.fontColor = options.fontColor || '#000000';
      data.textAlign = options.textAlign || 'left';
      data.lineSpacing = options.lineSpacing || 1.2;
      data.separator = options.separator || ', ';
      data.showFieldNames = options.showFieldNames || false;
      // Load column configuration if saved
      if (options.columnConfig && Array.isArray(options.columnConfig) && options.columnConfig.length > 0) {
        data.columnConfig = options.columnConfig;
      }
      // Load visual editor mode
      data.visualEditorMode = options.visualEditorMode || false;
    } else {
      // Revert to defaults.
      data.template = defaultTemplate;
      data.blanks = 0;
      data.fontSize = 11;
      data.fontColor = '#000000';
      data.textAlign = 'left';
      data.lineSpacing = 1.2;
      data.separator = ', ';
      data.showFieldNames = false;
      data.columnConfig = [];
      data.visualEditorMode = false;
    }
    // Don't call updateRecords here - let the rows watch handle it
    // This prevents infinite loops
  })
  
  // Update the widget anytime the document data changes.
  grist.onRecords((rows) => {
    // We will fallback to reading rows directly to support
    // old widgets that didn't use column mappings.
    data.rows = grist.mapColumnNames(rows) || rows;
  });
  
  window.onresize = updateSize;

  Vue.config.errorHandler = handleError;
  app = new Vue({
    el: '#app',
    data: data,
    computed: {
      labelStyle() {
        return {
          fontSize: this.fontSize + 'pt',
          color: this.fontColor,
          textAlign: this.textAlign,
          lineHeight: this.lineSpacing
        };
      }
    },
    watch : {
      rows() {
        updateRecords();
      }
    },
    methods: {
      arrangeLabels,
      formatField,
      getLabelText(label) {
        if (!label || !label.fields) return '';
        const parts = [];
        label.fields.forEach((field, idx) => {
          if (this.showFieldNames && field.name) {
            parts.push(`${field.name}: ${this.formatField(field)}`);
          } else {
            parts.push(this.formatField(field));
          }
        });
        const separator = this.showFieldNames ? '\n' : (this.separator || '\n');
        return parts.join(separator);
      },
      getFieldStyle(field) {
        return {
          marginBottom: this.separator ? '0' : '0.2em'
        };
      },
      hasPositionedFields(label) {
        if (!label || !label.fields) return false;
        // Check if any field has a custom position (not default stacked)
        return label.fields.some(field => {
          const colConfig = this.columnConfig.find(c => c.name === field.columnId);
          if (!colConfig || !colConfig.position) return false;
          // Consider it positioned if not at default stacked position
          return colConfig.position.x !== 5 || colConfig.position.y > 20;
        });
      },
      getPositionedFieldStyle(field) {
        const colConfig = this.columnConfig.find(c => c.name === field.columnId);
        const position = colConfig && colConfig.position ? colConfig.position : { x: 5, y: 5 };
        const formatting = colConfig && colConfig.formatting ? colConfig.formatting : {
          fontSize: this.fontSize || 11,
          color: this.fontColor || '#000000',
          align: 'left',
          fontWeight: 'normal'
        };
        
        return {
          position: 'absolute',
          left: position.x + '%',
          top: position.y + '%',
          fontSize: formatting.fontSize + 'pt',
          color: formatting.color,
          textAlign: formatting.align,
          fontWeight: formatting.fontWeight
        };
      },
      async save() {
        // Custom save handler to save only when user changed the value.
        await grist.widgetApi.setOption('template', this.template.id);
        await grist.widgetApi.setOption('blanks', this.blanks);
        await grist.widgetApi.setOption('fontSize', this.fontSize);
        await grist.widgetApi.setOption('fontColor', this.fontColor);
        await grist.widgetApi.setOption('textAlign', this.textAlign);
        await grist.widgetApi.setOption('lineSpacing', this.lineSpacing);
        await grist.widgetApi.setOption('separator', this.separator);
        await grist.widgetApi.setOption('showFieldNames', this.showFieldNames);
        await grist.widgetApi.setOption('columnConfig', this.columnConfig);
        await grist.widgetApi.setOption('visualEditorMode', this.visualEditorMode);
      },
      // Visual editor methods
      toggleVisualEditor() {
        this.visualEditorMode = !this.visualEditorMode;
        this.selectedField = null;
        // Force Vue to update
        this.$forceUpdate();
        if (this.visualEditorMode) {
          this.save();
        }
      },
      closeEditor() {
        this.visualEditorMode = false;
        this.selectedField = null;
        this.save();
        // Update all labels with the new configuration
        if (this.rows) {
          updateRecords();
        }
      },
      getEditorFields() {
        // Return fields based on columnConfig for the editor (using column names as placeholders)
        if (!this.columnConfig || this.columnConfig.length === 0) {
          // If no config yet, try to get from available columns
          if (this.rows && this.rows.length > 0) {
            const allColumns = Object.keys(this.rows[0]);
            const availableColumns = allColumns.filter(col => 
              col !== 'LabelCount' && 
              col !== 'id' && 
              col !== 'manualSort' &&
              !col.startsWith('_')
            );
            return availableColumns.map((col, idx) => ({
              name: col,
              columnId: col,
              position: { x: 5, y: 5 + (idx * 15) },
              formatting: {
                fontSize: this.fontSize || 11,
                color: this.fontColor || '#000000',
                align: 'left',
                fontWeight: 'normal'
              }
            }));
          }
          return [];
        }
        return this.columnConfig.map(col => ({
          name: col.name,
          columnId: col.name,
          position: col.position || { x: 5, y: 5 },
          formatting: col.formatting || {
            fontSize: this.fontSize || 11,
            color: this.fontColor || '#000000',
            align: 'left',
            fontWeight: 'normal'
          }
        }));
      },
      getVisibleFields(label) {
        if (!label || !label.fields) return [];
        // Return all fields - filtering happens in the visual editor by positioning
        return label.fields;
      },
      getFieldPosition(field) {
        if (!field.position) return { left: '5%', top: '5%' };
        return {
          left: field.position.x + '%',
          top: field.position.y + '%'
        };
      },
      getFieldEditorStyle(field) {
        if (!field.formatting) {
          return {
            fontSize: this.fontSize + 'pt',
            color: this.fontColor,
            textAlign: this.textAlign
          };
        }
        return {
          fontSize: field.formatting.fontSize + 'pt',
          color: field.formatting.color || this.fontColor,
          textAlign: field.formatting.align || 'left',
          fontWeight: field.formatting.fontWeight || 'normal'
        };
      },
      selectField(field) {
        if (this.dragging) return;
        this.selectedField = field;
      },
      startDrag(event, field) {
        event.preventDefault();
        this.dragging = true;
        this.dragField = field;
        this.dragStartPos = {
          x: event.clientX,
          y: event.clientY
        };
        const labelEl = event.target.closest('.label');
        if (!labelEl) return;
        
        const labelRect = labelEl.getBoundingClientRect();
        
        const onMouseMove = (e) => {
          if (!this.dragging || !this.dragField) return;
          const newX = ((e.clientX - labelRect.left) / labelRect.width) * 100;
          const newY = ((e.clientY - labelRect.top) / labelRect.height) * 100;
          
          // Update position
          this.dragField.position.x = Math.max(0, Math.min(100, newX));
          this.dragField.position.y = Math.max(0, Math.min(100, newY));
          
          // Update columnConfig
          const colConfig = this.columnConfig.find(c => c.name === this.dragField.columnId);
          if (colConfig) {
            colConfig.position = { ...this.dragField.position };
          }
          
          // Update selectedField if it's the same field
          if (this.selectedField && this.selectedField.columnId === this.dragField.columnId) {
            this.selectedField.position = { ...this.dragField.position };
          }
        };
        
        const onMouseUp = () => {
          this.dragging = false;
          this.dragField = null;
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          this.save();
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      },
      saveFieldFormatting() {
        if (!this.selectedField) return;
        // Update columnConfig with field's formatting and position
        const colConfig = this.columnConfig.find(c => c.name === this.selectedField.columnId);
        if (colConfig) {
          colConfig.formatting = { ...this.selectedField.formatting };
          colConfig.position = { ...this.selectedField.position };
        }
        this.save();
        // Update all labels with this field configuration
        if (this.labelData) {
          this.labelData.forEach(label => {
            label.fields.forEach(field => {
              if (field.columnId === this.selectedField.columnId) {
                field.formatting = { ...this.selectedField.formatting };
                field.position = { ...this.selectedField.position };
              }
            });
          });
        }
      }
    },
    updated: () => setTimeout(updateSize, 0),
  });
});

