import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Genera dist/version.json con un timestamp unico por build. El cliente lo
// consulta (cache: 'no-store') para detectar nuevas versiones desplegadas y
// ofrecer una recarga limpia, evitando problemas de cache en los usuarios.
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distPath = resolve(projectRoot, 'dist');

await mkdir(distPath, { recursive: true });
const version = String(Date.now());
await writeFile(resolve(distPath, 'version.json'), JSON.stringify({ version }), 'utf8');
console.log(`version.json generated: ${version}`);