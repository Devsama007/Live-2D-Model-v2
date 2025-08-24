// src/useLive2DControls.js
import { useEffect } from "react";

export function useLive2DControls(model, app) {
  useEffect(() => {
    if (!model || !app) return;

    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    // ✅ Scroll zoom
    const onWheel = (e) => {
      e.preventDefault();
      const scaleAmount = e.deltaY < 0 ? 1.1 : 0.9;
      model.scale.set(model.scale.x * scaleAmount, model.scale.y * scaleAmount);
    };

    // ✅ Drag to pan
    const onMouseDown = (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      model.x += dx;
      model.y += dy;
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    // ✅ Attach listeners
    const view = app.view;
    view.addEventListener("wheel", onWheel, { passive: false });
    view.addEventListener("mousedown", onMouseDown);
    view.addEventListener("mousemove", onMouseMove);
    view.addEventListener("mouseup", onMouseUp);
    view.addEventListener("mouseleave", onMouseUp);

    // ✅ Cleanup
    return () => {
      view.removeEventListener("wheel", onWheel);
      view.removeEventListener("mousedown", onMouseDown);
      view.removeEventListener("mousemove", onMouseMove);
      view.removeEventListener("mouseup", onMouseUp);
      view.removeEventListener("mouseleave", onMouseUp);
    };
  }, [model, app]);
}
