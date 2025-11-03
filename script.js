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
});