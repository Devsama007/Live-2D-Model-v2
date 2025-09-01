// src/useLive2DCursorTracking.js
import { useEffect } from "react";

export function useLive2DCursorTracking(model, app) {
  useEffect(() => {
    if (!model || !app) return;

    let isDragging = false;
    let target = { x: 0, y: 0 }; // where the eyes want to look
    let lastMove = Date.now();

    const view = app.view;
    view.addEventListener("mousedown", () => (isDragging = true));
    view.addEventListener("mouseup", () => (isDragging = false));
    view.addEventListener("mouseleave", () => (isDragging = false));

    app.stage.interactive = true;
    app.stage.on("pointermove", (e) => {
      if (isDragging) return;

      const pos = e.data.global;
      target.x = (pos.x / app.renderer.width) * 2 - 1;
      target.y = (pos.y / app.renderer.height) * 2 - 1;
      lastMove = Date.now();
    });

    app.ticker.add(() => {
      if (!model) return;
      const core = model.internalModel.coreModel;

      // after 2s idle, reset target to 0
      if (Date.now() - lastMove > 2000 && !isDragging) {
        target.x = 0;
        target.y = 0;
      }

      // smooth interpolation each frame
      const currentX = core.getParameterValueById("ParamAngleX");
      const currentY = core.getParameterValueById("ParamAngleY");
      const currentEyeX = core.getParameterValueById("ParamEyeBallX");
      const currentEyeY = core.getParameterValueById("ParamEyeBallY");

      const lerp = (a, b, t) => a + (b - a) * t;

      const newAngleX = lerp(currentX, target.x * 30, 0.1);
      const newAngleY = lerp(currentY, -target.y * 30, 0.1);
      const newEyeX = lerp(currentEyeX, target.x, 0.15);
      const newEyeY = lerp(currentEyeY, -target.y, 0.15);

      core.setParameterValueById("ParamAngleX", newAngleX);
      core.setParameterValueById("ParamAngleY", newAngleY);
      core.setParameterValueById("ParamEyeBallX", newEyeX);
      core.setParameterValueById("ParamEyeBallY", newEyeY);
    });
  }, [model, app]);
}
