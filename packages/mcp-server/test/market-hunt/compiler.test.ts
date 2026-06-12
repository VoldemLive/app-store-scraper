import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  COMPILER_VERSION,
  MARKET_HUNT_CATEGORIES,
  MarketHuntVectorCompiler,
  type MarketHuntCategory
} from '../../src/market-hunt/index.js';

const fileNames: Record<MarketHuntCategory, string> = {
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
  const directory = await mkdtemp(join(tmpdir(), 'market-hunt-'));
  await Promise.all(MARKET_HUNT_CATEGORIES.map(category =>
    writeFile(join(directory, fileNames[category]), `- ${category}_one\n- ${category}_two\n`)
  ));
  return directory;
}

test('loads the complete seed space and returns defensive copies', async () => {
  const compiler = new MarketHuntVectorCompiler(await seedDirectory());
  const first = await compiler.getSeedSpace();
  first.domain.push('mutated');
  const second = await compiler.getSeedSpace();

  assert.deepEqual(Object.keys(second), MARKET_HUNT_CATEGORIES);
  assert.deepEqual(second.domain, ['domain_one', 'domain_two']);
});

test('compiles one valid value from every seed category', async () => {
  const compiler = new MarketHuntVectorCompiler(await seedDirectory());
  const seedSpace = await compiler.getSeedSpace();
  const result = await compiler.compileVector({ strategy: 'full_random' });

  assert.equal(result.status, 'ok');
  assert.equal(result.metadata.compiler_version, COMPILER_VERSION);
  assert.deepEqual(Object.keys(result.seed_lineage), MARKET_HUNT_CATEGORIES);
  for (const category of MARKET_HUNT_CATEGORIES) {
    assert.ok(seedSpace[category].includes(result.seed_lineage[category]));
  }
});

test('returns the same lineage for the same random seed', async () => {
  const directory = await seedDirectory();
  const first = await new MarketHuntVectorCompiler(directory).compileVector({
    strategy: 'full_random',
    random_seed: 'test-001'
  });
  const second = await new MarketHuntVectorCompiler(directory).compileVector({
    strategy: 'full_random',
    random_seed: 'test-001'
  });

  assert.deepEqual(first, second);
});

test('rejects unsupported strategies and invalid random seeds internally', async () => {
  const compiler = new MarketHuntVectorCompiler(await seedDirectory());
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
  const compiler = new MarketHuntVectorCompiler(directory);
  await compiler.getSeedSpace();
  await writeFile(join(directory, fileNames.domain), '- replacement_domain\n');

  const reloaded = await compiler.reloadSeedSpace();
  assert.deepEqual(reloaded.domain, ['replacement_domain']);
});

test('reports compiler capabilities without exposing agent concerns', async () => {
  const compiler = new MarketHuntVectorCompiler(await seedDirectory());
  assert.deepEqual(compiler.compilerInfo(), {
    compiler_version: COMPILER_VERSION,
    strategy: 'full_random',
    seed_categories: MARKET_HUNT_CATEGORIES,
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
      () => new MarketHuntVectorCompiler(directory).reloadSeedSpace(),
      /Seed file for domain/
    );
  }

  await assert.rejects(
    () => new MarketHuntVectorCompiler(join(tmpdir(), 'missing-market-hunt-seeds')).reloadSeedSpace(),
    /Unable to load seed file/
  );
});
