document.addEventListener('DOMContentLoaded', () => {
  const sections = document.querySelectorAll('.docs-section[id]');
  const navLinks = document.querySelectorAll('.docs-sidebar a[href^="#"]');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          navLinks.forEach((link) => link.classList.remove('active'));
          const activeLink = document.querySelector(
            `.docs-sidebar a[href="#${entry.target.id}"]`
          );
          if (activeLink) activeLink.classList.add('active');
        }
      });
    },
    { threshold: 0.15, rootMargin: '-80px 0px -60% 0px' }
  );

  sections.forEach((section) => observer.observe(section));

  // Mobile sidebar toggle
  const sidebarToggle = document.getElementById('docs-sidebar-toggle');
  const sidebar = document.getElementById('docs-sidebar');
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    // Close sidebar when a link is clicked on mobile
    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('open');
        }
      });
    });
  }
});
