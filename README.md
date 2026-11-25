# SketchSpace Pro

A polished, frontend-only digital art studio built with React, Vite, HTML5 Canvas, and Lucide icons.

## Features

- Pressure-aware pointer drawing with brush, pencil, and eraser tools
- Line, rectangle, ellipse, text, fill, and eyedropper tools
- Brush size, opacity, stabilization, and color controls
- Layer creation, duplication, visibility, locking, and deletion
- Undo and redo history
- Zoom, fullscreen, grid, rulers, and responsive layouts
- Image importing
- IndexedDB project storage with autosave
- Project gallery with search, open, and delete actions
- PNG and JPEG export
- Light and dark themes
- Keyboard shortcuts

## Local setup

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## Production build

```bash
npm run build
npm run preview
```

## GitHub

```bash
git init
git add .
git commit -m "Add SketchSpace Pro"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sketchspace-pro.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

## Deploy

### Vercel

1. Push the repository to GitHub.
2. Import the repository at [vercel.com/new](https://vercel.com/new).
3. Use `npm run build` as the build command and `dist` as the output directory.

### Netlify

1. Push the repository to GitHub.
2. Import the repository at [app.netlify.com/start](https://app.netlify.com/start).
3. Use `npm run build` as the build command and `dist` as the publish directory.

## LinkedIn description

Built SketchSpace Pro, a responsive browser-based digital art studio using React, HTML5 Canvas, IndexedDB, and Lucide icons. It includes drawing and shape tools, layer controls, undo/redo, image importing, project autosave, canvas adjustments, keyboard shortcuts, and PNG/JPEG exporting.
