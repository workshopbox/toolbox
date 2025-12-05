// --- Standard Functional Script ---
document.addEventListener('DOMContentLoaded', () => {
  // 1. Update footer year
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // 2. Animate cards when scrolled into view (Fade-in only)
  const cards = document.querySelectorAll('.card');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        // Add class to trigger CSS fade-in animation
        entry.target.classList.add('is-visible');
        
        // Set a staggered delay via CSS transition-delay
        entry.target.style.transition = `opacity 0.6s ease-out ${index * 100}ms, transform 0.6s ease-out ${index * 100}ms`;
        
        // Stop observing once it's visible
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 }); // Trigger when 10% of the card is visible

  cards.forEach(card => observer.observe(card));

  // -------------------------
  // DSP Depart password protection
  // -------------------------
  const dspCard = document.getElementById('dsp-depart-card');
  const departModal = document.getElementById('depart-modal');
  const departPassInput = document.getElementById('depart-pass');
  const departSubmitBtn = document.getElementById('depart-submit');
  const departError = document.getElementById('depart-error');
  const modalOverlay = document.getElementById('modal-overlay');

  function showDepartModal() {
    if (modalOverlay) modalOverlay.style.display = 'block';
    if (departModal) departModal.style.display = 'block';
  }

  function closeDepartModal() {
    if (departModal) departModal.style.display = 'none';
    if (modalOverlay) modalOverlay.style.display = 'none';
    if (departPassInput) departPassInput.value = '';
    if (departError) departError.style.display = 'none';
  }

  if (dspCard) {
    dspCard.addEventListener('click', function (e) {
      // Prevent the default navigation and show a password prompt instead
      e.preventDefault();
      showDepartModal();
    });
  }

  if (departSubmitBtn && departPassInput) {
    departSubmitBtn.addEventListener('click', function () {
      const entered = departPassInput.value || '';
      // Check against the fixed password; if correct, open the original link in a new tab
      if (entered === '22913322kK!') {
        const dest = dspCard ? dspCard.href : null;
        if (dest) {
          window.open(dest, '_blank');
        }
        closeDepartModal();
      } else {
        if (departError) departError.style.display = 'block';
      }
    });
  }

  // close the depart modal when any element with data-close="depart-modal" is clicked
  document.querySelectorAll('[data-close="depart-modal"]').forEach((btn) => {
    btn.addEventListener('click', function () {
      closeDepartModal();
    });
  });
});