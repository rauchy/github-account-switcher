const tabStates = new Map(); // tabId -> { neverForThisTab, swapAttempts }

// --- Cookie storage ---

async function saveCookiesForAccount(account) {
  if (!account) return;
  const cookies = await chrome.cookies.getAll({ domain: '.github.com' });
  await chrome.storage.local.set({ [`cookies_${account}`]: cookies });
}

async function getStoredCookiesForAccount(account) {
  const result = await chrome.storage.local.get(`cookies_${account}`);
  return result[`cookies_${account}`] || null;
}

async function clearStoredCookiesForAccount(account) {
  await chrome.storage.local.remove(`cookies_${account}`);
}

async function swapCookies(targetCookies) {
  const currentCookies = await chrome.cookies.getAll({ domain: '.github.com' });
  await Promise.all(currentCookies.map(cookie => {
    const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
    return chrome.cookies.remove({ url: `https://${domain}${cookie.path}`, name: cookie.name }).catch(() => {});
  }));

  for (const cookie of targetCookies) {
    const details = {
      url: `https://github.com${cookie.path}`,
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
    };
    if (!cookie.name.startsWith('__Host-')) {
      details.domain = cookie.domain;
    }
    if (cookie.sameSite && cookie.sameSite !== 'unspecified') {
      details.sameSite = cookie.sameSite;
    }
    if (cookie.expirationDate) {
      details.expirationDate = cookie.expirationDate;
    }
    try {
      await chrome.cookies.set(details);
    } catch (e) {
      console.warn(`[GAS] Failed to set cookie ${cookie.name}:`, e);
    }
  }
}

// --- Save cookies passively on every completed GitHub navigation ---

chrome.webNavigation.onCompleted.addListener(async ({ url, frameId }) => {
  if (frameId !== 0) return;
  const data = await chrome.storage.sync.get(['orgSpecificAccount', 'personalAccount']);
  const dotcomUser = await chrome.cookies.get({ url: 'https://github.com', name: 'dotcom_user' });
  const currentAccount = dotcomUser?.value;
  if (!currentAccount) return;
  if (currentAccount !== data.orgSpecificAccount && currentAccount !== data.personalAccount) return;
  saveCookiesForAccount(currentAccount);
}, { url: [{ hostSuffix: 'github.com' }] });

// --- Account check logic ---

async function handleAccountCheck(url, tabId, sendResponse) {
  const data = await chrome.storage.sync.get(['orgSpecificAccount', 'personalAccount', 'orgUrl', 'switchTimer', 'instantSwitch']);

  if (!data.orgUrl || !data.orgSpecificAccount || !data.personalAccount) {
    sendResponse({ action: 'correct' });
    return;
  }

  // Skip switching on GitHub management pages that handle their own auth flows.
  const skipPatterns = [
    'https://github.com/orgs/',
    'https://github.com/enterprises/',
  ];
  if (skipPatterns.some(p => url.startsWith(p))) {
    sendResponse({ action: 'correct' });
    return;
  }

  const isOrgUrl = url.startsWith(data.orgUrl);
  const targetAccount = isOrgUrl ? data.orgSpecificAccount : data.personalAccount;

  const dotcomUser = await chrome.cookies.get({ url: 'https://github.com', name: 'dotcom_user' });
  const currentAccount = dotcomUser?.value;

  if (!currentAccount || currentAccount === targetAccount) {
    const tabState = tabStates.get(tabId) || {};
    if (tabState.swapAttempts > 0) {
      tabStates.set(tabId, { ...tabState, swapAttempts: 0 });
    }
    sendResponse({ action: 'correct' });
    return;
  }

  const tabState = tabStates.get(tabId) || {};
  const swapAttempts = tabState.swapAttempts || 0;
  const instantSwitch = data.instantSwitch !== false; // default true
  const storedCookies = instantSwitch ? await getStoredCookiesForAccount(targetAccount) : null;

  if (storedCookies && storedCookies.length > 0 && swapAttempts === 0) {
    tabStates.set(tabId, { ...tabState, swapAttempts: 1 });
    await swapCookies(storedCookies);
    sendResponse({ action: 'swapped' });
    chrome.tabs.reload(tabId);
    return;
  }

  // Swap failed or no stored cookies - fall back to UI click approach
  if (storedCookies) {
    clearStoredCookiesForAccount(targetAccount);
  }
  tabStates.set(tabId, { ...tabState, swapAttempts: 0 });
  sendResponse({ action: 'fallback', targetAccount, switchTimer: data.switchTimer || 3 });
}

// --- Message handler ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'setNeverForThisTab') {
    const state = tabStates.get(sender.tab.id) || {};
    tabStates.set(sender.tab.id, { ...state, neverForThisTab: true });
    sendResponse({ success: true });
  } else if (message.type === 'getNeverForThisTab') {
    sendResponse({ isNeverForThisTab: tabStates.get(sender.tab.id)?.neverForThisTab || false });
  } else if (message.type === 'clearTabState') {
    tabStates.delete(sender.tab.id);
  } else if (message.type === 'checkAccount') {
    handleAccountCheck(message.url, sender.tab.id, sendResponse);
    return true; // async response
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});
