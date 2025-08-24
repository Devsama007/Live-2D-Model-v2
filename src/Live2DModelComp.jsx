// src/Live2DModelComp.jsx
import React, { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display/cubism4";
import { useLive2DControls } from "./useLive2DControls";
// import { useLive2DCursorTracking } from "./useLive2DCursorTracking";

import { useLive2DExpressions } from "./useLive2DExpressions";
import { expressions } from "./expressionsMap";
import { motions } from "./motionsMap";
import { useLive2DMotions } from "./useLive2DMotions";

import { useCombos } from "./useCombos";

export default function Live2DModelComp() {
  const canvasRef = useRef();
  const [model, setModel] = useState(null);
  const [app, setApp] = useState(null);

  useEffect(() => {
    async function initLive2D() {
      if (!window.Live2DCubismCore) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "/live2dcubismcore.min.js";
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      const pixiApp = new PIXI.Application({
        view: canvasRef.current,
        autoStart: true,
        backgroundAlpha: 0,
        resizeTo: window,
      });
      setApp(pixiApp);

      const modelInstance = await Live2DModel.from("/models/Hoshino_Ai/Hoshino_Ai.model3.json");
      modelInstance.anchor.set(0.5, 0.5);
      modelInstance.scale.set(0.5);

      // place at center, then shift upward
      modelInstance.position.set(window.innerWidth / 2, window.innerHeight / 2 + 1000);

      pixiApp.stage.addChild(modelInstance);

      const motionSpeed = 10;

      pixiApp.ticker.add((delta) => {
        modelInstance.update(delta * motionSpeed);

        if (modelInstance.expressionManager) {
          modelInstance.expressionManager.update(modelInstance.internalModel.coreModel, delta);
        }

      });

      setModel(modelInstance);
    }

    initLive2D().catch(console.error);
  }, []);

  // ✅ Attach zoom + pan controls
  useLive2DControls(model, app);   // ✅ Zoom + pan

  // useLive2DCursorTracking(model);   // ✅ Cursor tracking

  useLive2DExpressions(model, app, expressions);

  useLive2DMotions(model, app, motions);

  useCombos(model);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}
