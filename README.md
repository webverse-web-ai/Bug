# Bug App 🐛

A React Native (Expo) bug tracking application with premium dark-themed authentication screens.

## Features

- 🔐 **Login Screen** — Email/password auth with form validation, social login, and animated UI
- 📝 **Signup Screen** — Registration with password strength indicator, terms acceptance
- 🎨 **Premium Dark Theme** — Glassmorphism cards, floating orbs, purple/teal gradient palette
- ⚡ **Micro-animations** — Spring press effects, floating decorative elements, focus glow inputs
- 📱 **Expo Router** — File-based navigation with smooth slide transitions

## Project Structure

```
Bug_App/
├── app/                          # Expo Router pages (file-based routing)
│   ├── _layout.js                # Root navigation layout
│   ├── index.js                  # Entry point → redirects to login
│   └── auth/                     # Auth flow screens
│       ├── _layout.js            # Auth stack layout (headerless)
│       ├── login.js              # Login screen
│       └── signup.js             # Signup screen
│
├── src/                          # Application source code
│   ├── components/               # Reusable UI components
│   │   └── ui/
│   │       ├── index.js          # Barrel exports
│   │       ├── CustomInput.js    # Animated text input with glow
│   │       ├── CustomButton.js   # Spring-animated button
│   │       ├── Divider.js        # "OR" divider line
│   │       └── SocialLoginButtons.js  # Social auth buttons
│   │
│   ├── constants/                # Design system tokens
│   │   ├── index.js
│   │   └── theme.js              # Colors, fonts, spacing, shadows
│   │
│   ├── services/                 # API services
│   │   ├── index.js
│   │   └── authService.js        # Auth API (mock, ready to connect)
│   │
│   └── utils/                    # Utility functions
│       ├── index.js
│       └── validation.js         # Form validation helpers
│
├── assets/                       # App icons, splash screens
├── app.json                      # Expo configuration
├── babel.config.js               # Babel configuration
├── package.json                  # Dependencies & scripts
└── .gitignore
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)

### Installation

```bash
# Install dependencies
npm install

# Start the dev server
npx expo start
```

### Running on a device

- **iOS Simulator**: Press `i` in the terminal
- **Android Emulator**: Press `a` in the terminal
- **Expo Go**: Scan the QR code with the Expo Go app

## Design System

The app uses a centralized design system defined in `src/constants/theme.js`:

| Token          | Example              |
|----------------|----------------------|
| Primary        | `#6C5CE7` (Purple)   |
| Accent         | `#00CEC9` (Teal)     |
| Background     | `#0A0A1A` (Dark)     |
| Surface        | `#1A1A2E`            |
| Text Primary   | `#FFFFFF`            |

## License

MIT
