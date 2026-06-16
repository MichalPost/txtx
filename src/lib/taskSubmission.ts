export interface TaskCreationFailure {
  message: string;
  url: string;
}

export interface TaskCreationBatchResult {
  failures: TaskCreationFailure[];
  successCount: number;
}

export async function submitTaskAndThen<TResult>(
  createTask: () => Promise<TResult>,
  afterSubmit: () => void,
): Promise<void> {
  await createTask();
  afterSubmit();
}

export async function createTasksFromUrls<TResult>(
  urls: string[],
  createTask: (url: string) => Promise<TResult>,
): Promise<TaskCreationBatchResult> {
  let successCount = 0;
  const failures: TaskCreationFailure[] = [];

  for (const url of urls) {
    try {
      await createTask(url);
      successCount += 1;
    } catch (error) {
      failures.push({
        url,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { successCount, failures };
}
