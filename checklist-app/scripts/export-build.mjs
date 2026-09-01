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

await rm(exportPath, { recursive: true, force: true });
await mkdir(exportPath, { recursive: true });
await mkdir(exportAssetsPath, { recursive: true });

const index = await readFile(distIndexPath, 'utf8');
const sharePointIndex = index
	.replaceAll('./assets/', '/sites/co-lmn-sgia/ac/SiteAssets/Incorporaciones/assets/')
	.replaceAll('./img/', '/sites/co-lmn-sgia/ac/SiteAssets/Incorporaciones/img/');
await writeFile(resolve(exportPath, 'index.html'), sharePointIndex, 'utf8');
await rename(resolve(exportPath, 'index.html'), exportIndexPath);

// Solo se exportan los bundles JS/CSS y el index.aspx: favicon, icons e img ya
// estan publicados en SharePoint y no cambian entre builds. Las imagenes que el
// bundle referencia (dibujoSvg, logo_blanco, logo_negro) tambien permanecen en
// SharePoint con el mismo nombre, por lo que no se copian aqui.
const assetNames = await readdir(distAssetsPath);
const bundles = assetNames.filter(name => /\.(?:js|css)$/i.test(name));
await Promise.all(bundles.map(name => cp(resolve(distAssetsPath, name), resolve(exportAssetsPath, name))));

// version.json: el cliente lo consulta (cache: 'no-store') para detectar
// nuevas versiones desplegadas y ofrecer una recarga limpia.
try {
    await cp(resolve(distPath, 'version.json'), resolve(exportPath, 'version.json'));
} catch (err) {
    console.warn('version.json no encontrado, omitiendo copia:', err.message);
}

console.log(`SharePoint export generated at ${exportPath}`);
