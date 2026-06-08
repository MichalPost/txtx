/**
 * xpathTool.ts - public facade for the keyword-based XPath generation tool.
 *
 * Keep importing from "./xpathTool"; implementation modules live in xpath-tool/.
 */

export { generateXPathFromKeyword } from "./xpath-tool/core";
export {
  KEYWORD_TYPE_LABELS,
  XPATH_TARGETS,
  type KeywordType,
  type TargetField,
  type ValidationResult,
  type XPathTarget,
  type XPathToolResult,
} from "./xpath-tool/types";
export { validateGeneratedXPath } from "./xpath-tool/validation";
