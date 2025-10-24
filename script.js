// --- Original Functional Script with Halloween Enhancements ---
document.addEventListener('DOMContentLoaded', () => {
  // 1. Update footer year
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // 2. Animate cards when scrolled into view
  const cards = document.querySelectorAll('.card');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        entry.target.style.transition = `opacity 0.8s ease-out ${index * 100}ms, transform 0.8s ease-out ${index * 100}ms`;
        // Add glowing shimmer effect
        entry.target.animate([
          { boxShadow: '0 0 0px rgba(255,145,0,0)' },
          { boxShadow: '0 0 20px rgba(255,145,0,0.7)' },
          { boxShadow: '0 0 0px rgba(255,145,0,0)' }
        ], { duration: 2000, easing: 'ease-in-out' });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  cards.forEach(card => observer.observe(card));

  // 3. 3D tilt effect
  cards.forEach(card => {
    const maxTilt = 15;
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rotateY = ((x / rect.width) - 0.5) * (maxTilt * 2);
      const rotateX = ((y / rect.height) - 0.5) * -(maxTilt * 2);
      card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'rotateX(0) rotateY(0)';
    });
  });

  // 4. Subtle Halloween hover pulse
  cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.animate([
        { boxShadow: '0 0 0 rgba(255,145,0,0)' },
        { boxShadow: '0 0 25px rgba(255,145,0,0.5)' },
        { boxShadow: '0 0 0 rgba(255,145,0,0)' }
      ], { duration: 1500, iterations: 1 });
    });
  });
});
