import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distPath = resolve(projectRoot, 'dist');
const exportPath = resolve(projectRoot, 'export');
const distIndexPath = resolve(distPath, 'index.html');
const exportIndexPath = resolve(exportPath, 'index.aspx');
const exportAssetsPath = resolve(exportPath, 'assets');
const distAssetsPath = resolve(distPath, 'assets');
const distImgPath = resolve(distPath, 'img');

await rm(exportPath, { recursive: true, force: true });
await mkdir(exportPath, { recursive: true });
await mkdir(exportAssetsPath, { recursive: true });

const index = await readFile(distIndexPath, 'utf8');
const sharePointIndex = index
	.replaceAll('./assets/', '/sites/co-lmn-sgia/ac/SiteAssets/Incorporaciones/assets/')
	.replaceAll('./img/', '/sites/co-lmn-sgia/ac/SiteAssets/Incorporaciones/img/');
await writeFile(resolve(exportPath, 'index.html'), sharePointIndex, 'utf8');
await rename(resolve(exportPath, 'index.html'), exportIndexPath);

const assetNames = await readdir(distAssetsPath);
const bundles = assetNames.filter(name => /\.(?:js|css)$/i.test(name));
await Promise.all(bundles.map(name => cp(resolve(distAssetsPath, name), resolve(exportAssetsPath, name))));
await cp(distImgPath, resolve(exportPath, 'img'), { recursive: true });
await Promise.all(['favicon.svg', 'icons.svg'].map(name => cp(resolve(distPath, name), resolve(exportPath, name))));

console.log(`SharePoint export generated at ${exportPath}`);
