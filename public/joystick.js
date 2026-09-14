(() => {
  function createJoystick(element, options) {
    const onDirection = options.onDirection || function () {};
    const onEnd = options.onEnd || function () {};
    const deadzone = options.deadzone == null ? 0.22 : options.deadzone;
    const stick = element.querySelector(".joystick-stick");
    if (!stick) {
      throw new Error("joystick requires .joystick-stick");
    }

    let pointerId = null;
    let current = null;
    let enabled = true;

    function setEnabled(value) {
      enabled = Boolean(value);
      element.classList.toggle("is-disabled", !enabled);
      element.setAttribute("aria-disabled", enabled ? "false" : "true");
      if (!enabled) {
        pointerId = null;
        current = null;
        resetStick();
      }
    }

    function resetStick() {
      stick.style.transform = "translate(-50%, -50%)";
      element.classList.remove(
        "is-active",
        "dir-forward",
        "dir-backward",
        "dir-left",
        "dir-right",
      );
    }

    function directionFrom(nx, ny) {
      const magnitude = Math.hypot(nx, ny);
      if (magnitude < deadzone) return null;
      if (Math.abs(nx) > Math.abs(ny)) {
        return nx > 0 ? "right" : "left";
      }
      return ny > 0 ? "backward" : "forward";
    }

    function handle(clientX, clientY) {
      const rect = element.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const max = rect.width * 0.32;
      const mag = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(mag, max);
      dx = (dx / mag) * clamped;
      dy = (dy / mag) * clamped;
      stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const dir = directionFrom(dx / max, dy / max);
      element.classList.add("is-active");
      element.classList.toggle("dir-forward", dir === "forward");
      element.classList.toggle("dir-backward", dir === "backward");
      element.classList.toggle("dir-left", dir === "left");
      element.classList.toggle("dir-right", dir === "right");
      if (dir !== current) {
        current = dir;
        if (dir) onDirection(dir);
        else onEnd();
      }
    }

    function onPointerDown(event) {
      if (!enabled) return;
      if (pointerId != null) return;
      pointerId = event.pointerId;
      element.setPointerCapture(pointerId);
      event.preventDefault();
      handle(event.clientX, event.clientY);
    }

    function onPointerMove(event) {
      if (event.pointerId !== pointerId) return;
      event.preventDefault();
      handle(event.clientX, event.clientY);
    }

    function onPointerUp(event) {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      current = null;
      resetStick();
      onEnd();
    }

    function onContextMenu(event) {
      event.preventDefault();
    }

    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointercancel", onPointerUp);
    element.addEventListener("contextmenu", onContextMenu);
    resetStick();
    setEnabled(true);

    return {
      setEnabled,
      destroy() {
        element.removeEventListener("pointerdown", onPointerDown);
        element.removeEventListener("pointermove", onPointerMove);
        element.removeEventListener("pointerup", onPointerUp);
        element.removeEventListener("pointercancel", onPointerUp);
        element.removeEventListener("contextmenu", onContextMenu);
      },
    };
  }

  window.createTeleJoystick = createJoystick;
})();
