import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Auditoría de aislamiento del Application Core (arquitectura hexagonal):
 * nada en core/ conoce Express, PostgreSQL, clientes HTTP ni variables de entorno.
 */

const coreDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../core');

/** Prototipo legado que aún usa src/index.js (importa bcryptjs/jsonwebtoken); se retira en la Fase 4. */
const LEGACY_SERVICES = ['authService.js', 'catalogService.js', 'outfitService.js', 'adminService.js'].map((file) =>
  join(coreDir, 'services', file),
);

function listJsFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return listJsFiles(full);
    return full.endsWith('.js') ? [full] : [];
  });
}

const IMPORT_REGEX = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
const importsOf = (source) => [...source.matchAll(IMPORT_REGEX)].map((m) => m[1] ?? m[2] ?? m[3]);

const FORBIDDEN_PACKAGES = /^(?:node:)?(?:express|pg|pg-pool|postgres|axios|node-fetch|undici|got|superagent|http|https|net)(?:\/|$)/;
const FORBIDDEN_CODE = [
  { pattern: /process\.env/, reason: 'lee process.env' },
  { pattern: /\bfetch\s*\(/, reason: 'hace llamadas HTTP con fetch()' },
];

test('ningún archivo de core/ importa express, drivers de PostgreSQL ni clientes HTTP, ni lee process.env', () => {
  const files = listJsFiles(coreDir);
  assert.ok(files.length > 30, 'se esperaban los archivos del core');

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const name = relative(coreDir, file);
    for (const specifier of importsOf(source)) {
      assert.ok(!FORBIDDEN_PACKAGES.test(specifier), `${name} importa infraestructura: ${specifier}`);
    }
    for (const { pattern, reason } of FORBIDDEN_CODE) {
      assert.ok(!pattern.test(source), `${name} ${reason}`);
    }
  }
});

test('dominio, puertos y servicios nuevos solo importan módulos dentro de core/', () => {
  const files = listJsFiles(coreDir).filter((file) => !LEGACY_SERVICES.includes(file));
  for (const file of files) {
    for (const specifier of importsOf(readFileSync(file, 'utf8'))) {
      const name = relative(coreDir, file);
      assert.ok(specifier.startsWith('.'), `${name} importa un paquete externo: ${specifier}`);
      assert.ok(resolve(dirname(file), specifier).startsWith(coreDir + sep), `${name} importa fuera de core/: ${specifier}`);
    }
  }
});
