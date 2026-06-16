export interface SubmitSingleDownloadUrlInput {
  url: string;
  submit: (url: string) => Promise<void>;
  saveHistory: (url: string) => void;
  clearInput: () => void;
}

export async function submitSingleDownloadUrl({
  url,
  submit,
  saveHistory,
  clearInput,
}: SubmitSingleDownloadUrlInput): Promise<void> {
  await submit(url);
  saveHistory(url);
  clearInput();
}
