#!/usr/bin/env node
'use strict';

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const watch = process.argv.includes('--watch');
const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

fs.mkdirSync(distDir, { recursive: true });
fs.copyFileSync(path.join(srcDir, 'index.html'), path.join(distDir, 'index.html'));
fs.copyFileSync(path.join(srcDir, 'app.css'),    path.join(distDir, 'app.css'));

const ctx = {
  entryPoints: [path.join(srcDir, 'index.jsx')],
  bundle: true,
  outdir: distDir,
  // cockpit is loaded as a plain script in index.html and sets window.cockpit
  external: [],
  // Silence CSS imports from transitive deps; app styles come from app.css
  loader: { '.css': 'empty', '.svg': 'dataurl', '.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"' },
  format: 'iife',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
};

if (watch) {
  esbuild.context(ctx).then(c => {
    c.watch();
    console.log('[build] watching for changes…');
  });
} else {
  esbuild.build(ctx).then(() => console.log('[build] done'));
}
