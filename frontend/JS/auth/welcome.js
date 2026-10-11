"use strict";

// Update the footer year automatically
const yearNode = document.getElementById("currentYear");

if (yearNode) {
  yearNode.textContent = String(new Date().getFullYear());
}

// Mobile navigation elements
const menuToggle = document.getElementById("menuToggle");
const siteNav = document.getElementById("siteNav");

// Mobile menu toggle
if (menuToggle && siteNav) {
  const closeMenu = () => {
    siteNav.classList.remove("open");

    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
  };

  menuToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("open");

    menuToggle.setAttribute("aria-expanded", String(isOpen));

    menuToggle.setAttribute(
      "aria-label",
      isOpen ? "Close navigation" : "Open navigation",
    );
  });

  // Smooth scrolling for About, How It Works and Contact
  siteNav.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));

      if (target) {
        event.preventDefault();

        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;

        target.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start",
        });

        history.replaceState(null, "", link.getAttribute("href"));
      }

      // Close the menu after selecting a section
      closeMenu();
    });
  });

  // Close the mobile menu when Escape is pressed
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });
}
