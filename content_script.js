(async () => {
  if (window.top !== window.self) return;

  const isNeverForThisTab = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "getNeverForThisTab" }, (response) => {
      resolve(response.isNeverForThisTab);
    });
  });

  if (isNeverForThisTab) return;

  const url = window.location.href;

  if (!url.startsWith("https://github.com")) return;

  const data = await new Promise((resolve) => {
    chrome.storage.sync.get(['orgSpecificAccount', 'personalAccount', 'orgUrl', 'switchTimer'], resolve);
  });

  const isOrgSpecific = url.startsWith(data.orgUrl);
  const targetAccount = isOrgSpecific ? data.orgSpecificAccount : data.personalAccount;
  const switchTimer = data.switchTimer || 3;

  if (!targetAccount) return;

  handleAccountSwitch(targetAccount, switchTimer);
})();

function handleAccountSwitch(targetAccount, switchTimer) {
  if (window.__githubAccountSwitcherActive) return;
  window.__githubAccountSwitcherActive = true;

  // Cache for successful selectors to speed up subsequent switches
  const selectorCache = window.__selectorCache || {};
  window.__selectorCache = selectorCache;

  const waitForElement = (selector, timeout = 1000) =>
    new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const startTime = Date.now();
      const checkInterval = 10; // Check every 10ms for faster detection

      const checkElement = () => {
        const el = document.querySelector(selector);
        if (el) {
          resolve(el);
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout: Element not found - ${selector}`));
          return;
        }

        requestAnimationFrame(checkElement);
      };

      checkElement();
    });

  const waitForElementWithFallbacks = async (selectors, timeout = 150, cacheKey = null) => {
    // Try cached selector first if available
    if (cacheKey && selectorCache[cacheKey]) {
      try {
        const cachedElement = await waitForElement(selectorCache[cacheKey], timeout);
        if (cachedElement) return cachedElement;
      } catch (e) {
        // Cache miss, continue to try all selectors
      }
    }

    // Try all selectors in parallel for speed
    const promises = selectors.map((selector, index) =>
      waitForElement(selector, timeout).then(el => ({ el, index, selector })).catch(() => null)
    );

    const results = await Promise.all(promises);
    const found = results.find(result => result !== null);

    if (found) {
      // Update cache with successful selector
      if (cacheKey) {
        selectorCache[cacheKey] = found.selector;
      }
      return found.el;
    }

    throw new Error(`None of the selectors found: ${selectors.join(', ')}`);
  };

  const showErrorToast = (message) => {
    if (document.getElementById('github-account-switcher-error-toast')) return;

    const toast = document.createElement('div');
    toast.id = 'github-account-switcher-error-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(255, 77, 77, 0.95);
      color: #fff;
      padding: 15px 20px;
      border-radius: 5px;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      max-width: 400px;
    `;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 5000);
  };

  const showInteractiveToast = (message, countdown, onConfirm, onCancel, onNeverForThisTab) => {
    if (document.getElementById('github-account-switcher-toast')) return;

    const style = document.createElement('style');
    style.innerHTML = `
      .toast-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.85);
        color: #fff;
        padding: 15px 20px;
        border-radius: 5px;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        max-width: 800px;
      }
      .toast-message {
        margin-bottom: 10px;
      }
      .toast-actions {
        text-align: right;
      }
      .toast-button {
        background-color: #007bff;
        color: #fff;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        margin-left: 5px;
      }
      .toast-button:hover {
        background-color: #0056b3;
      }
      .toast-button.cancel {
        background-color: #ff4d4d;
      }
      .toast-button.cancel:hover {
        background-color: #cc0000;
      }
      .toast-button.never {
        background-color: #6c757d;
      }
      .toast-button.never:hover {
        background-color: #5a6268;
      }
    `;
    document.head.appendChild(style);

    const toast = document.createElement('div');
    toast.id = 'github-account-switcher-toast';
    toast.className = 'toast-notification';

    const messageDiv = document.createElement('div');
    messageDiv.className = 'toast-message';

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'toast-actions';

    const switchNowButton = document.createElement('button');
    switchNowButton.className = 'toast-button switch-now';

    const cancelButton = document.createElement('button');
    cancelButton.className = 'toast-button cancel';
    cancelButton.textContent = 'Cancel';

    const neverButton = document.createElement('button');
    neverButton.className = 'toast-button never';
    neverButton.textContent = 'Never For This Tab';

    actionsDiv.appendChild(switchNowButton);
    actionsDiv.appendChild(cancelButton);
    actionsDiv.appendChild(neverButton);

    toast.appendChild(messageDiv);
    toast.appendChild(actionsDiv);

    document.body.appendChild(toast);

    let currentCountdown = countdown;

    const updateMessage = () => {
      messageDiv.innerHTML = `
        ${message.replace('<<targetAccount>>', targetAccount)}
      `;
      switchNowButton.textContent = `Switch Now (${currentCountdown})`;
    };

    updateMessage();

    let timer = null;
    let isCleared = false;

    const clearAll = () => {
      if (isCleared) return;
      isCleared = true;
      if (timer) clearInterval(timer);
      switchNowButton.removeEventListener('click', handleSwitchNow);
      cancelButton.removeEventListener('click', handleCancel);
      neverButton.removeEventListener('click', handleNeverForThisTab);
      document.removeEventListener('keydown', handleEscKey);
      toast.remove();
      style.remove();
      window.__githubAccountSwitcherActive = false;
    };

    const handleSwitchNow = () => {
      clearAll();
      onConfirm();
    };

    const handleCancel = () => {
      clearAll();
      onCancel();
    };

    const handleNeverForThisTab = () => {
      chrome.runtime.sendMessage({ type: "setNeverForThisTab" }, () => {
        clearAll();
      });
    };

    const handleEscKey = (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };

    switchNowButton.addEventListener('click', handleSwitchNow);
    cancelButton.addEventListener('click', handleCancel);
    neverButton.addEventListener('click', handleNeverForThisTab);
    document.addEventListener('keydown', handleEscKey);

    timer = setInterval(() => {
      if (isCleared) return;
      currentCountdown -= 1;
      if (currentCountdown <= 0) {
        clearAll();
        onConfirm();
      } else {
        updateMessage();
      }
    }, 1000);
  };

  (async () => {
    try {
      const metaTag = document.querySelector('meta[name="user-login"]');
      const currentUser = metaTag ? metaTag.getAttribute("content") : null;

      if (currentUser === targetAccount) {
        window.__githubAccountSwitcherActive = false;
        return;
      }

      showInteractiveToast(
        `Whoops, it looks like you're using the wrong account. Switching to <<targetAccount>>...`,
        switchTimer,
        async () => {
          try {
            // Try multiple selectors for the profile button in case GitHub updates their UI
            const profileButton = await waitForElementWithFallbacks([
              'img[data-component="Avatar"]',
              'img[data-testid="github-avatar"]',
              'button[aria-label="Open user navigation menu"]',
              'button[aria-label="Open user menu"]',
              'summary[aria-label*="user menu"]'
            ], 150, 'profileButton');
            profileButton.click();

            // Wait for the dropdown menu to appear (much faster than fixed delay)
            const accountSwitcher = await waitForElementWithFallbacks([
              'svg.octicon-arrow-switch',
              'svg.octicon.octicon-arrow-switch',
              'button[aria-label*="witch account"]'
            ], 150, 'accountSwitcher');
            const switcherButton = accountSwitcher.closest('button') || accountSwitcher.parentElement;
            switcherButton.click();

            // Wait for the account list modal to appear (much faster than fixed delay)
            const accountList = await waitForElementWithFallbacks([
              'ul[aria-label="Switch account"]',
              'ul[role="menu"]',
              '[data-target*="account"]'
            ], 150, 'accountList');
            const accountItems = [...accountList.querySelectorAll('li')];

            for (const item of accountItems) {
              const spans = item.querySelectorAll('span');
              for (const span of spans) {
                if (span.textContent.trim() === targetAccount) {
                  item.click();
                  return;
                }
              }
            }
            throw new Error(`Account "${targetAccount}" not found in account list`);
          } catch (error) {
            console.error(`Error during account switch: ${error.message}`);
            showErrorToast(`Failed to switch accounts: ${error.message}. Try reloading the page.`);
            window.__githubAccountSwitcherActive = false;
          }
        },
        () => {},
        () => {
          chrome.runtime.sendMessage({ type: "setNeverForThisTab" }, () => {});
        }
      );
    } catch (error) {
      console.error(`Error in account switcher: ${error.message}`);
      window.__githubAccountSwitcherActive = false;
    }
  })();
}
