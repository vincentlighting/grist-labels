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
  rowIndices: []
};

// Columns we expect - now supports multiple fields
const LabelCount = 'LabelCount';

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
  target.status = String(err).replace(/^Error: /, '');
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
  try {
    data.status = '';
    const rows = data.rows;
    if (!rows || !rows.length) {
      throw new Error("No data. Please add some rows");
    }
    
    // Get all columns except LabelCount and id
    // The mapped rows will have column names as keys
    const allColumns = Object.keys(rows[0]);
    const labelColumns = allColumns.filter(col => 
      col !== LabelCount && 
      col !== 'id' && 
      col !== 'manualSort' &&
      !col.startsWith('_')
    );
    
    if (labelColumns.length === 0) {
      throw new Error(`Please select columns to display in the Creator Panel. Click the widget settings and choose which columns to include.`);
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
          
          return {
            name: colName,
            value: value,
            type: fieldType,
            columnId: colName,
            rowId: r.id
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
  } catch (err) {
    handleError(err);
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
    }
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
      }
    },
    updated: () => setTimeout(updateSize, 0),
  });
});

