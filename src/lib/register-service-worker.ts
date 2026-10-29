const base = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/`;

async function register() {
  if (!window.isSecureContext || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base, updateViaCache: 'none' });
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    const activateWaiting = () => {
      if (navigator.serviceWorker.controller && registration.waiting) {
        registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
      }
    };
    registration.addEventListener('updatefound', () => {
      registration.installing?.addEventListener('statechange', activateWaiting);
    });
    activateWaiting();
    await registration.update();
    activateWaiting();
  } catch {
    // Installation is optional. A failed registration must not interrupt reading.
  }
}

if (document.readyState === 'complete') register();
else window.addEventListener('load', register, { once: true });
