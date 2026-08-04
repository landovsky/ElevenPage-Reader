import esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [
    { in: 'src/content/content-entry.js', out: 'content-entry' },
    { in: 'src/background/service-worker.js', out: 'service-worker' },
    { in: 'src/popup/popup.js', out: 'popup' },
  ],
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: ['chrome116'],
  sourcemap: process.env.NODE_ENV !== 'production',
  minify: process.env.NODE_ENV === 'production',
};

async function build() {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await esbuild.build(buildOptions);
    console.log('Build complete');
  }
}

build().catch(() => process.exit(1));
