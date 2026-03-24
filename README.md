# GitHub Account Switcher

A customizable Chrome/Arc browser extension that simplifies switching between personal and organization-specific GitHub accounts.

## Features

- **Instant Switching**: Switches accounts silently by swapping browser session cookies — no visible menus, no page transitions, no toast. You just always end up on the right account.
- **Smart Fallback**: On the very first switch (before a session has been learned) or if your session expires, the extension falls back to clicking through GitHub's account switcher UI automatically, then saves the session for next time.
- **Smart Account Detection**: Automatically detects when you're accessing a repository or organization-specific URL and switches to the appropriate account.
- **Fully Configurable**: Customize settings through the options page:
  - Set your personal and organization-specific GitHub accounts.
  - Specify the base URL for your organization (e.g., `https://github.com/my-org`).
  - Configure a countdown timer for the fallback UI switch (supports values as low as 1 second).
  - Optionally disable instant switching if you prefer to always see the switch happen through GitHub's UI.

## Requirements & Notes

- **Multi-Account Login**: You must be logged into both GitHub accounts simultaneously in your browser.
- **GitHub UI Changes**: The fallback UI click path relies on GitHub's UI structure. GitHub updates may occasionally break it. Please report any issues you encounter.

## Installation

I _may_ publish this to the Chrome web store in the future. Until I do, you can install this manually through Developer Mode.

### 1. Clone or Download the Repository

- Clone the repository:
  ```bash
  git clone https://github.com/rauchy/github-account-switcher.git
  ```
- Or download it as a ZIP file from GitHub and extract it.

### 2. Load the Extension into Chrome

1. Open Chrome/Arc and navigate to `chrome://extensions`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked**.
4. Select the directory containing the extension (e.g., `github-account-switcher`).

### 3. Configure the Extension

1. Click the extension icon in Chrome and select **Options**.
2. Fill in the following fields:
   - **Personal Account**: Your personal GitHub username.
   - **Organization-Specific Account**: Your organization-specific GitHub username.
   - **Organization URL**: The base URL for your organization (e.g., `https://github.com/my-org`).
   - **Switch Timer**: The time (in seconds) before automatically switching accounts (used in fallback mode).

## Usage

Navigate to any GitHub URL. The extension handles everything automatically:

- **Instant switching (default)**: The account is switched silently via cookie swap before the page renders. You'll never see a wrong-account page.
- **Fallback (first use or expired session)**: A toast notification appears with a countdown timer. You can:
  - **Switch Now**: Click the button or press **Enter** to switch immediately.
  - **Cancel**: Click the button or press **ESC** to cancel the switch.
  - **Never For This Tab**: Disable automatic switching for the current tab.
  - **Wait**: Do nothing and the switch will happen automatically when the timer expires.

After any fallback switch, the extension saves your session so future switches are instant.

### Keyboard Shortcuts

These apply during the fallback toast:

- **Enter**: Immediately switch to the target account
- **ESC**: Cancel the switch and dismiss the toast

## Contributing

Contributions, issues, and feature requests are welcome! Feel free to open a pull request or issue.

## License

This project is licensed under the MIT License.
