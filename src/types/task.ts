export interface Task {
  id: string;
  record_id: string;
  task_name: string;
  task_description: string;
  client: string;
  assistant: string;
  boh: boolean;
  foh: boolean;
  created_at: string;
}
