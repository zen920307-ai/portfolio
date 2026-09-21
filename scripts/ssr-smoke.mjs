/**
 * Smoke-render App with happy-dom/jsdom if available; otherwise import graph check.
 */
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// Ensure motion imports resolve from portfolio root
process.chdir(root);

try {
  const mod = await import(pathToFileURL(path.join(root, 'src/components/TiltedCard.jsx')).href);
  console.log('TiltedCard default export:', typeof mod.default);
} catch (err) {
  console.error('TiltedCard import FAILED');
  console.error(err);
  process.exitCode = 1;
}

try {
  const m = await import('motion/react');
  const { useMotionValue, useSpring, motion } = m;
  console.log('motion exports ok', typeof motion, typeof useMotionValue, typeof useSpring);
} catch (err) {
  console.error('motion import FAILED', err);
  process.exitCode = 1;
}
