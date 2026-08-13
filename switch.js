(async () => {
  const destination = location.href.slice(location.href.indexOf('#') + 1);
  let safeDestination = 'https://github.com/';

  try {
    const parsed = new URL(destination);
    if (parsed.origin !== 'https://github.com') throw new Error('Invalid navigation destination');
    safeDestination = destination;

    await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'prepareNavigation', url: destination }, response => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else if (!response?.success) reject(new Error(response?.error || 'Account switch failed'));
        else resolve();
      });
    });
  } catch (error) {
    console.error('[GAS] Pre-navigation switch failed:', error);
  }

  location.replace(safeDestination);
})();
