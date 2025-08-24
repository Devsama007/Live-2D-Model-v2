import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display/cubism4";

// Create app
const app = new PIXI.Application();
await app.init({
  autoStart: true,
  backgroundAlpha: 0,
  resizeTo: window,
});

// ✅ Use PIXI’s shared ticker
const ticker = PIXI.Ticker.shared;
ticker.autoStart = true;

// Register with Live2DModel BEFORE loading
Live2DModel.registerTicker(ticker);

export default app;


