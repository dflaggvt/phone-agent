import "./styles.css";

const header = document.querySelector(".site-header");

function updateHeaderState() {
  if (!header) return;
  header.toggleAttribute("data-scrolled", window.scrollY > 12);
}

updateHeaderState();
window.addEventListener("scroll", updateHeaderState, { passive: true });
