/**
 * Действия над проектом: точка входа. Сами действия разложены по
 * областям в src/utils/project/ (этап 15.1); компоненты и тесты
 * по-прежнему импортируют и мокают этот модуль.
 */
// Из core наружу — только то, что было публичным; остальное — помощники
// для модулей project/*.
export { applyProjectToStores, flushPendingEditorSave } from "./project/core";
export * from "./project/prompts";
export * from "./project/attachments";
export * from "./project/tree";
export * from "./project/projects";
export * from "./project/versions";
export {
  setProjectDecisions,
  type ProjectDecisions,
} from "./project/decisions";
