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
      workbook = XLSX.read(data, { type: 'binary' });
    } catch (err) {
      console.error('Error reading file', err);
      alert('Unable to read the file. Please ensure it is a valid CSV or Excel file.');
      return;
    }
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!rows || rows.length === 0) {
      alert('The file appears to be empty.');
      return;
    }

    // --- MODIFIED LOGIC: Find all required columns ---
    const headerRow = Object.keys(rows[0]);
    let assocCol = null;
    let durationCol = null;
    let picklistCol = null;
    headerRow.forEach((col) => {
      const clean = col.trim().toLowerCase();
      if (!assocCol && clean.includes('associate')) assocCol = col;
      if (!durationCol && clean.includes('duration')) durationCol = col;
      // Find the picklist code column, which is the key to uniqueness
      if (!picklistCol && clean.includes('picklist') && clean.includes('code')) picklistCol = col;
    });

    if (!assocCol || !durationCol || !picklistCol) {
      alert('The uploaded file does not contain the required columns (Associate, Duration, and Picklist Code).');
      return;
    }

    // --- REWRITTEN LOGIC: Aggregate data by unique picklist ---
    const summary = {};
    rows.forEach((row) => {
      const assocName = (row[assocCol] || '').trim();
      const picklistCode = row[picklistCol] || '';
      const durationStr = row[durationCol] || '';

      // Ignore rows with no associate name or picklist code
      if (!assocName || !picklistCode) {
        return;
      }

      // Initialize associate if they are not in the summary yet
      if (!summary[assocName]) {
        summary[assocName] = {
          picklists: new Set(), // Use a Set to store unique picklist codes
          totalDuration: 0,
        };
      }

      // If this picklist has NOT been counted for this user yet, add it
      if (!summary[assocName].picklists.has(picklistCode)) {
        summary[assocName].picklists.add(picklistCode);
        summary[assocName].totalDuration += parseDuration(durationStr);
      }
    });

    // --- MODIFIED LOGIC: Convert summary into a displayable array ---
    const resultData = Object.entries(summary).map(([name, info]) => {
      const pickCount = info.picklists.size;
      const avgSec = pickCount > 0 ? info.totalDuration / pickCount : 0;
      return {
        Associate: name,
        'Number of Picklists': pickCount,
        'Average Duration': formatDuration(avgSec),
      };
    });

    // Sort by number of picklists descending
    resultData.sort((a, b) => b['Number of Picklists'] - a['Number of Picklists']);

    // Calculate totals
    let totalPicks = 0;
    let totalSeconds = 0;
    resultData.forEach(item => {
        totalPicks += item['Number of Picklists'];
        // We need to get the original total duration back for an accurate overall average
        const originalInfo = summary[item.Associate];
        if(originalInfo) {
            totalSeconds += originalInfo.totalDuration;
        }
    });
    const overallAvgSec = totalPicks > 0 ? totalSeconds / totalPicks : 0;
    const overallAvgFormatted = formatDuration(overallAvgSec);

    // Render table
    renderTable(resultData, totalPicks, overallAvgFormatted);

    // Prepare data for Excel download
    const dataForExcel = [...resultData];
    dataForExcel.push({
      'Associate': 'TOTAL',
      'Number of Picklists': totalPicks,
      'Average Duration': overallAvgFormatted,
    });
    
    // Enable download button
    const downloadBtn = document.getElementById('download-btn');
    downloadBtn.disabled = false;
    downloadBtn.onclick = function () {
      downloadExcel(dataForExcel);
    };
  };
  reader.readAsBinaryString(file);
}

/**
 * Render result data into a table in the DOM.
 * @param {Array<Object>} data The main result data.
 * @param {number} totalPicks The calculated total pick count.
 * @param {string} overallAvg The formatted overall average duration.
 */
function renderTable(data, totalPicks, overallAvg) {
  const resultsSection = document.getElementById('results-section');
  const container = document.getElementById('table-container');
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

  const tfoot = document.createElement('tfoot');
  const footerRow = document.createElement('tr');
  footerRow.style.fontWeight = 'bold';

  const totalCellLabel = document.createElement('td');
  totalCellLabel.textContent = 'Total';
  const totalCellPicks = document.createElement('td');
  totalCellPicks.textContent = totalPicks;
  const totalCellAvg = document.createElement('td');
  totalCellAvg.textContent = overallAvg;

  footerRow.appendChild(totalCellLabel);
  footerRow.appendChild(totalCellPicks);
  footerRow.appendChild(totalCellAvg);
  tfoot.appendChild(footerRow);
  table.appendChild(tfoot);

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
  const header = Object.keys(data[0]);
  XLSX.utils.sheet_add_aoa(ws, [header], { origin: 'A1' });
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