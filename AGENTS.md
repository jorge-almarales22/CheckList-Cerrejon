# Agent Instructions and Repo Quirks

This file contains high-signal, local context to prevent future agents from making incorrect architectural assumptions.

## CRITICAL: Stack and Architecture Quirks
- **Single-File SPA**: The entire application is built as a single file: `index.html`.
- **No Build Tools**: There is no Node.js/npm environment, Vite, Webpack, or TypeScript. Do NOT run `npm install`, `npm start`, or create separate component/JS/CSS files.
- **Babel and Tailwind CDN**: React 18, Tailwind CSS, and Babel Standalone are loaded via CDN and compiled runtime in-browser. All JSX code resides inside `<script type="text/babel" data-presets="react">` in `index.html`.
- **Global Scope**: Do NOT use ES modules (`import`/`export`). Access React APIs globally (e.g., `React.useState`).

## Development and Testing
- **How to Run**: Since there is no dev server, open `index.html` directly in the browser or run a simple local server:
  - Python: `python -m http.server`
  - Node: `npx serve .`
- **SharePoint API Mocking**: 
  - The login mechanism relies on querying a live SharePoint site REST API (`glencore.sharepoint.com`).
  - Running locally will trigger CORS/network errors. If you need to test the app locally, mock/bypass the `fetch` in the `Login` component to simulate a successful login.

## Data and Permissions
- **Checklist Storage**: Although auth uses SharePoint, all checklist data is saved/read from the browser's `localStorage` under the key `'checklists_data'`.
- **Roles**: System roles are `Administrador`, `Responsable`, and `Desarrollador`. Permissions are mapped globally in `PERMISOS` at the top of the script.
