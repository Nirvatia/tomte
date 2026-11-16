import { translate } from "./i18n";
import { requestConfirm } from "../stores/confirm";
import type { ProjectDecisions } from "../utils/project/decisions";

/**
 * Ответы на вопросы действий над проектом — окнами подтверждения
 * (этап 15.1). Регистрируется в +layout.svelte через setProjectDecisions.
 */
export const confirmDecisions: ProjectDecisions = {
  addAttachmentsAsMetadata: ({ size, limit }) =>
    requestConfirm({
      title: translate("limits.title"),
      message: translate("limits.attachmentsMessage", { size, limit }),
      confirmText: translate("limits.addAsMetadata"),
      cancelText: translate("common.cancel"),
    }),

  saveTreeStructureOnly: ({ limit }) =>
    requestConfirm({
      title: translate("limits.title"),
      message: translate("limits.treeMessage", { limit }),
      confirmText: translate("limits.saveStructure"),
      cancelText: translate("common.cancel"),
    }),

  copyGithubToken: ({ repo }) =>
    requestConfirm({
      title: translate("projects.copyToken.title"),
      message: translate("projects.copyToken.message", { repo }),
      confirmText: translate("projects.copyToken.confirm"),
      cancelText: translate("projects.copyToken.cancel"),
    }),
};
