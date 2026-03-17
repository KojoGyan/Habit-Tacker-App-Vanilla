import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'assets', 'icons');

const LUCIDE_STATIC_VERSION = '0.542.0';
const BASE_URL = `https://unpkg.com/lucide-static@${LUCIDE_STATIC_VERSION}/icons`;

const iconImports = [
  'ArrowLeft',
  'ArrowRight',
  'BarChart3',
  'Calendar',
  'CheckCircle2',
  'CheckIcon',
  'ChevronDownIcon',
  'ChevronLeft',
  'ChevronLeftIcon',
  'ChevronRight',
  'ChevronRightIcon',
  'ChevronUpIcon',
  'CircleIcon',
  'Clock',
  'ExternalLink',
  'Flame',
  'GripVerticalIcon',
  'Home',
  'Inbox',
  'Info',
  'Infinity',
  'ListChecks',
  'Moon',
  'MoreHorizontal',
  'MoreHorizontalIcon',
  'MinusIcon',
  'PanelLeftIcon',
  'Pencil',
  'Plus',
  'Search',
  'SearchIcon',
  'Sun',
  'Trash2',
  'TrendingUp',
  'Trophy',
  'X',
  'XIcon'
];

function toKebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-zA-Z])([0-9])/g, '$1-$2')
    .replace(/([0-9])([a-zA-Z])/g, '$1-$2')
    .toLowerCase();
}

function normalizeSvg(svgText) {
  return svgText
    .replace(/\r\n/g, '\n')
    .replace(/stroke="black"/g, 'stroke="currentColor"')
    .replace(/fill="black"/g, 'fill="currentColor"');
}

async function fetchSvg(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const manifest = {
    source: 'lucide-static',
    version: LUCIDE_STATIC_VERSION,
    generatedAt: new Date().toISOString(),
    totalRequested: iconImports.length,
    icons: []
  };

  for (const importName of iconImports) {
    const targetSlug = toKebab(importName);
    const sourceName = importName.endsWith('Icon') ? importName.slice(0, -4) : importName;
    const sourceSlug = toKebab(sourceName);

    const url = `${BASE_URL}/${sourceSlug}.svg`;
    const targetFileName = `${targetSlug}.svg`;
    const targetPath = path.join(outDir, targetFileName);

    try {
      const rawSvg = await fetchSvg(url);
      const normalized = normalizeSvg(rawSvg);
      await writeFile(targetPath, normalized, 'utf8');

      manifest.icons.push({
        importName,
        sourceSlug,
        file: `assets/icons/${targetFileName}`,
        url,
        status: 'ok'
      });

      console.log(`ok  ${importName} -> ${targetFileName}`);
    } catch (error) {
      manifest.icons.push({
        importName,
        sourceSlug,
        file: `assets/icons/${targetFileName}`,
        url,
        status: 'error',
        error: String(error.message || error)
      });

      console.error(`err ${importName} -> ${targetFileName} (${error.message || error})`);
    }
  }

  const failed = manifest.icons.filter((entry) => entry.status === 'error').length;
  manifest.totalDownloaded = manifest.icons.length - failed;
  manifest.totalFailed = failed;

  const manifestPath = path.join(outDir, 'manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  if (failed > 0) {
    console.error(`Completed with failures: ${failed}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Completed successfully: ${manifest.totalDownloaded} icons`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
