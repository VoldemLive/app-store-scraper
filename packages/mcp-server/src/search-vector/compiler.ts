import { createHash, randomInt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { load } from 'js-yaml';
import { ErrorCode, ProviderError } from '../errors/index.js';

export const COMPILER_VERSION = '1.0';
export const SEARCH_VECTOR_CATEGORIES = [
  'domain',
  'problem',
  'persona',
  'situation',
  'form',
  'frequency',
  'asset',
  'environment',
  'replacement_system',
  'trigger',
  'emotion'
] as const;

export type SearchVectorCategory = typeof SEARCH_VECTOR_CATEGORIES[number];
export type SeedSpace = Record<SearchVectorCategory, string[]>;
export type SeedLineage = Record<SearchVectorCategory, string>;

export type CompileVectorInput = {
  strategy: 'full_random';
  random_seed?: string;
};

export type CompileVectorResult = {
  status: 'ok';
  seed_lineage: SeedLineage;
  metadata: {
    compiler_version: string;
  };
};

export type CompilerInfo = {
  compiler_version: string;
  strategy: 'full_random';
  seed_categories: readonly SearchVectorCategory[];
  deterministic_random_seed: true;
};

const FILE_NAMES: Record<SearchVectorCategory, string> = {
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

const SNAKE_CASE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const DEFAULT_SEED_DIRECTORY = fileURLToPath(
  new URL('../../../seeds/search-vector/', import.meta.url)
);

function compilerError (message: string): ProviderError {
  return new ProviderError(ErrorCode.INTERNAL_ERROR, message, false);
}

function validateRecords (category: SearchVectorCategory, raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw compilerError(`Seed file for ${category} must contain a non-empty YAML list`);
  }

  if (!raw.every(value => typeof value === 'string' && SNAKE_CASE.test(value))) {
    throw compilerError(`Seed file for ${category} must contain only snake_case strings`);
  }

  const values = raw as string[];
  if (new Set(values).size !== values.length) {
    throw compilerError(`Seed file for ${category} contains duplicate values`);
  }
  return [...values];
}

function deterministicIndex (seed: string, category: SearchVectorCategory, length: number): number {
  const digest = createHash('sha256')
    .update(`${COMPILER_VERSION}\0${seed}\0${category}`)
    .digest();
  return digest.readUInt32BE(0) % length;
}

function copySeedSpace (seedSpace: SeedSpace): SeedSpace {
  return Object.fromEntries(
    SEARCH_VECTOR_CATEGORIES.map(category => [category, [...seedSpace[category]]])
  ) as SeedSpace;
}

export class SearchVectorCompiler {
  readonly #seedDirectory: string;
  #seedSpace: SeedSpace | undefined;

  constructor (seedDirectory: string = DEFAULT_SEED_DIRECTORY) {
    this.#seedDirectory = seedDirectory;
  }

  async getSeedSpace (): Promise<SeedSpace> {
    if (this.#seedSpace === undefined) {
      await this.reloadSeedSpace();
    }
    return copySeedSpace(this.#seedSpace as SeedSpace);
  }

  async reloadSeedSpace (): Promise<SeedSpace> {
    const entries = await Promise.all(SEARCH_VECTOR_CATEGORIES.map(async category => {
      const path = resolve(this.#seedDirectory, FILE_NAMES[category]);
      try {
        const content = await readFile(path, 'utf8');
        return [category, validateRecords(category, load(content))] as const;
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        throw compilerError(`Unable to load seed file for ${category}`);
      }
    }));
    this.#seedSpace = Object.fromEntries(entries) as SeedSpace;
    return copySeedSpace(this.#seedSpace);
  }

  compilerInfo (): CompilerInfo {
    return {
      compiler_version: COMPILER_VERSION,
      strategy: 'full_random',
      seed_categories: [...SEARCH_VECTOR_CATEGORIES],
      deterministic_random_seed: true
    };
  }

  async compileVector (input: CompileVectorInput): Promise<CompileVectorResult> {
    if (input.strategy !== 'full_random') {
      throw new ProviderError(
        ErrorCode.INVALID_ARGUMENT,
        'Version 1 supports only the full_random strategy',
        false
      );
    }
    if (
      input.random_seed !== undefined &&
      (input.random_seed.length === 0 || input.random_seed.length > 256)
    ) {
      throw new ProviderError(
        ErrorCode.INVALID_ARGUMENT,
        'random_seed must contain between 1 and 256 characters',
        false
      );
    }

    const seedSpace = await this.getSeedSpace();
    const lineage = Object.fromEntries(SEARCH_VECTOR_CATEGORIES.map(category => {
      const values = seedSpace[category];
      const index = input.random_seed === undefined
        ? randomInt(values.length)
        : deterministicIndex(input.random_seed, category, values.length);
      return [category, values[index]];
    })) as SeedLineage;

    return {
      status: 'ok',
      seed_lineage: lineage,
      metadata: {
        compiler_version: COMPILER_VERSION
      }
    };
  }
}
