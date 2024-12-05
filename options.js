document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('settings-form');
  const status = document.getElementById('status');

  chrome.storage.sync.get(['orgSpecificAccount', 'personalAccount', 'orgUrl', 'switchTimer'], (data) => {
    document.getElementById('org-specific-account').value = data.orgSpecificAccount || '';
    document.getElementById('personal-account').value = data.personalAccount || '';
    document.getElementById('org-url').value = data.orgUrl || '';
    document.getElementById('switch-timer').value = data.switchTimer || 3;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const orgSpecificAccount = document.getElementById('org-specific-account').value.trim();
    const personalAccount = document.getElementById('personal-account').value.trim();
    const orgUrl = document.getElementById('org-url').value.trim();
    const switchTimerInput = document.getElementById('switch-timer').value.trim();
    const switchTimer = switchTimerInput ? parseInt(switchTimerInput, 10) : 3;

    if (isNaN(switchTimer) || switchTimer < 1) {
      alert('Switch Timer must be a positive number.');
      return;
    }

    chrome.storage.sync.set({ orgSpecificAccount, personalAccount, orgUrl, switchTimer }, () => {
      status.textContent = 'Settings saved!';
      setTimeout(() => { status.textContent = ''; }, 2000);
    });
  });
});
