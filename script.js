(() => {
  "use strict";

  const INITIALIZED_FLAG = "wheelInitialized";

  function waitForNextFrame() {
    return new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }

  function getMaxScrollLeft(scroller) {
    return Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  }

  function moveToRight(scroller) {
    const maxScrollLeft = getMaxScrollLeft(scroller);

    if (maxScrollLeft > 0) {
      scroller.scrollLeft = maxScrollLeft;
    }
  }

  function getLineHeight() {
    const element = document.querySelector(".content") || document.body;

    const style = getComputedStyle(element);
    const fontSize = parseFloat(style.fontSize) || 16;
    const parsedLineHeight = parseFloat(style.lineHeight);

    return Number.isFinite(parsedLineHeight)
      ? parsedLineHeight
      : fontSize * 1.5;
  }

  function isNormalNavigation() {
    // 一般進入頁面時才自動定位。
    // 重新整理及歷史返回時，保留瀏覽器的捲動還原行為。
    if (
      !window.performance ||
      typeof window.performance.getEntriesByType !== "function"
    ) {
      return true;
    }

    const navigationEntry =
      window.performance.getEntriesByType("navigation")[0];

    // 無法取得導覽資訊時，退回原本的初次定位行為。
    return !navigationEntry || navigationEntry.type === "navigate";
  }

  function canPositionInitially(state) {
    return state.allowInitialPosition && !state.userInteracted;
  }

  async function positionInitially(scroller, state) {
    // 等待 HTML、CSS 完成基本版面計算。
    await waitForNextFrame();
    await waitForNextFrame();

    if (!canPositionInitially(state)) {
      return;
    }

    moveToRight(scroller);

    // 字型載入完成後，若使用者尚未操作，再校正一次。
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;

        if (canPositionInitially(state)) {
          moveToRight(scroller);
        }
      } catch {
        // 字型載入失敗時，不影響其他功能。
      }
    }
  }

  function init() {
    const root = document.documentElement;

    // 避免 script.js 重複載入時註冊多個事件。
    if (root.dataset[INITIALIZED_FLAG] === "true") {
      return;
    }

    const scroller = document.scrollingElement;

    // 尚未取得捲動元素時，不設定初始化標記。
    if (!scroller) {
      return;
    }

    root.dataset[INITIALIZED_FLAG] = "true";

    const state = {
      userInteracted: false,
      allowInitialPosition: isNormalNavigation() && !window.location.hash,
    };

    function markAsInteracted() {
      state.userInteracted = true;
    }

    document.addEventListener("pointerdown", markAsInteracted, {
      once: true,
      passive: true,
    });

    document.addEventListener("touchstart", markAsInteracted, {
      once: true,
      passive: true,
    });

    document.addEventListener("keydown", markAsInteracted, {
      once: true,
      passive: true,
    });

    document.addEventListener(
      "wheel",
      (event) => {
        // 不論是橫向或垂直滾輪，都視為使用者已開始操作。
        // 必須放在各種 return 判斷之前。
        if (event.deltaX !== 0 || event.deltaY !== 0) {
          markAsInteracted();
        }

        // 保留瀏覽器縮放及修飾鍵操作。
        if (
          event.defaultPrevented ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.shiftKey
        ) {
          return;
        }

        // 明顯的橫向手勢交給瀏覽器原生處理。
        if (
          event.deltaY === 0 ||
          Math.abs(event.deltaX) >= Math.abs(event.deltaY)
        ) {
          return;
        }

        // 無法取消的事件不能轉換。
        if (!event.cancelable) {
          return;
        }

        // 沒有橫向溢出時，不介入瀏覽器行為。
        if (scroller.scrollWidth <= scroller.clientWidth + 1) {
          return;
        }

        let distance = event.deltaY;

        // DOM_DELTA_LINE：以行為單位。
        if (event.deltaMode === 1) {
          distance *= getLineHeight();
        }

        // DOM_DELTA_PAGE：以頁面寬度為單位。
        else if (event.deltaMode === 2) {
          distance *= scroller.clientWidth;
        }

        if (!Number.isFinite(distance) || distance === 0) {
          return;
        }

        const previousScrollLeft = scroller.scrollLeft;

        // 滑鼠向下滾，直排內容向左閱讀。
        scroller.scrollLeft -= distance;

        // 只有確實發生橫向移動時，
        // 才取消瀏覽器原生垂直捲動。
        if (scroller.scrollLeft !== previousScrollLeft) {
          event.preventDefault();
        }
      },
      { passive: false },
    );

    // 從往返快取還原時，保留原本的閱讀位置，
    // 並停止可能尚未完成的非同步定位。
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        state.allowInitialPosition = false;
      }
    });

    // 只有一般進入頁面時，才執行初次定位。
    if (state.allowInitialPosition) {
      void positionInitially(scroller, state);
    }

    // 所有資源載入完成後，視情況補一次定位。
    window.addEventListener(
      "load",
      () => {
        if (canPositionInitially(state)) {
          moveToRight(scroller);
        }
      },
      { once: true },
    );
  }

  init();
})();
