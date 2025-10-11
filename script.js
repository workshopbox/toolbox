document.addEventListener('DOMContentLoaded', () => {
  // --- 1. Set the current year in the footer ---
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // --- 2. Animate cards on scroll-in ---
  const cards = document.querySelectorAll('.card');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        // Add a delay based on the card's position for a staggered effect
        entry.target.style.transition = `opacity 0.6s ease-out ${index * 100}ms, transform 0.6s ease-out ${index * 100}ms`;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target); // Stop observing once it's visible
      }
    });
  }, {
    threshold: 0.1 // Trigger when 10% of the card is visible
  });

  cards.forEach(card => {
    observer.observe(card);
  });

  // --- 3. Add 3D tilt effect to cards ---
  cards.forEach(card => {
    const maxTilt = 15; // Max tilt in degrees

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left; // Mouse x position within the card
      const y = e.clientY - rect.top;  // Mouse y position within the card

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Calculate tilt values
      const tiltX = ((y - centerY) / centerY) * -maxTilt;
      const tiltY = ((x - centerX) / centerX) * maxTilt;

      card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.05, 1.05, 1.05)`;
      card.style.transition = 'transform 0.1s linear'; // Make it responsive to mouse
    });

    card.addEventListener('mouseleave', () => {
      // Reset transform when mouse leaves, adding a smooth transition back
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
      card.style.transition = 'transform 0.5s ease';
    });
  });
});