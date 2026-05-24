import { join } from 'node:path';
import { readFileContent } from './fs-adapter.js';

export interface RepoConfig {
  owner: string;
  name: string;
  url: string;
  localPath: string;
}

export interface OrchestratorConfig {
  triggerId: string;
  taskFile: string;
  outputFile: string;
}

export interface PhoneConfig {
  toggleIssueNumber: number;
  toggleIssueTitle: string;
}

export interface CoworkConfig {
  repo: RepoConfig;
  orchestrator: OrchestratorConfig;
  phone: PhoneConfig;
}

const REPO_FIELDS: (keyof RepoConfig)[] = ['owner', 'name', 'url', 'localPath'];
const ORCH_FIELDS: (keyof OrchestratorConfig)[] = ['triggerId', 'taskFile', 'outputFile'];
const PHONE_FIELDS: (keyof PhoneConfig)[] = ['toggleIssueNumber', 'toggleIssueTitle'];

function validateSection<T extends object>(
  obj: Record<string, unknown> | undefined,
  section: string,
  fields: (keyof T)[],
): void {
  if (!obj || typeof obj !== 'object') {
    throw new Error(`Missing required config section: ${section}`);
  }
  for (const f of fields) {
    if (obj[f as string] === undefined) {
      throw new Error(`Missing required field: ${section}.${String(f)}`);
    }
  }
}

export function parseConfig(json: string): CoworkConfig {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid JSON in config file');
  }

  validateSection<RepoConfig>(raw.repo as Record<string, unknown> | undefined, 'repo', REPO_FIELDS);
  validateSection<OrchestratorConfig>(raw.orchestrator as Record<string, unknown> | undefined, 'orchestrator', ORCH_FIELDS);
  validateSection<PhoneConfig>(raw.phone as Record<string, unknown> | undefined, 'phone', PHONE_FIELDS);

  return raw as unknown as CoworkConfig;
}

export function readConfig(configPath: string): CoworkConfig {
  const content = readFileContent(configPath);
  return parseConfig(content);
}

export function loadConfig(): CoworkConfig {
  const configPath = join(process.cwd(), '.claude', 'cowork-config.json');
  return readConfig(configPath);
}
