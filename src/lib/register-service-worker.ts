const base = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/`;

function register() {
  if (!window.isSecureContext || !('serviceWorker' in navigator)) return;
  void navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
    // Installation is optional. A failed registration must not interrupt reading.
  });
}

if (document.readyState === 'complete') register();
else window.addEventListener('load', register, { once: true });
