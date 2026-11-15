<script lang="ts">
  import { t } from "$lib/i18n";
  import type { MessageKey } from "$lib/i18n/types";
  import { onMount } from "svelte";
  import { X } from "@lucide/svelte";

  import { isProjectTreeOpen, isTourOpen } from "../../stores";

  /**
   * Этап 5.8. Обучение при первом запуске: пошаговый тур.
   * Каждый шаг подсвечивает реальный элемент (data-tour) прожектором
   * и показывает пояснение рядом. Если цель не видна (свёрнута панель,
   * мобильный экран) — поповер центрируется без прожектора.
   */
  interface TourStep {
    id: string;
    target?: string;
  }

  const STEPS: TourStep[] = [
    { id: "welcome" },
    { id: "prompts", target: "prompts" },
    { id: "editor", target: "editor" },
    { id: "attachments", target: "attachments" },
    { id: "tree", target: "tree" },
    { id: "tokens", target: "tokens" },
    { id: "export", target: "export" },
    { id: "final" },
  ];

  const SPOT_PADDING = 6;
  const POP_WIDTH = 340;
  const POP_ESTIMATE_HEIGHT = 260;

  let stepIndex = $state(0);
  let spot = $state<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const step = $derived(STEPS[stepIndex]);
  const isFirst = $derived(stepIndex === 0);
  const isLast = $derived(stepIndex === STEPS.length - 1);

  function measure() {
    spot = null;
    if (!step.target) return;
    const element = document.querySelector(`[data-tour="${step.target}"]`);
    if (!element) return;
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    // Элемент может быть формально в DOM, но перекрыт (мобильный оверлей,
    // свёрнутая панель): подсвечиваем только если он реально под курсором.
    const cover = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2,
    );
    if (!cover || !element.contains(cover)) return;
    spot = {
      top: box.top - SPOT_PADDING,
      left: box.left - SPOT_PADDING,
      width: box.width + SPOT_PADDING * 2,
      height: box.height + SPOT_PADDING * 2,
    };
  }

  // Небольшая задержка: панель сайдбара раскрывается с анимацией,
  // сразу после смены шага координаты ещё старые.
  $effect(() => {
    void stepIndex;
    const timer = setTimeout(measure, 230);
    return () => clearTimeout(timer);
  });

  const popStyle = $derived.by(() => {
    if (!spot) {
      return "left:50%;top:50%;transform:translate(-50%,-50%);width:340px";
    }
    const left = Math.min(
      Math.max(8, spot.left + spot.width / 2 - POP_WIDTH / 2),
      window.innerWidth - POP_WIDTH - 8,
    );
    const belowTop = spot.top + spot.height + 12;
    const top =
      belowTop + POP_ESTIMATE_HEIGHT < window.innerHeight
        ? belowTop
        : Math.max(8, spot.top - POP_ESTIMATE_HEIGHT - 12);
    return `left:${left}px;top:${top}px;width:${POP_WIDTH}px`;
  });

  function finish() {
    try {
      localStorage.setItem("tomte:onboarded", "1");
    } catch {
      // без хранилища тур просто покажется при следующем запуске
    }
    isTourOpen.set(false);
    stepIndex = 0;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      finish();
    } else if (event.key === "ArrowRight" && !isLast) {
      stepIndex += 1;
    } else if (event.key === "ArrowLeft" && !isFirst) {
      stepIndex -= 1;
    }
  }

  onMount(() => {
    // Шаг про промпты бессмысленен с закрытой панелью.
    if (window.matchMedia("(min-width: 1024px)").matches) {
      isProjectTreeOpen.set(true);
    }
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="fixed inset-0 z-[85]"
  role="dialog"
  aria-modal="true"
  aria-label={$t("tour.title")}
>
  <!-- Затемнение; клик мимо поповера закрывает тур -->
  <div
    class="absolute inset-0 bg-black/60"
    onclick={finish}
    aria-hidden="true"
  ></div>

  <!-- Прожектор: кольцо вокруг цели, гигантская тень затемняет остальное -->
  {#if spot}
    <div
      class="pointer-events-none absolute rounded-md transition-all duration-200"
      style="left: {spot.left}px; top: {spot.top}px; width: {spot.width}px; height: {spot.height}px; box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6);"
    ></div>
  {/if}

  <div
    class="menu-panel absolute animate-scale-in p-5"
    style={popStyle}
    role="presentation"
    onclick={(event) => event.stopPropagation()}
  >
    <div class="flex items-start justify-between gap-3">
      <h3 class="text-[15px] font-bold text-[var(--text-primary)]">
        {$t(`tour.step.${step.id}.title` as MessageKey)}
      </h3>
      <button
        type="button"
        class="icon-btn -mr-1 -mt-1"
        aria-label={$t("tour.skip")}
        title={$t("tour.skip")}
        onclick={finish}
      >
        <X size={14} />
      </button>
    </div>
    <p class="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
      {$t(`tour.step.${step.id}.text` as MessageKey)}
    </p>

    <div class="mt-3 flex items-center justify-center gap-1.5">
      {#each STEPS as s, index (s.id)}
        <span
          class="h-1.5 rounded-full transition-all {index === stepIndex
            ? 'w-4 bg-[var(--accent)]'
            : 'w-1.5 bg-[var(--bg-lighter)]'}"
          aria-hidden="true"
        ></span>
      {/each}
    </div>

    <div class="mt-3 flex items-center justify-between">
      <button type="button" class="btn btn-ghost btn-sm" onclick={finish}>
        {$t("tour.skip")}
      </button>
      <div class="flex gap-2">
        {#if !isFirst}
          <button
            type="button"
            class="btn btn-outline btn-sm"
            onclick={() => (stepIndex -= 1)}
          >
            {$t("tour.back")}
          </button>
        {/if}
        <button
          type="button"
          class="btn btn-primary btn-sm"
          onclick={() => (isLast ? finish() : (stepIndex += 1))}
        >
          {isLast ? $t("tour.done") : $t("tour.next")}
        </button>
      </div>
    </div>
  </div>
</div>
