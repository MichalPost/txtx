import { getAiFieldResult, getAiObject, getAiString, getAiStringArray } from "./aiResponse.ts";

export function readAiFieldMap(
  parsed: unknown,
): Record<string, { xpath: string; explanation: string }> {
  const objectValue = getAiObject(parsed);
  return Object.fromEntries(
    Object.entries(objectValue).map(([key, value]) => {
      const field = getAiFieldResult(value);
      return [key, { xpath: field?.xpath ?? "", explanation: field?.explanation ?? "" }];
    }),
  );
}

export function readAiXPathReply(parsed: unknown): {
  xpath: string;
  explanation: string;
  alternatives: string[];
} {
  const objectValue = getAiObject(parsed);
  return {
    xpath: getAiString(objectValue.xpath),
    explanation: getAiString(objectValue.explanation),
    alternatives: getAiStringArray(objectValue.alternatives),
  };
}
