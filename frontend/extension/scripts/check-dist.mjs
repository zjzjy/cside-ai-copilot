import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const distDirectory = resolve('dist');
const manifestPath = resolve(distDirectory, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

const referencedFiles = new Set(
  [
    manifest.background?.service_worker,
    manifest.side_panel?.default_path,
    manifest.action?.default_popup,
    ...(manifest.content_scripts ?? []).flatMap((entry) => entry.js ?? []),
  ].filter(Boolean),
);

for (const referencedFile of referencedFiles) {
  await access(resolve(distDirectory, referencedFile));
}

const staticImportPattern = /(^|[;}\n])\s*import\s*(?![.(])/m;
for (const entryFile of ['background.js', 'content.js']) {
  const source = await readFile(resolve(distDirectory, entryFile), 'utf8');
  if (staticImportPattern.test(source)) {
    throw new Error(`${entryFile} contains a static import and is not self-contained`);
  }
}

process.stdout.write(
  `dist verified: ${referencedFiles.size} manifest entries exist; scripts are self-contained\n`,
);
