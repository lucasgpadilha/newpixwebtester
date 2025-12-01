import fs from 'fs/promises';
import path from 'path';
import { TestDefinitionConfig, TestDefinitionStore, TestType } from '../types/tests';
import defaultStore from '../../config/testDefinitions.json';

type ScoreMaps = {
  steps: Map<string, number>;
  self: Map<string, number>;
};

const STORE_PATH = path.resolve(process.cwd(), 'config', 'testDefinitions.json');

const clone = <T>(data: T): T => JSON.parse(JSON.stringify(data));

const DEFAULT_STORE: TestDefinitionStore = clone(defaultStore as TestDefinitionStore);

let cache: TestDefinitionStore | null = null;

const ensureDefaultsLoaded = async (): Promise<TestDefinitionStore> => {
  if (cache) {
    return cache;
  }

  try {
    const file = await fs.readFile(STORE_PATH, 'utf-8');
    const parsed: TestDefinitionStore = JSON.parse(file);
    cache = normalizeStore(parsed);
  } catch {
    cache = await resetToDefaults();
  }

  return cache!;
};

const normalizeStore = (data: Partial<TestDefinitionStore>): TestDefinitionStore => ({
  SERVER: Array.isArray(data.SERVER) ? data.SERVER : [],
  CLIENT: Array.isArray(data.CLIENT) ? data.CLIENT : [],
});

const resetToDefaults = async (): Promise<TestDefinitionStore> => {
  const normalized = normalizeStore(clone(DEFAULT_STORE));
  await saveStore(normalized);
  return normalized;
};

const saveStore = async (store: TestDefinitionStore): Promise<void> => {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  cache = store;
};

async function getDefinitions(type: TestType): Promise<TestDefinitionConfig[]>;
async function getDefinitions(): Promise<TestDefinitionStore>;
async function getDefinitions(type?: TestType): Promise<TestDefinitionConfig[] | TestDefinitionStore> {
  const store = await ensureDefaultsLoaded();
  if (type) {
    return clone(store[type]);
  }
  return clone(store);
}

const updateDefinition = async (
  key: string,
  updates: Partial<Omit<TestDefinitionConfig, 'key' | 'type'>>
): Promise<TestDefinitionConfig> => {
  const store = await ensureDefaultsLoaded();
  let updated: TestDefinitionConfig | null = null;

  (Object.keys(store) as TestType[]).forEach((type) => {
    store[type] = store[type].map((definition) => {
      if (definition.key !== key) {
        return definition;
      }
      updated = { ...definition, ...updates };
      return updated!;
    });
  });

  if (!updated) {
    throw new Error(`Test definition with key '${key}' not found.`);
  }

  await saveStore(store);
  return updated;
};

const getScoreMaps = async (testType: TestType): Promise<ScoreMaps> => {
  const definitions = (await getDefinitions(testType)) as TestDefinitionConfig[];
  const steps = new Map<string, number>();
  const self = new Map<string, number>();

  definitions.forEach((definition) => {
    if (!definition.enabled) {
      return;
    }
    if (definition.scope === 'SELF') {
      self.set(definition.key, definition.weight);
    } else {
      steps.set(definition.key, definition.weight);
    }
  });

  return { steps, self };
};

const getDefinitionMetadata = async () => {
  const store = await getDefinitions();
  return store;
};

export const testDefinitionStore = {
  getDefinitions,
  updateDefinition,
  getScoreMaps,
  getDefinitionMetadata,
};
