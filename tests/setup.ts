/// <reference types="vitest" />
import "@testing-library/jest-dom/vitest";

// Тесты проверяют поведение на эталонном (русском) словаре,
// независимо от языка окружения.
import { locale } from "../src/lib/i18n";
locale.set("ru");
