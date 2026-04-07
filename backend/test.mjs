import { io } from 'socket.io-client';

const url = process.argv[2];
if (!url) {
  console.error('Usage: node test.mjs <url>');
  process.exit(1);
}

const socket = io('http://localhost:3001');

socket.on('connect', () => {
  console.log(`\nAnalyzing: ${url}\n`);
  socket.emit('analysis:start', { url });
});

socket.on('analysis:progress', ({ progress, message }) => {
  process.stdout.write(`\r[${progress}%] ${message}   `);
});

socket.on('analysis:complete', (result) => {
  console.log('\n');
  console.log('── Scores ──────────────────────');
  console.log(`  Performance  : ${result.scores.performance}`);
  console.log(`  Accessibility: ${result.scores.accessibility}`);
  console.log(`  Best Practices: ${result.scores.bestPractices}`);
  console.log(`  SEO          : ${result.scores.seo}`);
  console.log('── Core Web Vitals ─────────────');
  console.log(`  FCP: ${Math.round(result.metrics.fcp)}ms`);
  console.log(`  LCP: ${Math.round(result.metrics.lcp)}ms`);
  console.log(`  TBT: ${Math.round(result.metrics.tbt)}ms`);
  console.log(`  CLS: ${result.metrics.cls.toFixed(4)}`);
  console.log(`  TTI: ${Math.round(result.metrics.tti)}ms`);
  console.log(result,'result');
  
  if (result.audits.length) {
    console.log('── Failed Audits ────────────────');
    result.audits.slice(0, 5).forEach(a => {
      console.log(`  [${a.impact.toUpperCase()}] ${a.title}`);
    });
  }
  socket.disconnect();
});

socket.on('analysis:error', ({ message }) => {
  console.error('\nError:', message);
  socket.disconnect();
});
