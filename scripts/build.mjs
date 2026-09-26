#!/usr/bin/env node
/**
 * BYE QUIZ LIVE - Production Build & Verification Engine
 * Validates syntax, dependencies, HTML references, 3D assets, engine modules,
 * and packages a clean, production-ready release into dist/
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DIST = path.resolve(ROOT, 'dist');

let stepCount = 0;
let errors = [];

function step(title) {
  stepCount++;
  console.log(`\n[Step ${stepCount}] ${title}`);
}

function pass(msg) {
  console.log(`  ✅ [PASS] ${msg}`);
}

function fail(msg) {
  console.error(`  ❌ [FAIL] ${msg}`);
  errors.push(msg);
}

console.log('================================================================');
console.log('🏗️  BYE QUIZ LIVE - PRODUCTION BUILD & PACKAGING PIPELINE');
console.log('================================================================');

// --- Step 1: Clean old production output directory ---
step('Cleaning Old Production Build Directory (dist/)');
try {
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true, force: true });
    pass('Cleaned existing dist/ directory');
  } else {
    pass('dist/ directory is clean (none existed)');
  }
  fs.mkdirSync(DIST, { recursive: true });
  pass('Created fresh dist/ directory');
} catch (err) {
  fail(`Failed to initialize dist directory: ${err.message}`);
}

// --- Step 2: Validate Required Source Files (20 General + 9 Lib + 24 Engine = 53 Total) ---
step('Validating 53 Required Source Files (20 General + 9 Backend Lib + 24 Frontend Engine)');
const requiredFiles = [
  'server.js',
  'package.json',
  'package-lock.json',
  '.env.example',
  'README.md',
  'PROJECT_ARCHITECTURE.md',
  'data/questions.json',
  'data/questionSets.json',
  'data/settings.json',
  'migrations/001_initial_schema.sql',
  'public/index.html',
  'public/broadcast.html',
  'public/admin.html',
  'public/service-worker.js',
  'public/manifest.webmanifest',
  'public/css/style.css',
  'public/icons/icon-192.svg',
  'public/icons/icon-512.svg',
  'public/js/game.js',
  'public/js/audio.js',
  'public/js/lib/three.min.js'
];

const requiredLibFiles = [
  'auth.js',
  'commandParser.js',
  'database.js',
  'eventBus.js',
  'giftEngine.js',
  'logger.js',
  'security.js',
  'serverGameState.js',
  'tiktokConnector.js'
];

const requiredEngineFiles = [
  'answerEngine.js',
  'drawEngine.js',
  'effectManager.js',
  'eventManager.js',
  'gameEngine.js',
  'gameState.js',
  'giftEventEngine.js',
  'iconSystem.js',
  'milestoneEngine.js',
  'participantCard.js',
  'participantManager.js',
  'questionEngine.js',
  'questionModel.js',
  'questionSelector.js',
  'questionValidator.js',
  'reactionAggregator.js',
  'reactionCanvas.js',
  'reactionEngine.js',
  'reactionQueue.js',
  'roundManager.js',
  'scene3dEngine.js',
  'sceneManager.js',
  'scoreEngine.js',
  'statisticsEngine.js'
];

let verifiedGeneralCount = 0;
for (const req of requiredFiles) {
  const p = path.join(ROOT, req);
  if (fs.existsSync(p)) {
    pass(`Required file verified: ${req}`);
    verifiedGeneralCount++;
  } else {
    fail(`Missing required file: ${req}`);
  }
}

let verifiedLibCount = 0;
for (const lib of requiredLibFiles) {
  const p = path.join(ROOT, 'lib', lib);
  if (fs.existsSync(p)) {
    pass(`Backend lib module verified: lib/${lib}`);
    verifiedLibCount++;
  } else {
    fail(`Missing backend lib module: lib/${lib}`);
  }
}

let verifiedEngineCount = 0;
for (const eng of requiredEngineFiles) {
  const p = path.join(ROOT, 'public/js/engine', eng);
  if (fs.existsSync(p)) {
    pass(`Frontend engine module verified: public/js/engine/${eng}`);
    verifiedEngineCount++;
  } else {
    fail(`Missing frontend engine module: public/js/engine/${eng}`);
  }
}

const totalVerified = verifiedGeneralCount + verifiedLibCount + verifiedEngineCount;
pass(`Total Verified Source Files: ${totalVerified} / 53 (20 general + 9 backend lib + 24 frontend engine)`);

// --- Step 3: Validate Package Dependencies & package.json ---
step('Validating package.json & Dependencies');
try {
  const pkgContent = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
  const pkg = JSON.parse(pkgContent);
  pass(`package.json is valid JSON (name: ${pkg.name}, version: ${pkg.version})`);
  
  if (pkg.type === 'module') {
    pass('ES Module configuration verified ("type": "module")');
  } else {
    fail('package.json must specify "type": "module"');
  }

  const reqScripts = ['start', 'build', 'test'];
  for (const s of reqScripts) {
    if (pkg.scripts && pkg.scripts[s]) {
      pass(`npm script verified: "${s}": "${pkg.scripts[s]}"`);
    } else {
      fail(`Missing npm script in package.json: "${s}"`);
    }
  }

  const reqDeps = ['tiktok-live-connector', 'pg'];
  for (const d of reqDeps) {
    if (pkg.dependencies && pkg.dependencies[d]) {
      pass(`Dependency verified: ${d} (${pkg.dependencies[d]})`);
    } else {
      fail(`Missing dependency: ${d}`);
    }
  }
} catch (err) {
  fail(`Failed to validate package.json: ${err.message}`);
}

// --- Step 4: Validate JavaScript Syntax Across All JS Files ---
step('Verifying JavaScript Syntax for All Modules');
function validateJSSyntax(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
        validateJSSyntax(fullPath);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      try {
        execSync(`node --check "${fullPath}"`, { stdio: 'pipe' });
        pass(`Syntax valid: ${path.relative(ROOT, fullPath)}`);
      } catch (e) {
        fail(`Syntax error in ${path.relative(ROOT, fullPath)}: ${e.message}`);
      }
    }
  }
}

try {
  validateJSSyntax(path.join(ROOT, 'lib'));
  validateJSSyntax(path.join(ROOT, 'public/js'));
  validateJSSyntax(path.join(ROOT, 'tests'));
  execSync(`node --check "${path.join(ROOT, 'server.js')}"`, { stdio: 'pipe' });
  pass('Syntax valid: server.js');
} catch (err) {
  fail(`JS Syntax validation failed: ${err.message}`);
}

// --- Step 5: Validate HTML Script/Link References ---
step('Verifying HTML Asset & Script Integrity in public/*.html');
const htmlFiles = ['public/index.html', 'public/broadcast.html', 'public/admin.html'];
for (const htmlRel of htmlFiles) {
  const htmlPath = path.join(ROOT, htmlRel);
  const content = fs.readFileSync(htmlPath, 'utf8');
  
  // Check script src references
  const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = scriptRegex.exec(content)) !== null) {
    const src = match[1];
    if (src.startsWith('http://') || src.startsWith('https://')) continue;
    const cleanSrc = src.startsWith('/') ? src.slice(1) : src;
    const targetFile = path.join(ROOT, 'public', cleanSrc);
    if (fs.existsSync(targetFile)) {
      pass(`HTML script link verified: ${htmlRel} -> ${src}`);
    } else {
      fail(`Broken script reference in ${htmlRel}: ${src} (file not found: ${targetFile})`);
    }
  }

  // Check stylesheet link references
  const cssRegex = /<link\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  while ((match = cssRegex.exec(content)) !== null) {
    const href = match[1];
    if (href.startsWith('http://') || href.startsWith('https://') || href.includes('manifest')) continue;
    const cleanHref = href.startsWith('/') ? href.slice(1) : href;
    const targetFile = path.join(ROOT, 'public', cleanHref);
    if (fs.existsSync(targetFile)) {
      pass(`HTML stylesheet link verified: ${htmlRel} -> ${href}`);
    } else {
      fail(`Broken stylesheet reference in ${htmlRel}: ${href} (file not found: ${targetFile})`);
    }
  }
}

// --- Step 6: Validate Data JSON Integrity ---
step('Verifying JSON Integrity for Questions & Settings');
const jsonFiles = ['data/questions.json', 'data/questionSets.json', 'data/settings.json'];
for (const jRel of jsonFiles) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, jRel), 'utf8'));
    pass(`JSON integrity verified: ${jRel} (${Array.isArray(data) ? data.length + ' records' : 'Object with ' + Object.keys(data).length + ' keys'})`);
  } catch (err) {
    fail(`Invalid JSON in ${jRel}: ${err.message}`);
  }
}

// --- Step 7: Packaging Clean Production Release into dist/ ---
step('Packaging Clean Production Files into dist/');
function copyRecursive(src, dest, filterFn) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);
      if (filterFn(srcPath, entry)) {
        copyRecursive(srcPath, destPath, filterFn);
      }
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  const prodItems = [
    'server.js',
    'package-lock.json',
    '.env.example',
    'README.md',
    'PROJECT_ARCHITECTURE.md',
    'lib',
    'public',
    'data',
    'migrations'
  ];

  for (const item of prodItems) {
    const srcPath = path.join(ROOT, item);
    const destPath = path.join(DIST, item);
    if (fs.existsSync(srcPath)) {
      copyRecursive(srcPath, destPath, (p, name) => {
        // Exclude temporary, backup, test, sed artifacts, and screenshot files
        if (name.startsWith('.') && name !== '.env.example') return false;
        if (name.startsWith('sed')) return false;
        if (name.endsWith('.png') && (name.startsWith('visual_') || name.startsWith('final_') || name.startsWith('broadcast_'))) return false;
        if (name.endsWith('.bak') || name.endsWith('.old') || name.endsWith('.tmp') || name.endsWith('.backup')) return false;
        if (name === 'node_modules') return false;
        return true;
      });
      pass(`Packaged into dist/: ${item}`);
    }
  }

  // Generate clean production dist/package.json
  const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const prodPkg = {
    name: rootPkg.name,
    version: rootPkg.version,
    description: rootPkg.description,
    main: 'server.js',
    type: 'module',
    scripts: {
      start: 'node server.js'
    },
    dependencies: rootPkg.dependencies
  };
  fs.writeFileSync(path.join(DIST, 'package.json'), JSON.stringify(prodPkg, null, 2) + '\n');
  pass('Generated clean production package.json in dist/ (with start script only)');
} catch (err) {
  fail(`Packaging into dist failed: ${err.message}`);
}

// --- Step 8: Build Final Report & Exit Status ---
step('Build Verification Summary');
if (errors.length > 0) {
  console.error('\n❌ BUILD FAILED WITH ERRORS:');
  errors.forEach(e => console.error(`   - ${e}`));
  process.exit(1);
} else {
  console.log('\n================================================================');
  console.log('🎉 PRODUCTION BUILD COMPLETED SUCCESSFULLY (100% VALIDATED)');
  console.log('================================================================');
  console.log(`📦 Output Directory: ${DIST}`);
  console.log(`🚀 Ready to deploy and run: cd dist && npm start`);
  process.exit(0);
}
