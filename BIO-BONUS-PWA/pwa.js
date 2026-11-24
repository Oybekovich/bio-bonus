(() => {
  'use strict';
  const installButton = document.getElementById('installAppBtn');
  let installPrompt = null;
  const tr = key => (window.I18N ? window.I18N.t(key) : key);

  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const hideInstallButton = () => {
    if (installButton) installButton.classList.remove('visible');
  };

  if (isStandalone()) hideInstallButton();

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    if (installButton && !isStandalone()) installButton.classList.add('visible');
  });

  if (installButton) {
    installButton.addEventListener('click', async () => {
      if (!installPrompt) {
        const isAppleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const message = tr(isAppleMobile ? 'install.ios' : 'install.other');
        if (window.showBioToast) window.showBioToast(message);
        else window.alert(message);
        return;
      }
      installPrompt.prompt();
      try { await installPrompt.userChoice; } catch (error) { console.info('Install oynasi yopildi.', error); }
      installPrompt = null;
      hideInstallButton();
    });
  }

  window.addEventListener('appinstalled', () => {
    hideInstallButton();
    if (window.showBioToast) window.showBioToast(tr('install.done'));
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(registration => console.info('BIO-BONUS offline rejimi tayyor.', registration.scope))
        .catch(error => console.warn('Service worker ro‘yxatdan o‘tmadi:', error));
    });
  }
})();
