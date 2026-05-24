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
}

export interface ExecutionPlan {
  batches: ExecutionBatch[];
  cycles: string[][];
}

export interface SessionResult {
  completed: Task[];
  failed: Task[];
  skipped: Task[];
  startTime: Date;
  endTime: Date;
}
