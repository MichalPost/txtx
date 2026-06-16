export async function applyXPathResultsAndClose(
  apply: () => Promise<void>,
  close: () => void,
): Promise<void> {
  await apply();
  close();
}
