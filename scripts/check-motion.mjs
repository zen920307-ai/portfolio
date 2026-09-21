import * as m from 'motion/react';
const keys = Object.keys(m).filter((k) => ['motion', 'useMotionValue', 'useSpring'].includes(k));
console.log('exports:', keys.join(','));
console.log('motion type:', typeof m.motion);
console.log('useMotionValue:', typeof m.useMotionValue);
console.log('useSpring:', typeof m.useSpring);
