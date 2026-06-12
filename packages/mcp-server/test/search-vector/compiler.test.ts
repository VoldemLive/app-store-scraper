import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  COMPILER_VERSION,
  SEARCH_VECTOR_CATEGORIES,
  SearchVectorCompiler,
  type SearchVectorCategory
} from '../../src/search-vector/index.js';

const fileNames: Record<SearchVectorCategory, string> = {
  domain: 'domains.yaml',
  problem: 'problems.yaml',
  persona: 'personas.yaml',
  situation: 'situations.yaml',
  form: 'forms.yaml',
  frequency: 'frequencies.yaml',
  asset: 'assets.yaml',
  environment: 'environments.yaml',
  replacement_system: 'replacement_systems.yaml',
  trigger: 'triggers.yaml',
  emotion: 'emotions.yaml'
};

async function seedDirectory (): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'search-vector-'));
  await Promise.all(SEARCH_VECTOR_CATEGORIES.map(category =>
    writeFile(join(directory, fileNames[category]), `- ${category}_one\n- ${category}_two\n`)
  ));
  return directory;
}

test('loads the complete seed space and returns defensive copies', async () => {
  const compiler = new SearchVectorCompiler(await seedDirectory());
  const first = await compiler.getSeedSpace();
  first.domain.push('mutated');
  const second = await compiler.getSeedSpace();

  assert.deepEqual(Object.keys(second), SEARCH_VECTOR_CATEGORIES);
  assert.deepEqual(second.domain, ['domain_one', 'domain_two']);
});

test('compiles one valid value from every seed category', async () => {
  const compiler = new SearchVectorCompiler(await seedDirectory());
  const seedSpace = await compiler.getSeedSpace();
  const result = await compiler.compileVector({ strategy: 'full_random' });

  assert.equal(result.status, 'ok');
  assert.equal(result.metadata.compiler_version, COMPILER_VERSION);
  assert.deepEqual(Object.keys(result.seed_lineage), SEARCH_VECTOR_CATEGORIES);
  for (const category of SEARCH_VECTOR_CATEGORIES) {
    assert.ok(seedSpace[category].includes(result.seed_lineage[category]));
  }
});

test('returns the same lineage for the same random seed', async () => {
  const directory = await seedDirectory();
  const first = await new SearchVectorCompiler(directory).compileVector({
    strategy: 'full_random',
    random_seed: 'test-001'
  });
  const second = await new SearchVectorCompiler(directory).compileVector({
    strategy: 'full_random',
    random_seed: 'test-001'
  });

  assert.deepEqual(first, second);
});

test('rejects unsupported strategies and invalid random seeds internally', async () => {
  const compiler = new SearchVectorCompiler(await seedDirectory());
  await assert.rejects(
    () => compiler.compileVector({ strategy: 'weighted_random' as 'full_random' }),
    /full_random strategy/
  );
  await assert.rejects(
    () => compiler.compileVector({ strategy: 'full_random', random_seed: '' }),
    /random_seed/
  );
});

test('reloads changed seed files', async () => {
  const directory = await seedDirectory();
  const compiler = new SearchVectorCompiler(directory);
  await compiler.getSeedSpace();
  await writeFile(join(directory, fileNames.domain), '- replacement_domain\n');

  const reloaded = await compiler.reloadSeedSpace();
  assert.deepEqual(reloaded.domain, ['replacement_domain']);
});

test('reports compiler capabilities without exposing agent concerns', async () => {
  const compiler = new SearchVectorCompiler(await seedDirectory());
  assert.deepEqual(compiler.compilerInfo(), {
    compiler_version: COMPILER_VERSION,
    strategy: 'full_random',
    seed_categories: SEARCH_VECTOR_CATEGORIES,
    deterministic_random_seed: true
  });
});

test('rejects duplicate, malformed, empty, and missing seed files', async () => {
  const cases = [
    '- duplicate\n- duplicate\n',
    '- not snake case\n',
    '[]\n'
  ];

  for (const content of cases) {
    const directory = await seedDirectory();
    await writeFile(join(directory, fileNames.domain), content);
    await assert.rejects(
      () => new SearchVectorCompiler(directory).reloadSeedSpace(),
      /Seed file for domain/
    );
  }

  await assert.rejects(
    () => new SearchVectorCompiler(join(tmpdir(), 'missing-search-vector-seeds')).reloadSeedSpace(),
    /Unable to load seed file/
  );
});
