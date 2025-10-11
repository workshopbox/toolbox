// data_tool.js
// Handles file upload, parsing, summarizing, displaying, and exporting

/**
 * Convert a HH:MM:SS duration string into total seconds.
 * Returns 0 for invalid or empty strings.
 * @param {string} str
 */
function parseDuration(str) {
  if (!str || typeof str !== 'string') return 0;
  const parts = str.trim().split(':');
  if (parts.length !== 3) return 0;
  const [h, m, s] = parts.map((v) => parseInt(v, 10));
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
}

/**
 * Convert total seconds back into HH:MM:SS format.
 * @param {number} seconds
 */
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * Handle file selection event: read the file and process the data.
 */
function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (evt) {
    const data = evt.target.result;
    let workbook;
    try {
      // Try to read as binary string for broad format support
      workbook = XLSX.read(data, { type: 'binary' });
    } catch (err) {
      console.error('Error reading file', err);
      alert('Unable to read the file. Please ensure it is a valid CSV or Excel file.');
      return;
    }
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    // Convert to JSON; defval '' ensures empty cells are empty strings
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!rows || rows.length === 0) {
      alert('The file appears to be empty.');
      return;
    }
    // Determine the relevant column names by case-insensitive match
    const headerRow = Object.keys(rows[0]);
    let assocCol = null;
    let durationCol = null;
    let picklistCol = null;
    headerRow.forEach((col) => {
      const clean = col.trim().toLowerCase();
      if (!assocCol && clean.includes('associate')) assocCol = col;
      if (!durationCol && clean.includes('duration')) durationCol = col;
      if (!picklistCol && clean.includes('picklist') && clean.includes('code')) picklistCol = col;
    });
    if (!assocCol || !durationCol) {
      alert('The uploaded file does not contain the required columns (Associate and Duration).');
      return;
    }
    // Aggregate data
    const summary = {};
    rows.forEach((row) => {
      const assocField = row[assocCol] || '';
      const durationStr = row[durationCol] || '';
      const durationSeconds = parseDuration(durationStr);
      // Split associates by comma and slash; remove whitespace
      const names = assocField.split(',').map((n) => n.trim()).filter((n) => n);
      names.forEach((name) => {
        if (!summary[name]) summary[name] = { count: 0, sum: 0 };
        summary[name].count += 1;
        summary[name].sum += durationSeconds;
      });
    });
    // Convert summary object into an array and compute averages
    const resultData = Object.entries(summary).map(([name, info]) => {
      const avgSec = info.sum / info.count || 0;
      return {
        Associate: name,
        'Number of Picklists': info.count,
        'Average Duration': formatDuration(avgSec),
      };
    });
    // Sort by number of picklists descending
    resultData.sort((a, b) => b['Number of Picklists'] - a['Number of Picklists']);
    // Render table
    renderTable(resultData);
    // Enable download button
    const downloadBtn = document.getElementById('download-btn');
    downloadBtn.disabled = false;
    downloadBtn.onclick = function () {
      downloadExcel(resultData);
    };
  };
  // Read file as binary string to support both CSV and XLSX
  reader.readAsBinaryString(file);
}

/**
 * Render result data into a table in the DOM.
 * @param {Array<Object>} data
 */
function renderTable(data) {
  const resultsSection = document.getElementById('results-section');
  const container = document.getElementById('table-container');
  // Clear previous results
  container.innerHTML = '';
  if (!data || data.length === 0) {
    container.innerHTML = '<p>No data to display.</p>';
    resultsSection.style.display = 'block';
    return;
  }
  const table = document.createElement('table');
  table.classList.add('results-table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  Object.keys(data[0]).forEach((key) => {
    const th = document.createElement('th');
    th.textContent = key;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  data.forEach((row) => {
    const tr = document.createElement('tr');
    Object.values(row).forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
  resultsSection.style.display = 'block';
}

/**
 * Create an Excel file from result data and trigger download.
 * @param {Array<Object>} data
 */
function downloadExcel(data) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  // Apply header names explicitly to preserve ordering
  const header = Object.keys(data[0]);
  XLSX.utils.sheet_add_aoa(ws, [header], { origin: 'A1' });
  // Adjust column widths based on header length and data
  const colWidths = header.map((col) => {
    const maxLen = Math.max(
      col.length,
      ...data.map((row) => String(row[col]).length)
    );
    return { wch: maxLen + 2 };
  });
  ws['!cols'] = colWidths;
  XLSX.writeFile(wb, 'picklist_summary.xlsx');
}

// Attach event listener to file input on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('file-input');
  fileInput.addEventListener('change', handleFile);
});