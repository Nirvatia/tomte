// У turndown-plugin-gfm нет своих типов и нет пакета в @types.
declare module "turndown-plugin-gfm" {
  import type TurndownService from "turndown";

  type Plugin = (service: TurndownService) => void;

  export const gfm: Plugin;
  export const tables: Plugin;
  export const strikethrough: Plugin;
  export const taskListItems: Plugin;
  export const highlightedCodeBlock: Plugin;
}
