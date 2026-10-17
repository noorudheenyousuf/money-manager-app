// ========================================================
// PWA Service Worker & Install Prompt Controller
// ========================================================

let deferredInstallPrompt = null;

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ ServiceWorker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.warn('⚠️ ServiceWorker registration failed:', error);
      });
  });
}

// Handle PWA Installation Prompt
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent standard mini-infobar
  e.preventDefault();
  deferredInstallPrompt = e;

  // Reveal the Install button in the header
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
    installBtn.classList.remove('hidden');
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const choiceResult = await deferredInstallPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('User installed CashFlow PWA');
      }
      deferredInstallPrompt = null;
      installBtn.classList.add('hidden');
    });
  }
});

// App Installed Event
window.addEventListener('appinstalled', () => {
  console.log('🎉 CashFlow PWA installed successfully!');
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) installBtn.classList.add('hidden');
});

// Online / Offline Status Monitoring
function updateNetworkStatus() {
  const offlineBanner = document.getElementById('offline-banner');
  if (!offlineBanner) return;

  if (navigator.onLine) {
    offlineBanner.classList.add('hidden');
  } else {
    offlineBanner.classList.remove('hidden');
  }
}

window.addEventListener('online', () => {
  updateNetworkStatus();
  if (window.showToast) window.showToast('Back online! Syncing data...', 'success');
  if (window.refreshAllData) window.refreshAllData();
});

window.addEventListener('offline', () => {
  updateNetworkStatus();
  if (window.showToast) window.showToast('You are offline. Working in cached mode.', 'danger');
});

// Check status on initial load
document.addEventListener('DOMContentLoaded', updateNetworkStatus);
