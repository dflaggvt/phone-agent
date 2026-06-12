import "./styles.css";

const header = document.querySelector(".site-header");

function updateHeaderState() {
  if (!header) return;
  header.toggleAttribute("data-scrolled", window.scrollY > 12);
}

function scrollToHashTarget() {
  const hash = window.location.hash.slice(1);
  if (!hash) return;
  const target = document.getElementById(hash);
  if (!target) return;
  const scrollToTarget = () => {
    const headerHeight = header?.getBoundingClientRect().height ?? 0;
    const top = target.getBoundingClientRect().top + window.scrollY - headerHeight;
    window.scrollTo({ top: Math.max(0, top) });
  };
  window.requestAnimationFrame(scrollToTarget);
  window.setTimeout(scrollToTarget, 120);
}

updateHeaderState();
window.addEventListener("scroll", updateHeaderState, { passive: true });
window.addEventListener("load", scrollToHashTarget);
window.addEventListener("hashchange", scrollToHashTarget);
scrollToHashTarget();
