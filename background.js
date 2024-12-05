const tabStates = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "setNeverForThisTab") {
    tabStates.set(sender.tab.id, true);
    sendResponse({ success: true });
  } else if (message.type === "getNeverForThisTab") {
    const isNeverForThisTab = tabStates.get(sender.tab.id) || false;
    sendResponse({ isNeverForThisTab });
  } else if (message.type === "clearTabState") {
    tabStates.delete(sender.tab.id);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});
