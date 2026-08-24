import type { Editor } from "@tiptap/core";

export const TEST_PROMPT_HTML = `
  <h1>Автоматический тест экспорта</h1>
  <p>Этот документ создан <strong>автоматически</strong> для проверки <em>курсива</em>, <u>подчеркивания</u>, <s>зачеркивания</s>, <mark>выделения</mark> и <code>встроенного кода</code>.</p>
  <h2>1. Списки</h2>
  <ul>
    <li>Маркированный элемент 1</li>
    <li>Маркированный элемент 2
      <ul>
        <li>Вложенный маркированный элемент</li>
      </ul>
    </li>
  </ul>
  <ol>
    <li>Нумерованный шаг первый</li>
    <li>Нумерованный шаг второй</li>
  </ol>
  <h2>2. Цитата</h2>
  <blockquote>Это тестовая цитата для проверки стилей экспорта (левая граница, фон, курсив).</blockquote>
  <h2>3. Таблица</h2>
  <table>
    <thead>
      <tr>
        <th>Параметр</th>
        <th>Значение</th>
        <th>Описание</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Temperature</td>
        <td>0.7</td>
        <td>Уровень креативности</td>
      </tr>
      <tr>
        <td>Max Tokens</td>
        <td>4096</td>
        <td>Максимальная длина</td>
      </tr>
    </tbody>
  </table>
`;

export function applyTestData(
  editor: Editor | null,
  setFileName: (name: string) => void,
) {
  if (!editor) return;
  editor.commands.setContent(TEST_PROMPT_HTML);
  setFileName("test_export_document");
}
