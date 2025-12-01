export type TestType = 'CLIENT' | 'SERVER';

export type DefinitionScope = 'AUTOMATED' | 'SELF';

export interface TestDefinitionConfig {
  key: string;
  label: string;
  type: TestType;
  weight: number;
  enabled: boolean;
  scope?: DefinitionScope;
  description?: string;
}

export type TestDefinitionStore = Record<TestType, TestDefinitionConfig[]>;
