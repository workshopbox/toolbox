// --- START: Firebase Initialization ---

// Import the functions you need from the SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD7oizYIjwloZLZxxjmF9kGepnW_ijqYjg",
  authDomain: "project-tool-4c6af.firebaseapp.com",
  projectId: "project-tool-4c6af",
  storageBucket: "project-tool-4c6af.appspot.com",
  messagingSenderId: "491986260841",
  appId: "1:491986260841:web:f69d01be865a43d00663f8"
};

// Initialize Firebase and get a reference to the Firestore service
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- END: Firebase Initialization ---


// --- STATE MANAGEMENT ---
let selectedDate = new Date(); // Store as a Date object
let calendarInstance = null;


/**
 * Formats a Date object into a YYYY-MM-DD string for use as a Firestore document ID.
 * @param {Date} date - The date to format.
 * @returns {string} The formatted date string.
 */
function formatDateForId(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a duration string (HH:MM:SS) into total seconds.
 */
function parseDuration(str) {
  if (!str || typeof str !== 'string') return 0;
  const parts = str.trim().split(':');
  if (parts.length !== 3) return 0;
  const [h, m, s] = parts.map((v) => parseInt(v, 10) || 0);
  return h * 3600 + m * 60 + s;
}

/**
 * Formats total seconds into a duration string (HH:MM:SS).
 */
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * Renders the summary data into the table in the DOM.
 * @param {Object} dailyData - The summary data for a given day.
 */
function renderTable(dailyData) {
  const container = document.getElementById('table-container');
  const summaryTitle = document.getElementById('summary-title');
  const downloadBtn = document.getElementById('download-day-btn');
  const clearBtn = document.getElementById('clear-btn');
  container.innerHTML = '';

  const selectedDateId = formatDateForId(selectedDate);
  const todayId = formatDateForId(new Date());
  summaryTitle.textContent = selectedDateId === todayId ? `Summary for Today (${selectedDateId})` : `Summary for ${selectedDateId}`;

  if (!dailyData || !dailyData.summary || dailyData.summary.length === 0) {
    container.innerHTML = '<p>No data uploaded for this day yet.</p>';
    downloadBtn.disabled = true;
    clearBtn.disabled = true;
    return;
  }

  const { summary, totalPicklists, overallAverageDuration } = dailyData;
  summary.sort((a, b) => b['Number of Picklists'] - a['Number of Picklists']);

  const table = document.createElement('table');
  table.className = 'results-table';
  
  const thead = table.createTHead();
  const headerRow = thead.insertRow();
  const headers = Object.keys(summary[0]);
  headers.forEach(key => {
    headerRow.insertCell().textContent = key;
  });

  const tbody = table.createTBody();
  summary.forEach(row => {
    const tr = tbody.insertRow();
    headers.forEach(header => {
      tr.insertCell().textContent = row[header];
    });
  });

  const tfoot = table.createTFoot();
  const footerRow = tfoot.insertRow();
  footerRow.style.fontWeight = 'bold';
  footerRow.insertCell().textContent = 'Total';
  footerRow.insertCell().textContent = totalPicklists;
  footerRow.insertCell().textContent = overallAverageDuration;
  
  container.appendChild(table);
  downloadBtn.disabled = false;
  clearBtn.disabled = false;
}

/**
 * Fetches data for the currently selected date from Firebase and displays it.
 */
async function loadDailyData() {
  const dateId = formatDateForId(selectedDate);
  const docRef = doc(db, "dailySummaries", dateId);
  try {
    const docSnap = await getDoc(docRef);
    renderTable(docSnap.exists() ? docSnap.data() : null);
  } catch (error) {
    console.error("Error loading data:", error);
    alert("Could not load data from the database. Check Firestore rules.");
  }
}

/**
 * Processes an uploaded file, merges its data with the selected day's data, and saves it.
 */
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const fileInput = event.target;
  const fileNameDisplay = document.getElementById('file-name-display');
  const uploadLabel = document.querySelector('.file-upload-label span');
  fileNameDisplay.textContent = `Processing: ${file.name}`;
  uploadLabel.textContent = 'Processing...';
  fileInput.disabled = true;

  try {
    const fileData = await file.arrayBuffer();
    const workbook = XLSX.read(fileData);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) throw new Error("The file is empty.");
    
    const headerRow = Object.keys(rows[0]);
    const assocCol = headerRow.find(h => h.trim().toLowerCase().includes('associate'));
    const durationCol = headerRow.find(h => h.trim().toLowerCase().includes('duration'));
    const picklistCol = headerRow.find(h => h.trim().toLowerCase().includes('picklist') && h.trim().toLowerCase().includes('code'));

    if (!assocCol || !durationCol || !picklistCol) {
      throw new Error("File must contain 'Associate', 'Duration', and 'Picklist Code' columns.");
    }
    
    const newFileData = {};
    rows.forEach(row => {
        const assocName = (row[assocCol] || '').trim();
        const picklistCode = (row[picklistCol] || '').toString().trim();
        if (!assocName || !picklistCode) return;
        if (!newFileData[assocName]) {
            newFileData[assocName] = { picklists: new Map() };
        }
        if (!newFileData[assocName].picklists.has(picklistCode)) {
            newFileData[assocName].picklists.set(picklistCode, parseDuration(row[durationCol]));
        }
    });

    const dateId = formatDateForId(selectedDate);
    const docRef = doc(db, "dailySummaries", dateId);
    const docSnap = await getDoc(docRef);
    const existingData = docSnap.data()?.associates ?? {};

    Object.entries(newFileData).forEach(([name, data]) => {
        if (!existingData[name]) {
            existingData[name] = { totalDuration: 0, picklists: [] };
        }
        data.picklists.forEach((duration, picklistCode) => {
            if (!existingData[name].picklists.includes(picklistCode)) {
                existingData[name].picklists.push(picklistCode);
                existingData[name].totalDuration += duration;
            }
        });
    });

    let totalPicklists = 0, totalSeconds = 0;
    const summaryArray = Object.entries(existingData).map(([name, data]) => {
        totalPicklists += data.picklists.length;
        totalSeconds += data.totalDuration;
        return {
            'Associate': name,
            'Number of Picklists': data.picklists.length,
            'Average Duration': formatDuration(data.picklists.length > 0 ? data.totalDuration / data.picklists.length : 0),
        };
    });
    
    const finalDailyReport = {
        updatedAt: serverTimestamp(),
        totalPicklists: totalPicklists,
        overallAverageDuration: formatDuration(totalPicklists > 0 ? totalSeconds / totalPicklists : 0),
        summary: summaryArray,
        associates: existingData
    };
    
    await setDoc(docRef, finalDailyReport);
    alert(`Successfully added data from ${file.name} to the summary for ${dateId}!`);
    
    await loadDailyData();

  } catch (error) {
    console.error("File processing error:", error);
    alert(`Error: ${error.message}`);
  } finally {
    fileInput.value = '';
    fileNameDisplay.textContent = 'No file selected';
    uploadLabel.textContent = 'Choose File to Add';
    fileInput.disabled = false;
  }
}

/**
 * Deletes the selected day's data from Firebase after confirmation.
 */
async function clearDailyData() {
    const dateId = formatDateForId(selectedDate);
    if (confirm(`Are you sure you want to delete all data for ${dateId}? This cannot be undone.`)) {
        await deleteDoc(doc(db, "dailySummaries", dateId));
        alert(`Data for ${dateId} has been cleared.`);
        await loadDailyData();
    }
}

/**
 * Downloads the summary for the currently displayed day.
 */
async function downloadDailySummary() {
    const dateId = formatDateForId(selectedDate);
    const docRef = doc(db, "dailySummaries", dateId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        alert(`No data available for ${dateId} to download.`);
        return;
    }

    generateExcel(docSnap.data(), `summary_${dateId}`);
}

/**
 * --- NEW FUNCTION ---
 * Fetches and downloads a combined summary for a given date range (week or month).
 * @param {'week' | 'month'} range - The period to download.
 */
async function downloadRangeSummary(range) {
    // 1. Determine the start and end dates for the query
    const today = selectedDate;
    let startDate, endDate;
    let fileName = '';

    if (range === 'week') {
        const dayOfWeek = today.getDay(); // Sunday = 0, Monday = 1, etc.
        startDate = new Date(today);
        startDate.setDate(today.getDate() - dayOfWeek); // Go to the start of the week (Sunday)
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // Go to the end of the week (Saturday)
        fileName = `weekly_summary_${formatDateForId(startDate)}_to_${formatDateForId(endDate)}`;
    } else { // month
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        fileName = `monthly_summary_${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    }

    const startDateId = formatDateForId(startDate);
    const endDateId = formatDateForId(endDate);
    
    alert(`Fetching data for range: ${startDateId} to ${endDateId}`);

    // 2. Query Firestore for all documents within that date range
    const summariesRef = collection(db, "dailySummaries");
    const q = query(summariesRef, where('__name__', '>=', startDateId), where('__name__', '<=', endDateId));
    
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        alert(`No data found for the selected ${range}.`);
        return;
    }

    // 3. Merge all the fetched documents into a single summary
    const combinedData = {};
    querySnapshot.forEach(doc => {
        const dayData = doc.data().associates;
        Object.entries(dayData).forEach(([name, data]) => {
            if (!combinedData[name]) {
                combinedData[name] = { totalDuration: 0, picklists: [] };
            }
            // Add only new, unique picklists and their durations
            data.picklists.forEach((picklistCode, index) => {
                if (!combinedData[name].picklists.includes(picklistCode)) {
                    combinedData[name].picklists.push(picklistCode);
                    // This relies on the structure `totalDuration` being accurate in the daily doc
                    const durationPerPick = data.totalDuration / data.picklists.length;
                    combinedData[name].totalDuration += durationPerPick;
                }
            });
        });
    });

    // 4. Calculate final totals and format for Excel
    let totalPicklists = 0, totalSeconds = 0;
    const summaryArray = Object.entries(combinedData).map(([name, data]) => {
        totalPicklists += data.picklists.length;
        totalSeconds += data.totalDuration;
        return {
            'Associate': name,
            'Number of Picklists': data.picklists.length,
            'Average Duration': formatDuration(data.picklists.length > 0 ? data.totalDuration / data.picklists.length : 0),
        };
    });

    const finalReport = {
        summary: summaryArray,
        totalPicklists: totalPicklists,
        overallAverageDuration: formatDuration(totalPicklists > 0 ? totalSeconds / totalPicklists : 0),
    };

    // 5. Generate and download the Excel file
    generateExcel(finalReport, fileName);
}


/**
 * --- NEW HELPER FUNCTION ---
 * Generates an Excel file from a summary object and triggers download.
 * @param {Object} reportData - The data object containing a summary array and totals.
 * @param {string} fileName - The desired name for the output file.
 */
function generateExcel(reportData, fileName) {
    const { summary, totalPicklists, overallAverageDuration } = reportData;
    summary.sort((a, b) => b['Number of Picklists'] - a['Number of Picklists']);

    const dataForExcel = [...summary];
    dataForExcel.push({
      'Associate': 'TOTAL',
      'Number of Picklists': totalPicklists,
      'Average Duration': overallAverageDuration,
    });
    
    const ws = XLSX.utils.json_to_sheet(dataForExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Summary`);
    XLSX.writeFile(wb, `${fileName}.xlsx`);
}


// --- Main Execution ---
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  
  calendarInstance = flatpickr("#date-picker", {
    defaultDate: "today",
    dateFormat: "Y-m-d",
    onChange: function(selectedDates, dateStr, instance) {
      selectedDate = selectedDates[0];
      loadDailyData();
    },
  });

  document.getElementById('file-input').addEventListener('change', handleFileUpload);
  document.getElementById('clear-btn').addEventListener('click', clearDailyData);
  document.getElementById('download-day-btn').addEventListener('click', downloadDailySummary);
  document.getElementById('download-week-btn').addEventListener('click', () => downloadRangeSummary('week'));
  document.getElementById('download-month-btn').addEventListener('click', () => downloadRangeSummary('month'));

  loadDailyData();
});