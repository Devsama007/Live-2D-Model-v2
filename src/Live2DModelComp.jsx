// src/Live2DModelComp.jsx
import React, { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display/cubism4";
import { useLive2DExpressions } from "./useLive2DExpressions";
import { expressions } from "./expressionsMap";
import { motions } from "./motionsMap";
import { useLive2DMotions } from "./useLive2DMotions";
import FaceTracker from "./FaceTracker";
import { useCombos } from "./useCombos";
import { io } from "socket.io-client";

export default function Live2DModelComp() {
  const canvasRef = useRef();
  const [model, setModel] = useState(null);
  const [app, setApp] = useState(null);
  
  // ✅ Use useRef for cursor tracking (no re-renders)
  const cursorRef = useRef({ x: 0, y: 0, isEnabled: true });

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

      const modelInstance = await Live2DModel.from("/models/Hoshino_Ai/Hoshino_Ai.model3.json", { autoUpdate: false });
      modelInstance.anchor.set(0.5, 0.5);
      modelInstance.scale.set(0.5);
      modelInstance.position.set(window.innerWidth / 2, window.innerHeight / 2 + 1200);

      pixiApp.stage.addChild(modelInstance);

      const motionSpeed = 10;

      // ✅ Single ticker - reads from ref (no React re-renders)
      pixiApp.ticker.add((delta) => {
        modelInstance.update(delta * motionSpeed);

        if (modelInstance.expressionManager) {
          modelInstance.expressionManager.update(modelInstance.internalModel.coreModel, delta);
        }

        // ✅ Apply cursor tracking from ref (super efficient)
        if (cursorRef.current.isEnabled && modelInstance.internalModel) {
          const coreModel = modelInstance.internalModel.coreModel;
          coreModel.setParameterValueById("ParamAngleX", cursorRef.current.x * 12);
          coreModel.setParameterValueById("ParamAngleY", cursorRef.current.y * -12);
          coreModel.setParameterValueById("ParamEyeBallX", cursorRef.current.x);
          coreModel.setParameterValueById("ParamEyeBallY", cursorRef.current.y * -1);
        }
      });

      setModel(modelInstance);
    }

    initLive2D().catch(console.error);
  }, []); // ✅ No dependencies - runs only once

  // ✅ Separate effect for mouse controls (runs only when model/app change)
  useEffect(() => {
    if (!model || !app) return;

    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    const onWheel = (e) => {
      e.preventDefault();
      const scaleAmount = e.deltaY < 0 ? 1.1 : 0.9;
      model.scale.set(model.scale.x * scaleAmount, model.scale.y * scaleAmount);
    };

    const onMouseDown = (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      cursorRef.current.isEnabled = false; // Disable cursor tracking while dragging
    };

    const onMouseMove = (e) => {
      if (isDragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        model.x += dx;
        model.y += dy;
        lastX = e.clientX;
        lastY = e.clientY;
      } else {
        // ✅ Update ref directly (no React re-render!)
        const rect = app.view.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const offsetX = (e.clientX - centerX) / (rect.width / 2);
        const offsetY = (e.clientY - centerY) / (rect.height / 2);
        
        cursorRef.current.x = Math.max(-1, Math.min(1, offsetX));
        cursorRef.current.y = Math.max(-1, Math.min(1, offsetY));
        cursorRef.current.isEnabled = true;
      }
    };

    const onMouseUp = () => {
      isDragging = false;
      cursorRef.current.isEnabled = true;
    };

    const resetLook = () => {
      cursorRef.current.x = 0;
      cursorRef.current.y = 0;
      cursorRef.current.isEnabled = true;
    };

    // Attach listeners
    const view = app.view;
    view.addEventListener("wheel", onWheel, { passive: false });
    view.addEventListener("mousedown", onMouseDown);
    view.addEventListener("mousemove", onMouseMove);
    view.addEventListener("mouseup", onMouseUp);
    view.addEventListener("mouseleave", onMouseUp);
    window.addEventListener("dblclick", resetLook);

    return () => {
      view.removeEventListener("wheel", onWheel);
      view.removeEventListener("mousedown", onMouseDown);
      view.removeEventListener("mousemove", onMouseMove);
      view.removeEventListener("mouseup", onMouseUp);
      view.removeEventListener("mouseleave", onMouseUp);
      window.removeEventListener("dblclick", resetLook);
    };
  }, [model, app]); // Only runs when model or app change

  const { playExpression } = useLive2DExpressions(model, app, expressions) || {};
  const { playMotion } = useLive2DMotions(model, app, motions);
  
  // ✅ Pass cursorRef to useCombos so it can disable cursor tracking during combos
  const { isComboPlaying } = useCombos(model, cursorRef) || {};

  // AI INTEGRATION
  useEffect(() => {
    if (!model) return;

    const socket = io("http://localhost:5000");
    socket.emit("chatMessage", "Hello Gemma!");

    socket.on("aiReply", (msg) => {
      console.log("AI JSON:", msg);
      const replyText = msg.reply || "...";
      const expKey = msg.expression || "neutral";
      const motionKey = msg.motion || "mouthOpenY";

      playExpression(expressions[expKey], expKey);
      playMotion(motionKey);
    });

    return () => socket.disconnect();
  }, [model]);

  return (
    <>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      {/* <FaceTracker onFaceData={setFaceData} debug={true} /> */}
    </>
  );
}