export async function saveRuleConfigAndThen(
  save: () => Promise<void>,
  afterSave: () => void,
): Promise<void> {
  await save();
  afterSave();
}
