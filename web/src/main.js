import "./styles.css";

const header = document.querySelector(".site-header");
const betaForm = document.querySelector("[data-beta-form]");
const betaStatus = document.querySelector("[data-beta-status]");

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

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
  window.setTimeout(scrollToTarget, 350);
}

updateHeaderState();
window.addEventListener("scroll", updateHeaderState, { passive: true });
window.addEventListener("load", scrollToHashTarget);
window.addEventListener("pageshow", scrollToHashTarget);
window.addEventListener("hashchange", scrollToHashTarget);
scrollToHashTarget();

if (betaForm instanceof HTMLFormElement) {
  betaForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitBetaSignup(betaForm);
  });
}

async function submitBetaSignup(form) {
  const submitButton = form.querySelector("button[type='submit']");
  const formData = new FormData(form);
  setBetaStatus("submitting", "Submitting...");
  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const response = await fetch(`${apiBaseUrl()}/v1/public/beta-signups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: String(formData.get("email") ?? ""),
        platform: String(formData.get("platform") ?? ""),
        consent: formData.get("consent") === "on"
      })
    });

    if (!response.ok) {
      throw new Error("signup_failed");
    }

    form.reset();
    setBetaStatus("success", "Thanks. You're on the waitlist. We'll email you when there's a testing spot for your phone.");
  } catch {
    setBetaStatus("error", "Something went wrong. Please try again or email support@callheld.com.");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

function apiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return import.meta.env.DEV ? "http://127.0.0.1:3000" : "";
}

function setBetaStatus(state, message) {
  if (!betaStatus) return;
  betaStatus.dataset.state = state;
  betaStatus.textContent = message;
}
