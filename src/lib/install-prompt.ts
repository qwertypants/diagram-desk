interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<unknown>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

const dismissalKey = 'diagram-desk:install-dismissed-until';
const dismissalDuration = 30 * 24 * 60 * 60 * 1000;

export function initializeInstallPrompt(root: HTMLElement) {
  const install = root.querySelector<HTMLButtonElement>('[data-install-native]');
  const ios = root.querySelector<HTMLDetailsElement>('[data-install-ios]');
  const dismiss = root.querySelector<HTMLButtonElement>('[data-install-dismiss]');
  if (!install || !ios || !dismiss) return;

  const standalone = window.matchMedia('(display-mode: standalone)');
  const isStandalone = () => standalone.matches || ('standalone' in navigator && navigator.standalone === true);
  let dismissed = false;
  try { dismissed = Number(localStorage.getItem(dismissalKey)) > Date.now(); } catch { /* Storage can be unavailable in private browsing. */ }
  let candidate: BeforeInstallPromptEvent | null = null;

  const hide = () => {
    if (root.contains(document.activeElement)) document.querySelector<HTMLAnchorElement>('.brand')?.focus({ preventScroll: true });
    root.hidden = true;
    ios.open = false;
  };
  const rememberDismissal = () => {
    dismissed = true;
    try { localStorage.setItem(dismissalKey, String(Date.now() + dismissalDuration)); } catch { /* Keep dismissal for this page when storage is unavailable. */ }
    hide();
  };
  const show = (mode: 'native' | 'ios') => {
    if (isStandalone() || dismissed) return;
    install.hidden = mode !== 'native';
    ios.hidden = mode !== 'ios';
    root.hidden = false;
  };

  window.addEventListener('beforeinstallprompt', event => {
    if (isStandalone() || dismissed) return;
    event.preventDefault();
    candidate = event;
    show('native');
  });
  window.addEventListener('appinstalled', () => { candidate = null; hide(); });
  standalone.addEventListener('change', () => { if (isStandalone()) hide(); });
  dismiss.addEventListener('click', rememberDismissal);
  install.addEventListener('click', async () => {
    if (!candidate || isStandalone()) return;
    const prompt = candidate;
    candidate = null;
    install.disabled = true;
    try { await prompt.prompt(); } catch { /* A consumed or unavailable browser prompt must not interrupt reading. */ }
    finally { install.disabled = false; rememberDismissal(); }
  });

  const agent = navigator.userAgent;
  const isIphoneSafari = /iPhone/.test(agent) && /Version\/.+Safari\//.test(agent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(agent);
  if (isIphoneSafari) show('ios');
}
