export async function applyAndClose(
  apply: () => void | Promise<void>,
  close: () => void,
): Promise<void> {
  await apply();
  close();
}
