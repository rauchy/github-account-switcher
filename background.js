const tabStates = new Map(); // tabId -> { neverForThisTab, swapAttempts }

const NAVIGATION_GATE_RULE_IDS = [1, 2, 3];
const SKIP_PATH_PREFIXES = [
  '/login',
  '/logout',
  '/sessions',
  '/pages/auth',
  '/pulls',
  '/orgs/',
  '/enterprises/',
];

let navigationGateUpdate = Promise.resolve();
let cookieChangeTimer;

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

async function disableNavigationGate() {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: NAVIGATION_GATE_RULE_IDS,
  });
}

async function swapCookies(targetCookies) {
  const currentCookies = await chrome.cookies.getAll({ domain: '.github.com' });
  await Promise.all(currentCookies.map(cookie => {
    const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
    return chrome.cookies.remove({ url: `https://${domain}${cookie.path}`, name: cookie.name }).catch(() => {});
  }));

  await Promise.all(targetCookies.map(async cookie => {
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
  }));
}

// --- Pre-navigation switching ---

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getOrgPath(orgUrl) {
  try {
    const parsed = new URL(orgUrl);
    if (parsed.origin !== 'https://github.com') return null;
    const path = parsed.pathname.replace(/\/+$/, '');
    return path && path !== '/' ? path : null;
  } catch {
    return null;
  }
}

function shouldSkipUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin !== 'https://github.com' ||
      SKIP_PATH_PREFIXES.some(prefix => parsed.pathname.startsWith(prefix));
  } catch {
    return true;
  }
}

function getTargetAccount(url, settings) {
  if (shouldSkipUrl(url)) return null;
  const orgPath = getOrgPath(settings.orgUrl);
  if (!orgPath) return null;
  const path = new URL(url).pathname;
  const isOrgUrl = path === orgPath || path.startsWith(`${orgPath}/`);
  return isOrgUrl ? settings.orgSpecificAccount : settings.personalAccount;
}

function queueNavigationGateUpdate(knownCurrentAccount) {
  navigationGateUpdate = navigationGateUpdate
    .catch(() => {})
    .then(() => updateNavigationGateRules(knownCurrentAccount));
  return navigationGateUpdate;
}

async function updateNavigationGateRules(knownCurrentAccount) {
  const settings = await chrome.storage.sync.get(['orgSpecificAccount', 'personalAccount', 'orgUrl', 'instantSwitch']);
  const orgPath = getOrgPath(settings.orgUrl);
  let currentAccount = knownCurrentAccount;

  if (!currentAccount) {
    const dotcomUser = await chrome.cookies.get({ url: 'https://github.com', name: 'dotcom_user' });
    currentAccount = dotcomUser?.value;
  }

  const addRules = [];
  if (settings.instantSwitch !== false && orgPath &&
      currentAccount &&
      (currentAccount === settings.personalAccount || currentAccount === settings.orgSpecificAccount)) {
    const targetAccount = currentAccount === settings.personalAccount
      ? settings.orgSpecificAccount
      : settings.personalAccount;
    const storedCookies = await getStoredCookiesForAccount(targetAccount);

    // Never intercept a navigation unless we already have a session to swap to.
    if (storedCookies?.length) {
      const switchUrl = chrome.runtime.getURL('switch.html#');
      const redirectRule = {
        id: 1,
        priority: 1,
        action: { type: 'redirect', redirect: { regexSubstitution: `${switchUrl}\\1` } },
        condition: {
          regexFilter: currentAccount === settings.personalAccount
            ? `^(https://github\\.com${escapeRegex(orgPath)}(?:/.*)?(?:\\?.*)?)$`
            : '^(https://github\\.com(?:/.*)?(?:\\?.*)?)$',
          resourceTypes: ['main_frame'],
        },
      };
      addRules.push(redirectRule);

      if (currentAccount === settings.orgSpecificAccount) {
        addRules.push({
          id: 2,
          priority: 2,
          action: { type: 'allow' },
          condition: {
            regexFilter: `^https://github\\.com${escapeRegex(orgPath)}(?:/.*)?(?:\\?.*)?$`,
            resourceTypes: ['main_frame'],
          },
        });
        addRules.push({
          id: 3,
          priority: 2,
          action: { type: 'allow' },
          condition: {
            regexFilter: '^https://github\\.com/(?:login|logout|sessions|pages/auth|pulls|orgs/|enterprises/).*',
            resourceTypes: ['main_frame'],
          },
        });
      }
    }
  }

  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: NAVIGATION_GATE_RULE_IDS,
    addRules,
  });
}

async function prepareNavigation(url) {
  const settings = await chrome.storage.sync.get(['orgSpecificAccount', 'personalAccount', 'orgUrl', 'instantSwitch']);
  const targetAccount = getTargetAccount(url, settings);
  if (!targetAccount || settings.instantSwitch === false) return;

  const dotcomUser = await chrome.cookies.get({ url: 'https://github.com', name: 'dotcom_user' });
  if (dotcomUser?.value === targetAccount) {
    await queueNavigationGateUpdate(targetAccount);
    return;
  }

  const storedCookies = await getStoredCookiesForAccount(targetAccount);
  if (!storedCookies?.length) {
    await queueNavigationGateUpdate(dotcomUser?.value);
    return;
  }

  await swapCookies(storedCookies);
  await queueNavigationGateUpdate(targetAccount);
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

  // Skip switching on GitHub pages that handle their own auth flows or
  // act as intermediaries (e.g. GitHub Pages auth redirects go through /login).
  const skipPatterns = [
    'https://github.com/login',
    'https://github.com/logout',
    'https://github.com/sessions',
    'https://github.com/pages/auth',
    'https://github.com/pulls',
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
    await clearStoredCookiesForAccount(targetAccount);
    await queueNavigationGateUpdate(currentAccount);
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
  } else if (message.type === 'prepareNavigation') {
    prepareNavigation(message.url)
      .then(() => sendResponse({ success: true }))
      .catch(async error => {
        try {
          await disableNavigationGate();
        } catch (gateError) {
          console.error('[GAS] Failed to disable navigation gate:', gateError);
        }
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});

chrome.runtime.onInstalled.addListener(() => queueNavigationGateUpdate());
chrome.runtime.onStartup.addListener(() => queueNavigationGateUpdate());

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' &&
      ['orgSpecificAccount', 'personalAccount', 'orgUrl', 'instantSwitch'].some(key => changes[key])) {
    queueNavigationGateUpdate();
  }
});

chrome.cookies.onChanged.addListener(({ cookie }) => {
  if (cookie.domain !== 'github.com' && cookie.domain !== '.github.com') return;
  if (cookie.name !== 'dotcom_user') return;
  clearTimeout(cookieChangeTimer);
  cookieChangeTimer = setTimeout(() => queueNavigationGateUpdate(), 100);
});

queueNavigationGateUpdate();
