export type TaskStatus = 'pending' | 'completed' | 'failed' | 'skipped';

export type TaskPriority = 'high' | 'medium' | 'low';

export type TaskType = 'code' | 'research' | 'docs' | 'refactor' | 'test' | 'design';

export interface Task {
  title: string;
  priority: TaskPriority;
  type: TaskType;
  context: string;
  status: TaskStatus;
  dependsOn?: string[];
}

export interface ExecutionBatch {
  tasks: Task[];
  parallel: boolean;
  circular?: boolean;
}

export interface SessionResult {
  completed: Task[];
  failed: Task[];
  skipped: Task[];
  startTime: Date;
  endTime: Date;
}

export interface ValidationWarning {
  taskTitle: string;
  field: string;
  message: string;
}

export interface TaskRunResult {
  success: boolean;
  output: string;
  durationMs: number;
  error?: string;
}

export interface ParseResult {
  tasks: Task[];
  warnings: ValidationWarning[];
}
