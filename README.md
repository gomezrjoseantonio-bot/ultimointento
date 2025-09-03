# ATLAS — Horizon & Pulse

Modern fintech application combining real estate investment management (Horizon) and personal finance tools (Pulse).

## 🚀 Quick Start

### Prerequisites
- Node.js 20.x (see `.nvmrc`)
- npm 10.x or higher

### Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start development server:
   ```bash
   npm start
   ```
4. Build for production:
   ```bash
   npm run build
   ```

## 📋 Available Scripts

- `npm start` - Start development server
- `npm run build` - Create production build
- `npm test` - Run test suite
- `npm run build:bank-profiles` - Generate bank profiles from sample files

## 🏗️ Architecture

This is a React TypeScript application built with:
- **React 18** with TypeScript
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Chart.js** for data visualization
- **IndexedDB** for local data storage
- **Netlify Functions** for serverless backend

## 🏦 Bank Profiles

The application supports automatic bank statement parsing through configurable profiles:

1. Place sample bank files (CSV, Excel) in `profiles-input/` directory
2. Run `npm run build:bank-profiles`
3. Follow interactive prompts to map fields
4. Generated profiles are saved to `public/assets/bank-profiles.json`

## 🧪 Testing

Test files are located in:
- `src/services/*.test.ts` - Service layer tests
- `src/tests/` - Integration tests

Run tests with: `npm test`

## 🚀 Deployment

The application is configured for Netlify deployment with:
- Static site generation via `npm run build`
- Serverless functions in `functions/` directory
- Custom headers and redirects configured

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
├── contexts/           # React contexts (Theme, etc.)
├── modules/            # Feature modules (Horizon, Pulse)
├── pages/              # Top-level page components
├── services/           # Business logic and API services
└── config/             # Configuration files

functions/              # Netlify serverless functions
profiles-input/         # Bank statement samples for profile generation
public/                 # Static assets
scripts/                # Build and utility scripts
```

## 🔧 Configuration

Key configuration files:
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `netlify.toml` - Netlify deployment configuration