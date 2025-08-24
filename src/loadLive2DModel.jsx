import { Live2DModel } from "pixi-live2d-display/cubism4";
import app from "./pixiApp";

export async function loadLive2DModel(modelPath) {
  // Ensure Cubism Core is loaded
  if (!window.Live2DCubismCore) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/live2dcubismcore.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  // Register PIXI ticker for Live2D
  Live2DModel.registerTicker(app.ticker);

  const model = await Live2DModel.from(modelPath);

  // Center + scale to screen
  model.anchor.set(0.5, 0.5);
  fitToScreen(model);

  window.addEventListener("resize", () => fitToScreen(model));

  return model;
}

function fitToScreen(model) {
  // Scale model to fit the screen height
  const scale =
    Math.min(app.renderer.width / model.width, app.renderer.height / model.height) *
    0.6;
  model.scale.set(scale);

  // Place model at bottom center
  const centerX = app.renderer.width / 2;
  const bottomY = app.renderer.height; // push base of model to bottom edge

  model.position.set(centerX, bottomY);

  // Now shift the whole stage upwards to focus on upper body
  // This works like a "camera move"
  app.stage.y = -model.height * 0.25; // move camera up (25% of height)
}




