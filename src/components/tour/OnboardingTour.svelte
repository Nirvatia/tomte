<script lang="ts">
  import { t } from "$lib/i18n";
  import type { MessageKey } from "$lib/i18n/types";
  import { onMount, untrack } from "svelte";
  import { Check, MousePointerClick, PenLine, X } from "@lucide/svelte";

  import { DESKTOP_QUERY, isDesktop } from "$lib/media";
  import {
    clipToViewport,
    inflate,
    placeBadge,
    placePopover,
    sheetEdge,
    SHEET_BREAKPOINT,
    type Rect,
    type Size,
  } from "$lib/tour/position";
  import { markTourSeen, TOUR_STEPS, type TourStep } from "$lib/tour/steps";
  import { isProjectTreeOpen, isTourOpen } from "../../stores";

  /**
   * Этап 5.8. Обучающий тур.
   *
   * Слой поверх интерфейса: затемнение с «окном» вокруг подсвеченного
   * элемента. Окно прозрачно для кликов, поэтому на шагах-действиях
   * пользователь нажимает настоящую кнопку, а тур замечает это и идёт
   * дальше. Остальная часть экрана закрыта четырьмя невидимыми
   * блокерами. Положение цели пересчитывается каждый кадр: панели
   * раскрываются с анимацией, меню появляются и исчезают.
   */

  const SPOT_PADDING = 6;
  const POPOVER_WIDTH = 360;
  const AUTO_ADVANCE_DELAY = 450;

  const FOCUSABLE =
    'button:not([disabled]), [contenteditable="true"], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  const steps = $derived(
    TOUR_STEPS.filter((s) => !s.desktopOnly || $isDesktop),
  );

  let stepIndex = $state(0);
  const step = $derived(steps[Math.min(stepIndex, steps.length - 1)]);
  const isFirst = $derived(stepIndex === 0);
  const isLast = $derived(stepIndex >= steps.length - 1);

  let root = $state<HTMLDivElement | null>(null);
  let popoverEl = $state<HTMLDivElement | null>(null);
  let nextButton = $state<HTMLButtonElement | null>(null);

  let viewport = $state<Size>({ width: 1280, height: 800 });
  let spot = $state<Rect | null>(null);
  let popoverSize = $state<Size>({ width: POPOVER_WIDTH, height: 220 });
  let badgeSize = $state<Size>({ width: 130, height: 30 });
  /** Открыта модалка (пользователь нажал что-то в окне): тур ждёт её закрытия. */
  let suspended = $state(false);
  /** Действие текущего шага выполнено. */
  let actionDone = $state(false);
  /** Шаги-действия, уже выполненные: при возврате «Назад» не ждём их снова. */
  const completed = new Set<string>();
  let nudging = $state(false);

  let check: (() => boolean) | null = null;
  /** Проверка была ложной после входа в шаг: только тогда переходим сами. */
  let armed = false;
  let advanceTimer: ReturnType<typeof setTimeout> | undefined;
  let focusTimer: ReturnType<typeof setTimeout> | undefined;

  const action = $derived(step.action);
  const waitingForAction = $derived(Boolean(action) && !actionDone);

  // ═══ Положение ═══

  const isSheet = $derived(viewport.width < SHEET_BREAKPOINT);
  const sheetSide = $derived(sheetEdge(spot, viewport));

  const placement = $derived(
    placePopover({
      target: spot,
      popover: popoverSize,
      viewport,
      prefer: step.prefer,
    }),
  );

  const popoverStyle = $derived.by(() => {
    if (isSheet) {
      return sheetSide === "top"
        ? "left:12px;right:12px;top:12px"
        : "left:12px;right:12px;bottom:12px";
    }
    return `left:${placement.left}px;top:${placement.top}px;width:${POPOVER_WIDTH}px`;
  });

  const arrowSide = $derived(
    isSheet || placement.arrow === null ? null : placement.side,
  );

  const badge = $derived.by(() => {
    if (!spot || !action || actionDone) return null;
    return placeBadge({
      target: spot,
      badge: badgeSize,
      viewport,
      avoid: isSheet ? `sheet-${sheetSide}` : placement.side,
      inside: action.hint === "type",
      obstacle: popoverEl
        ? (() => {
            const box = popoverEl.getBoundingClientRect();
            return {
              top: isSheet ? box.top : placement.top,
              left: isSheet ? box.left : placement.left,
              width: popoverSize.width,
              height: popoverSize.height,
            };
          })()
        : null,
    });
  });

  // ═══ Цель ═══

  function findTarget(current: TourStep): HTMLElement | null {
    for (const name of current.targets ?? []) {
      const element = document.querySelector<HTMLElement>(
        `[data-tour="${name}"]`,
      );
      if (element && isVisible(element)) return element;
    }
    return null;
  }

  /**
   * Элемент может быть в DOM, но не виден: свёрнутая панель (ширина 0
   * и overflow: hidden), оверлей поверх. Проверяем, что в его центре
   * сверху лежит он сам, пропуская слой тура.
   */
  function isVisible(element: HTMLElement): boolean {
    const box = clipToViewport(element.getBoundingClientRect(), viewport);
    if (!box) return false;
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const hit = document
      .elementsFromPoint(x, y)
      .find((node) => !root?.contains(node));
    return Boolean(hit && element.contains(hit));
  }

  function sameRect(a: Rect | null, b: Rect | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return (
      Math.abs(a.top - b.top) < 0.5 &&
      Math.abs(a.left - b.left) < 0.5 &&
      Math.abs(a.width - b.width) < 0.5 &&
      Math.abs(a.height - b.height) < 0.5
    );
  }

  function update() {
    if (
      viewport.width !== window.innerWidth ||
      viewport.height !== window.innerHeight
    ) {
      viewport = { width: window.innerWidth, height: window.innerHeight };
    }

    suspended = document.querySelector('[aria-modal="true"]') !== null;
    if (suspended) return;

    const element = findTarget(step);
    const box = element
      ? clipToViewport(
          inflate(element.getBoundingClientRect(), SPOT_PADDING),
          viewport,
        )
      : null;
    if (!sameRect(box, spot)) spot = box;

    if (check && !actionDone) {
      if (check()) completeAction();
      else armed = true;
    }
  }

  // ═══ Шаги ═══

  function completeAction() {
    actionDone = true;
    completed.add(step.id);
    if (step.action?.advance === "auto" && armed) {
      const id = step.id;
      advanceTimer = setTimeout(() => {
        if (step.id === id) next();
      }, AUTO_ADVANCE_DELAY);
    }
  }

  function enterStep(current: TourStep) {
    clearTimeout(advanceTimer);
    clearTimeout(focusTimer);
    armed = false;
    actionDone = completed.has(current.id);
    check = current.action && !actionDone ? current.action.track() : null;

    const desktop = window.matchMedia(DESKTOP_QUERY).matches;
    if (current.sidebar) {
      isProjectTreeOpen.set(true);
    } else if (!desktop) {
      // На телефоне панель — оверлей и закрывает всё остальное.
      isProjectTreeOpen.set(false);
    }

    // Даём панели появиться (оверлей монтируется после смены стора).
    focusTimer = setTimeout(() => {
      const element = (current.targets ?? [])
        .map((name) =>
          document.querySelector<HTMLElement>(`[data-tour="${name}"]`),
        )
        .find(Boolean);
      element?.scrollIntoView({ block: "nearest", inline: "nearest" });

      if (current.keepFocus) return;
      if (current.action && !actionDone && element) {
        // С клавиатуры действие делается сразу: Enter на кнопке или набор текста.
        const focusable = element.matches(FOCUSABLE)
          ? element
          : element.querySelector<HTMLElement>(FOCUSABLE);
        focusable?.focus({ preventScroll: true });
      } else {
        nextButton?.focus({ preventScroll: true });
      }
    }, 80);
  }

  $effect(() => {
    const current = step;
    untrack(() => enterStep(current));
  });

  function next() {
    if (isLast) finish();
    else stepIndex += 1;
  }

  function back() {
    if (!isFirst) stepIndex -= 1;
  }

  function finish() {
    clearTimeout(advanceTimer);
    clearTimeout(focusTimer);
    markTourSeen();
    if (!window.matchMedia(DESKTOP_QUERY).matches) {
      isProjectTreeOpen.set(false);
    }
    isTourOpen.set(false);
  }

  /** Клик мимо окна: тур не закрываем, а покачиваем подсказкой. */
  function nudge() {
    nudging = false;
    requestAnimationFrame(() => (nudging = true));
  }

  function handleKeydown(event: KeyboardEvent) {
    if (suspended || event.defaultPrevented) return;
    if (event.key === "Escape") {
      finish();
      return;
    }
    // Стрелки — только когда фокус в подсказке: иначе они нужны редактору и меню.
    if (!popoverEl?.contains(document.activeElement)) return;
    if (event.key === "ArrowRight" && !waitingForAction) {
      event.preventDefault();
      next();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      back();
    }
  }

  onMount(() => {
    let frame = 0;
    const loop = () => {
      update();
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(advanceTimer);
      clearTimeout(focusTimer);
    };
  });

  const titleKey = $derived(`tour.step.${step.id}.title` as MessageKey);
  const textKey = $derived(`tour.step.${step.id}.text` as MessageKey);
</script>

<svelte:window onkeydown={handleKeydown} />

<div bind:this={root} class="tour-layer" class:is-suspended={suspended}>
  <!-- Затемнение: тень от «окна» вокруг цели или сплошной слой без цели -->
  {#if spot}
    <div
      class="tour-spot"
      class:is-action={waitingForAction}
      style="left:{spot.left}px;top:{spot.top}px;width:{spot.width}px;height:{spot.height}px"
      aria-hidden="true"
    ></div>
    <!-- Блокеры вокруг окна: клики по самому окну доходят до интерфейса -->
    <div
      class="tour-blocker"
      style="left:0;top:0;width:100%;height:{spot.top}px"
      onclick={nudge}
      aria-hidden="true"
    ></div>
    <div
      class="tour-blocker"
      style="left:0;top:{spot.top + spot.height}px;width:100%;bottom:0"
      onclick={nudge}
      aria-hidden="true"
    ></div>
    <div
      class="tour-blocker"
      style="left:0;top:{spot.top}px;width:{spot.left}px;height:{spot.height}px"
      onclick={nudge}
      aria-hidden="true"
    ></div>
    <div
      class="tour-blocker"
      style="left:{spot.left +
        spot.width}px;top:{spot.top}px;right:0;height:{spot.height}px"
      onclick={nudge}
      aria-hidden="true"
    ></div>
  {:else}
    <div
      class="tour-blocker tour-dim"
      style="inset:0"
      onclick={nudge}
      aria-hidden="true"
    ></div>
  {/if}

  {#if badge && action}
    <div
      class="tour-badge"
      data-side={badge.side}
      style="left:{badge.left}px;top:{badge.top}px"
      bind:offsetWidth={badgeSize.width}
      bind:offsetHeight={badgeSize.height}
      aria-hidden="true"
    >
      {#if action.hint === "type"}
        <PenLine size={14} />
        {$t("tour.hint.type")}
      {:else}
        <MousePointerClick size={14} />
        {$t("tour.hint.click")}
      {/if}
    </div>
  {/if}

  <div
    bind:this={popoverEl}
    class="tour-popover"
    class:is-sheet={isSheet}
    class:is-nudging={nudging}
    style={popoverStyle}
    role="dialog"
    aria-modal="false"
    aria-label={$t("tour.title")}
    aria-describedby="tour-step-text"
    bind:offsetWidth={popoverSize.width}
    bind:offsetHeight={popoverSize.height}
    onanimationend={() => (nudging = false)}
  >
    {#if arrowSide}
      <span
        class="tour-arrow"
        data-side={arrowSide}
        style={arrowSide === "top" || arrowSide === "bottom"
          ? `left:${placement.arrow}px`
          : `top:${placement.arrow}px`}
        aria-hidden="true"
      ></span>
    {/if}

    {#key step.id}
      <div class="tour-popover-body">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="tour-progress">
              {$t("tour.progress", {
                current: stepIndex + 1,
                total: steps.length,
              })}
            </p>
            <h3 class="tour-title">{$t(titleKey)}</h3>
          </div>
          <button
            type="button"
            class="icon-btn -mr-1.5 -mt-1"
            aria-label={$t("tour.close")}
            title={$t("tour.close")}
            onclick={finish}
          >
            <X size={15} />
          </button>
        </div>

        <p id="tour-step-text" class="tour-text">{$t(textKey)}</p>

        {#if action && actionDone}
          <p class="tour-done" role="status">
            <Check size={14} />
            {$t("tour.actionDone")}
          </p>
        {/if}
      </div>
    {/key}

    <div
      class="tour-meter"
      role="progressbar"
      aria-label={$t("tour.title")}
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-valuenow={stepIndex + 1}
    >
      <span style="width:{((stepIndex + 1) / steps.length) * 100}%"></span>
    </div>

    <div class="tour-actions">
      {#if isFirst}
        <button type="button" class="btn btn-ghost btn-sm" onclick={finish}>
          {$t("tour.skip")}
        </button>
      {:else}
        <button type="button" class="btn btn-ghost btn-sm" onclick={back}>
          {$t("tour.back")}
        </button>
      {/if}
      {#if waitingForAction}
        <button
          bind:this={nextButton}
          type="button"
          class="btn btn-outline btn-sm"
          onclick={next}
        >
          {$t("tour.skipStep")}
        </button>
      {:else}
        <button
          bind:this={nextButton}
          type="button"
          class="btn btn-primary btn-sm"
          onclick={next}
        >
          {isLast ? $t("tour.done") : $t("tour.next")}
        </button>
      {/if}
    </div>
  </div>
</div>
