import type { AlgorithmInputSchema, InputField, IntArrayField, TextField } from './types';

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface InputValidation<T = Record<string, unknown>> {
  ok: boolean;
  issues: ValidationIssue[];
  /** Normalised (deep-cloned) value, present only when `ok` is true. */
  value?: T;
}

const clone = <T,>(value: T): T => {
  if (value === null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value)) as T;
};

const isInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);

function checkIntArray(field: IntArrayField, value: unknown, issues: ValidationIssue[]): void {
  if (!Array.isArray(value)) {
    issues.push({ path: field.name, message: `${field.label} must be an array of integers` });
    return;
  }
  if (!field.allowEmpty && value.length === 0) {
    issues.push({
      path: field.name,
      message: `${field.label} must not be empty (this input shape has no defined result for the empty sequence)`
    });
  }
  const minLength = field.minLength ?? 0;
  const maxLength = field.maxLength ?? Number.POSITIVE_INFINITY;
  if (value.length < minLength) {
    issues.push({ path: field.name, message: `${field.label} needs at least ${minLength} element(s)` });
  }
  if (value.length > maxLength) {
    issues.push({ path: field.name, message: `${field.label} accepts at most ${maxLength} element(s)` });
  }
  value.forEach((entry, index) => {
    if (!isInteger(entry)) {
      issues.push({ path: `${field.name}[${index}]`, message: `${field.label}[${index}] must be an integer` });
      return;
    }
    if (field.min !== undefined && entry < field.min) {
      issues.push({
        path: `${field.name}[${index}]`,
        message: `${field.label}[${index}] = ${entry} is below the supported minimum ${field.min}`
      });
    }
    if (field.max !== undefined && entry > field.max) {
      issues.push({
        path: `${field.name}[${index}]`,
        message: `${field.label}[${index}] = ${entry} exceeds the supported maximum ${field.max}`
      });
    }
  });
}

function checkText(field: TextField, value: unknown, issues: ValidationIssue[]): void {
  if (typeof value !== 'string') {
    issues.push({ path: field.name, message: `${field.label} must be a string` });
    return;
  }
  if (field.minLength !== undefined && value.length < field.minLength) {
    issues.push({ path: field.name, message: `${field.label} needs at least ${field.minLength} character(s)` });
  }
  if (field.maxLength !== undefined && value.length > field.maxLength) {
    issues.push({ path: field.name, message: `${field.label} accepts at most ${field.maxLength} character(s)` });
  }
  const charset = field.charset ?? 'any';
  const patterns: Record<string, RegExp> = {
    any: /^[\s\S]*$/,
    lowercase: /^[a-z]*$/,
    digits: /^[0-9]*$/,
    'lowercase-upper-digits': /^[a-zA-Z0-9]*$/
  };
  if (!patterns[charset].test(value)) {
    issues.push({
      path: field.name,
      message: `${field.label} may only contain ${charset.replace(/-/g, ' ')} characters`
    });
  }
}

function checkField(field: InputField, value: unknown, issues: ValidationIssue[]): void {
  switch (field.kind) {
    case 'int-array':
      checkIntArray(field, value, issues);
      break;
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        issues.push({ path: field.name, message: `${field.label} must be a number` });
        break;
      }
      if (field.integer && !Number.isInteger(value)) {
        issues.push({ path: field.name, message: `${field.label} must be an integer` });
      }
      if (field.min !== undefined && value < field.min) {
        issues.push({ path: field.name, message: `${field.label} must be ≥ ${field.min}` });
      }
      if (field.max !== undefined && value > field.max) {
        issues.push({ path: field.name, message: `${field.label} must be ≤ ${field.max}` });
      }
      break;
    }
    case 'text':
      checkText(field, value, issues);
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        issues.push({ path: field.name, message: `${field.label} must be true or false` });
      }
      break;
    case 'enum': {
      const allowed = field.options.map((option) => option.value);
      if (typeof value !== 'string' || !allowed.includes(value)) {
        issues.push({ path: field.name, message: `${field.label} must be one of: ${allowed.join(', ')}` });
      }
      break;
    }
    case 'int-matrix': {
      if (!Array.isArray(value) || value.some((row) => !Array.isArray(row))) {
        issues.push({ path: field.name, message: `${field.label} must be a matrix (array of arrays)` });
        break;
      }
      const matrix = value as unknown[][];
      if (matrix.length !== field.rows || matrix.some((row) => row.length !== field.cols)) {
        issues.push({
          path: field.name,
          message: `${field.label} must be exactly ${field.rows}×${field.cols} for this visual model`
        });
      }
      matrix.forEach((row, r) =>
        row.forEach((entry, c) => {
          if (!isInteger(entry)) {
            issues.push({ path: `${field.name}[${r}][${c}]`, message: `${field.label}[${r}][${c}] must be an integer` });
            return;
          }
          if (field.min !== undefined && entry < field.min) {
            issues.push({ path: `${field.name}[${r}][${c}]`, message: `${field.label}[${r}][${c}] must be ≥ ${field.min}` });
          }
          if (field.max !== undefined && entry > field.max) {
            issues.push({ path: `${field.name}[${r}][${c}]`, message: `${field.label}[${r}][${c}] must be ≤ ${field.max}` });
          }
        })
      );
      break;
    }
    default:
      checkStructuredField(field, value, issues);
      break;
  }
}

function checkStructuredField(
  field: Exclude<InputField, { kind: 'int-array' | 'number' | 'text' | 'boolean' | 'enum' | 'int-matrix' }>,
  value: unknown,
  issues: ValidationIssue[]
): void {
  if (!Array.isArray(value)) {
    issues.push({ path: field.name, message: `${field.label} must be a list` });
    return;
  }
  if (field.kind === 'edges') {
    const labels = field.nodes ?? [];
    value.forEach((edge, index) => {
      const candidate = edge as { from?: unknown; to?: unknown; weight?: unknown };
      if (typeof candidate?.from !== 'string' || typeof candidate?.to !== 'string') {
        issues.push({ path: `${field.name}[${index}]`, message: `edge ${index} needs string endpoints` });
        return;
      }
      if (labels.length > 0) {
        if (!labels.includes(candidate.from)) {
          issues.push({ path: `${field.name}[${index}].from`, message: `unknown vertex "${candidate.from}"` });
        }
        if (!labels.includes(candidate.to)) {
          issues.push({ path: `${field.name}[${index}].to`, message: `unknown vertex "${candidate.to}"` });
        }
      }
      if (candidate.from === candidate.to) {
        issues.push({
          path: `${field.name}[${index}]`,
          message: `self loop on "${candidate.from}" is not supported by this visual model`
        });
      }
      if (field.weighted && (typeof candidate.weight !== 'number' || !Number.isFinite(candidate.weight))) {
        issues.push({ path: `${field.name}[${index}].weight`, message: `edge ${index} needs a numeric weight` });
      }
    });
    return;
  }
  if (field.kind === 'intervals') {
    value.forEach((interval, index) => {
      const candidate = interval as { start?: unknown; end?: unknown };
      if (!isInteger(candidate?.start) || !isInteger(candidate?.end)) {
        issues.push({ path: `${field.name}[${index}]`, message: `interval ${index} needs integer start/end` });
        return;
      }
      if (candidate.end < candidate.start) {
        issues.push({
          path: `${field.name}[${index}]`,
          message: `interval ${index} has end ${candidate.end} < start ${candidate.start}`
        });
      }
      if (field.maxEnd !== undefined && candidate.end > field.maxEnd) {
        issues.push({
          path: `${field.name}[${index}]`,
          message: `interval ${index} ends at ${candidate.end}, above the supported ${field.maxEnd}`
        });
      }
    });
    return;
  }
  value.forEach((item, index) => {
    const candidate = item as { label?: unknown; weight?: unknown; profit?: unknown };
    if (
      typeof candidate?.label !== 'string' ||
      typeof candidate?.weight !== 'number' ||
      typeof candidate?.profit !== 'number'
    ) {
      issues.push({
        path: `${field.name}[${index}]`,
        message: `item ${index} needs a label plus numeric weight and profit`
      });
      return;
    }
    if (!Number.isFinite(candidate.weight) || candidate.weight <= 0) {
      issues.push({ path: `${field.name}[${index}].weight`, message: `item ${index} weight must be > 0` });
    }
    if (!Number.isFinite(candidate.profit)) {
      issues.push({ path: `${field.name}[${index}].profit`, message: `item ${index} profit must be finite` });
    }
  });
}

/** Validates raw user input against the algorithm's declared schema. */
export function validateInput<T = Record<string, unknown>>(
  schema: AlgorithmInputSchema,
  raw: unknown
): InputValidation<T> {
  const issues: ValidationIssue[] = [];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, issues: [{ path: '$', message: 'input must be an object with the declared fields' }] };
  }
  const record = raw as Record<string, unknown>;
  for (const field of schema.fields) {
    const present = Object.prototype.hasOwnProperty.call(record, field.name);
    if (!present || record[field.name] === undefined) {
      if (!field.optional) {
        issues.push({ path: field.name, message: `${field.label} is required` });
      }
      continue;
    }
    checkField(field, record[field.name], issues);
  }
  const known = new Set(schema.fields.map((field) => field.name));
  for (const key of Object.keys(record)) {
    if (!known.has(key)) {
      issues.push({ path: key, message: `unknown field "${key}" — the input schema would be silently ignored` });
    }
  }
  if (issues.length > 0) return { ok: false, issues };
  const value = Object.fromEntries(Object.entries(record).filter(([key]) => known.has(key)));
  return { ok: true, issues: [], value: clone(value) as T };
}

/** Builds the default input from the schema (used by Reset and the input panel). */
export function defaultInput(schema: AlgorithmInputSchema): Record<string, unknown> {
  const value: Record<string, unknown> = {};
  for (const field of schema.fields) {
    value[field.name] = clone(field.default);
  }
  return value;
}

export function formatIssues(issues: ValidationIssue[]): string {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ');
}

