import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// '/' is the sport picker, NFL lives at nfl/index.html, NBA at nba/index.html.
const pages = ['index.html', 'nfl/index.html', 'nba/index.html'];

const tempDir = await mkdtemp(join(tmpdir(), 'nfldashboard-html-check-'));
try {
  for (const page of pages) {
    const html = await readFile(new URL(`./${page}`, import.meta.url), 'utf8');
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
      .map(match => match[1])
      .filter(source => source.trim());

    if (!scripts.length) throw new Error(`No inline JavaScript blocks found in ${page}`);

    for (const [index, source] of scripts.entries()) {
      const path = join(tempDir, `inline-${index + 1}.js`);
      await writeFile(path, source, 'utf8');
      await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['--check', path], { stdio: 'inherit' });
        child.on('error', reject);
        child.on('exit', code => code === 0
          ? resolve()
          : reject(new Error(`${page}: inline script ${index + 1} failed syntax check (exit ${code})`)));
      });
    }
    console.log(`${page}: HTML script syntax OK (${scripts.length} inline block${scripts.length === 1 ? '' : 's'})`);
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
