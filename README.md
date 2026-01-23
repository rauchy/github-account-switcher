# GitHub Account Switcher

A customizable Chrome/Arc browser extension that simplifies switching between personal and organization-specific GitHub accounts.

## Features

- **Smart Account Detection**: Automatically detects when you're accessing a repository or organization-specific URL.
- **Interactive Toast Notifications**: Prompts you to switch accounts with a countdown timer and multiple options:
  - Switch now (click button or press **Enter**).
  - Cancel (click button or press **ESC**).
  - Disable switching for the current tab.
- **Fast Switching**: Optimized account switching completes in under 500ms.
- **Fully Configurable**: Customize settings through the options page:
  - Set your personal and organization-specific GitHub accounts.
  - Specify the base URL for your organization (e.g., `https://github.com/my-org`).
  - Configure a countdown timer for automatic switching (supports values as low as 1 second).

## Requirements & Notes

- **Multi-Account Login**: You must be logged into both GitHub accounts simultaneously in your browser.
- **GitHub UI Changes**: This extension relies on GitHub's UI structure. GitHub updates may occasionally break functionality. Please report any issues you encounter.
- **Performance**: Account switching is optimized to complete in under 500ms, with subsequent switches being even faster thanks to selector caching.

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
   - **Switch Timer**: The time (in seconds) before automatically switching accounts.

## Usage

1. Visit GitHub and navigate to any repository or organization-specific URL.
2. If you're on the wrong account, a toast notification will appear with a countdown timer.
3. You have several options:
   - **Switch Now**: Click the button or press **Enter** to switch immediately.
   - **Cancel**: Click the button or press **ESC** to cancel the switch.
   - **Never For This Tab**: Click to disable automatic switching for the current tab.
   - **Wait**: Do nothing and the switch will happen automatically when the timer expires.

### Keyboard Shortcuts

- **Enter**: Immediately switch to the target account
- **ESC**: Cancel the switch and dismiss the toast

## Contributing

Contributions, issues, and feature requests are welcome! Feel free to open a pull request or issue.

## License

This project is licensed under the MIT License.
