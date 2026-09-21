const urls = [
  'http://localhost:5173/',
  'http://localhost:5173/src/main.jsx',
  'http://localhost:5173/src/App.jsx',
  'http://localhost:5173/src/components/TiltedCard.jsx',
  'http://localhost:5173/node_modules/motion/dist/es/react.mjs',
];

for (const url of urls) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    const head = text.slice(0, 180).replace(/\s+/g, ' ');
    console.log('---', res.status, url, 'len=' + text.length);
    console.log(head);
    if (/Internal Server Error|Failed to resolve|Cannot find|error/i.test(text.slice(0, 2000))) {
      console.log('!! possible error body snippet:');
      console.log(text.slice(0, 800));
    }
  } catch (err) {
    console.log('--- FAIL', url, err.message);
  }
}
