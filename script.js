// script.js
// Small script to enhance the Projects Collection site
// Currently used to set the current year in the footer and
// provide a placeholder for dynamic behavior if needed in the future.

document.addEventListener('DOMContentLoaded', () => {
  // Set the year in the footer
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    const currentYear = new Date().getFullYear();
    yearSpan.textContent = currentYear;
  }
});