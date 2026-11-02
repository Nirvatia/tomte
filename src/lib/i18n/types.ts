import type { ru } from "./locales/ru";

/** Строка со склонениями: форма выбирается по params.count. */
export interface Plural {
  one: string;
  few?: string;
  many?: string;
  other: string;
}

type Shape<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends Plural
      ? Plural
      : Shape<T[K]>;
};

/** Форма словаря задаётся русским: en и es обязаны иметь те же ключи. */
export type Dict = Shape<typeof ru>;

type Paths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string | Plural
    ? `${Prefix}${K}`
    : Paths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageKey = Paths<Dict>;
