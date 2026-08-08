let deferredPrompt = null;
export function setupInstallPrompt(button) {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    button.hidden = false;
  });
  button.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    button.hidden = true;
  });
  window.addEventListener('appinstalled', () => { button.hidden = true; });
}
