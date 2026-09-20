import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sources(join(directory, entry.name)) : entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [join(directory, entry.name)] : []);
}

it('keeps the simulation independent of presentation, content, networking and wall-clock randomness', () => {
  for (const file of sources('packages/game-core/src')) {
    const source = readFileSync(file, 'utf8');
    expect(source, file).not.toMatch(/\bMath\.random\s*\(|\bDate\.now\s*\(|\bperformance\.now\s*\(/);
    const imports = [...source.matchAll(/(?:from\s*|import\s*\()['"]([^'"]+)['"]/g)].map(match => match[1]);
    for (const dependency of imports) expect(dependency.startsWith('.') || dependency === '@shards/shared', `${file} imports ${dependency}`).toBe(true);
  }
});
