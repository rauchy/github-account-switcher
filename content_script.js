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

  const waitForElement = (selector, timeout = 3000) =>
    new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      const observer = new MutationObserver((mutations, obs) => {
        const el = document.querySelector(selector);
        if (el) {
          obs.disconnect();
          resolve(el);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout: Element not found - ${selector}`));
      }, timeout);
    });

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

    switchNowButton.addEventListener('click', handleSwitchNow);
    cancelButton.addEventListener('click', handleCancel);
    neverButton.addEventListener('click', handleNeverForThisTab);

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
            const profileButton = await waitForElement('button[aria-label="Open user navigation menu"]');
            profileButton.click();

            const accountSwitcher = await waitForElement('svg.octicon.octicon-arrow-switch');
            accountSwitcher.closest('button').click();

            const accountList = await waitForElement('ul[aria-label="Switch account"]');
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
          } catch (error) {
            console.error(`Error during account switch: ${error.message}`);
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
