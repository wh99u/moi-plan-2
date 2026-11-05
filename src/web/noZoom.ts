/**
 * The site is an app, not a page to enlarge. iPhones ignore `user-scalable=no` in the viewport tag,
 * so the two-finger gesture is refused here as well. Screens with a pinch of their own still get it:
 * they listen lower down, and this only stops the browser from acting on it.
 */
export function stopPageZoom() {
  const refuse = (e: Event) => e.preventDefault();
  document.addEventListener('gesturestart', refuse, { passive: false });
  document.addEventListener('gesturechange', refuse, { passive: false });
  document.addEventListener('gestureend', refuse, { passive: false });
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1 && e.cancelable) e.preventDefault();
    },
    { passive: false },
  );
  // Ctrl with the wheel, or a trackpad's pinch, on a computer.
  document.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) e.preventDefault();
    },
    { passive: false },
  );
}

/**
 * An iPhone keeps the page where the keyboard pushed it, with everything fixed on screen now out of
 * place. The page is put back when the keyboard goes, and while it is up the screen knows how much
 * room it took, so a sheet can stand on top of it.
 */
export function followKeyboard() {
  const editing = () => {
    const el = document.activeElement;
    return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
  };
  const vv = window.visualViewport;
  if (vv) {
    const update = () => {
      const taken = editing() ? Math.max(0, Math.round(innerHeight - vv.height)) : 0;
      document.documentElement.style.setProperty('--kb', `${taken}px`);
    };
    vv.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', () => setTimeout(update, 80));
  }
  document.addEventListener('focusout', () => {
    setTimeout(() => {
      if (!editing()) scrollTo(0, 0);
    }, 80);
  });
}
