# GitHub Account Switcher

A customizable Chrome/Arc browser extension that simplifies switching between personal and organization-specific GitHub accounts.

## Features

- Automatically detects when you're accessing a repository or organization-specific URL.
- Prompts you to switch to the appropriate GitHub account with options to:
  - Switch now.
  - Cancel.
  - Disable switching for the current tab.
- Fully configurable through an options page:
  - Set your personal and organization-specific GitHub accounts.
  - Specify the base URL for your organization (e.g., `https://github.com/my-org`).
  - Configure a countdown timer for automatic switching.

## Assumptions

- You must be logged into both accounts.
- Changes in GitHub's UI might make this break from time to time. I'll do my best to fix this as I notice things break, but if you notice it before me, please let me know.

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

- Visit GitHub and navigate to any repository or organization-specific URL.
- If your currently active account is the wrong account, a toast notification will prompt you to:
  - Switch accounts immediately.
  - Cancel the switch.
  - Disable switching for the current tab.

## Contributing

Contributions, issues, and feature requests are welcome! Feel free to open a pull request or issue.

## License

This project is licensed under the MIT License.
