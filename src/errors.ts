export class CoworkError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CoworkError';
    this.code = code;
  }
}

export class FileNotFoundError extends CoworkError {
  readonly path: string;

  constructor(path: string) {
    super('FILE_NOT_FOUND', `File not found: ${path}`);
    this.name = 'FileNotFoundError';
    this.path = path;
  }
}

export class TaskValidationError extends CoworkError {
  readonly errors: Array<{ task: string; field: string; message: string }>;

  constructor(errors: Array<{ task: string; field: string; message: string }>) {
    super('VALIDATION_FAILED', `Validation failed with ${errors.length} error(s)`);
    this.name = 'TaskValidationError';
    this.errors = errors;
  }
}

export class ExecutionError extends CoworkError {
  readonly taskTitle: string;

  constructor(taskTitle: string, message: string) {
    super('EXECUTION_FAILED', message);
    this.name = 'ExecutionError';
    this.taskTitle = taskTitle;
  }
}

export class ConfigError extends CoworkError {
  constructor(message: string) {
    super('CONFIG_ERROR', message);
    this.name = 'ConfigError';
  }
}
