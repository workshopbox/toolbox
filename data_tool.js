// --- START: Firebase Initialization ---

// Import the functions you need from the SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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


// --- STATE MANAGEMENT VARIABLES ---
let currentView = 'weekly'; // Can be 'weekly' or 'lastUpload'
let lastUploadData = null; // Stores the summary of the last uploaded file
let weeklyData = null; // Stores the weekly summary from Firebase


/**
 * Calculates a unique ID for the current week (e.g., "2025-W42").
 * @returns {string} The week ID.
 */
function getWeekId() {
  const now = new Date();
  const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
  const pastDaysOfYear = (now - firstDayOfYear) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

const WEEK_ID = getWeekId();

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
 * Universal function to render any summary data into the table.
 * @param {Object} dataToDisplay - The summary object to render.
 * @param {string} title - The title to display above the table.
 */
function renderTable(dataToDisplay, title) {
  const container = document.getElementById('table-container');
  const summaryTitle = document.getElementById('summary-title');
  container.innerHTML = '';
  summaryTitle.innerHTML = title;

  if (!dataToDisplay || !dataToDisplay.summary || dataToDisplay.summary.length === 0) {
    container.innerHTML = '<p>No data to display.</p>';
    return;
  }

  const { summary, totalPicklists, overallAverageDuration } = dataToDisplay;
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
}

/**
 * Fetches the current week's data from Firebase and updates the UI.
 */
async function loadWeeklyData() {
  const docRef = doc(db, "weeklySummaries", WEEK_ID);
  const downloadBtn = document.getElementById('download-btn');
  const clearBtn = document.getElementById('clear-btn');
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      weeklyData = docSnap.data();
      downloadBtn.disabled = false;
      clearBtn.disabled = false;
    } else {
      weeklyData = null;
      downloadBtn.disabled = true;
      clearBtn.disabled = true;
    }
    renderTable(weeklyData, `This Week's Combined Summary (${WEEK_ID})`);
  } catch (error) {
    console.error("Error loading weekly data:", error);
    alert("Could not load weekly data. Check Firestore rules.");
  }
}

/**
 * Main function to process an uploaded file.
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
    
    // *** FIX #1 STARTS HERE ***
    // This map now accurately stores each picklist and its specific duration.
    const dailySummaryMap = {};
    rows.forEach(row => {
        const assocName = (row[assocCol] || '').trim();
        const picklistCode = (row[picklistCol] || '').toString().trim();
        if (!assocName || !picklistCode) return;
        if (!dailySummaryMap[assocName]) {
            dailySummaryMap[assocName] = { picklists: new Map() };
        }
        if (!dailySummaryMap[assocName].picklists.has(picklistCode)) {
            dailySummaryMap[assocName].picklists.set(picklistCode, parseDuration(row[durationCol]));
        }
    });

    let dailyTotalPicks = 0, dailyTotalSeconds = 0;
    const dailySummaryArray = Object.entries(dailySummaryMap).map(([name, data]) => {
        const pickCount = data.picklists.size;
        const totalDuration = Array.from(data.picklists.values()).reduce((sum, sec) => sum + sec, 0);
        dailyTotalPicks += pickCount;
        dailyTotalSeconds += totalDuration;
        return {
            'Associate': name,
            'Number of Picklists': pickCount,
            'Average Duration': formatDuration(pickCount > 0 ? totalDuration / pickCount : 0),
        };
    });
    // *** FIX #1 ENDS HERE ***

    lastUploadData = {
        summary: dailySummaryArray,
        totalPicklists: dailyTotalPicks,
        overallAverageDuration: formatDuration(dailyTotalPicks > 0 ? dailyTotalSeconds / dailyTotalPicks : 0)
    };
    
    renderTable(lastUploadData, `Summary for: ${file.name}`);
    currentView = 'lastUpload';
    updateToggleBtn();

    const docRef = doc(db, "weeklySummaries", WEEK_ID);
    const docSnap = await getDoc(docRef);
    const existingData = docSnap.data()?.associates ?? {};

    Object.entries(dailySummaryMap).forEach(([name, data]) => {
        if (!existingData[name]) {
            existingData[name] = { totalDuration: 0, picklists: [] };
        }
        // Accurately add durations for new picklists
        data.picklists.forEach((duration, picklistCode) => {
            if (!existingData[name].picklists.includes(picklistCode)) {
                existingData[name].picklists.push(picklistCode);
                existingData[name].totalDuration += duration;
            }
        });
    });

    let weeklyTotalPicks = 0, weeklyTotalSeconds = 0;
    const weeklySummaryArray = Object.entries(existingData).map(([name, data]) => {
        weeklyTotalPicks += data.picklists.length;
        weeklyTotalSeconds += data.totalDuration;
        return {
            'Associate': name,
            'Number of Picklists': data.picklists.length,
            'Average Duration': formatDuration(data.picklists.length > 0 ? data.totalDuration / data.picklists.length : 0),
        };
    });
    
    const finalWeeklyReport = {
        updatedAt: serverTimestamp(),
        totalPicklists: weeklyTotalPicks,
        overallAverageDuration: formatDuration(weeklyTotalPicks > 0 ? weeklyTotalSeconds / weeklyTotalPicks : 0),
        summary: weeklySummaryArray,
        associates: existingData
    };
    
    await setDoc(docRef, finalWeeklyReport);
    console.log(`Weekly data for ${WEEK_ID} updated successfully.`);
    
    // *** FIX #2 ***
    // Silently update our local copy of the weekly data without re-rendering the table
    weeklyData = finalWeeklyReport;
    document.getElementById('download-btn').disabled = false;
    document.getElementById('clear-btn').disabled = false;

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
 * Toggles the view between the last upload and the weekly summary.
 */
function toggleView() {
    if (currentView === 'lastUpload') {
        renderTable(weeklyData, `This Week's Combined Summary (${WEEK_ID})`);
        currentView = 'weekly';
    } else {
        renderTable(lastUploadData, `Summary for Last Upload`);
        currentView = 'lastUpload';
    }
    updateToggleBtn();
}

/**
 * Updates the text and icon of the toggle button based on the current view.
 */
function updateToggleBtn() {
    const toggleBtn = document.getElementById('toggle-view-btn');
    const icon = toggleBtn.querySelector('i');
    const text = toggleBtn.querySelector('span');
    toggleBtn.disabled = !lastUploadData;

    if (currentView === 'weekly') {
        icon.className = 'fa-solid fa-file-arrow-down';
        text.textContent = 'View Last Upload';
    } else {
        icon.className = 'fa-solid fa-calendar-week';
        text.textContent = 'View Weekly Summary';
    }
}

/**
 * Deletes the current week's data from Firebase after confirmation.
 */
async function clearWeeklyData() {
    if (confirm("Are you sure you want to delete all data for this week? This action cannot be undone.")) {
        await deleteDoc(doc(db, "weeklySummaries", WEEK_ID));
        alert("This week's data has been cleared.");
        lastUploadData = null;
        await loadWeeklyData();
        updateToggleBtn();
    }
}

/**
 * Triggers a download of the WEEKLY summary as an Excel file.
 */
async function downloadWeeklySummary() {
    if (!weeklyData) {
        alert("No weekly data available to download.");
        return;
    }
    const { summary, totalPicklists, overallAverageDuration } = weeklyData;
    const dataForExcel = [...summary];
    dataForExcel.push({
      'Associate': 'TOTAL',
      'Number of Picklists': totalPicklists,
      'Average Duration': overallAverageDuration,
    });
    
    const ws = XLSX.utils.json_to_sheet(dataForExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Week ${WEEK_ID} Summary`);
    XLSX.writeFile(wb, `weekly_summary_${WEEK_ID}.xlsx`);
}

// --- Main Execution ---
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  document.getElementById('week-id-display').textContent = WEEK_ID;
  
  // Event Listeners
  document.getElementById('file-input').addEventListener('change', handleFileUpload);
  document.getElementById('clear-btn').addEventListener('click', clearWeeklyData);
  document.getElementById('download-btn').addEventListener('click', downloadWeeklySummary);
  document.getElementById('toggle-view-btn').addEventListener('click', toggleView);

  // Initial data load
  loadWeeklyData();
});