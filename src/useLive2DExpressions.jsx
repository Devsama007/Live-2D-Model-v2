// src/useLive2DExpressions.js
import { CubismExpressionMotion } from "pixi-live2d-display/cubism4";

export function useLive2DExpressions(model, app, expressions) {
  if (!model || !app) return;

  let resetTimeout = null;

  // 🔹 param mapping for "force mode"
  const forceMap = {
    happy: [
      { id: "Param11", value: 30.0 }
    ],
    angry: [
      { id: "Param17", value: 30.0 }
    ],
    mouthY: [
      { id: "ParamMouthOpenY", value: 30.0 }
    ],
    tongue: [
      { id: "Param19", value: 30.0 }
    ],
    bleed: [
      { id: "Param16", value: 30.0 }
    ],
    pose1: [
      { id: "Param43", value: 30.0 }
    ],
    pose2: [
      { id: "Param44", value: 30.0 }
    ],
    cry: [
      { id: "Param22", value: 30.0 }
    ]
  };

  function forceExpression(expKey) {
    const params = forceMap[expKey];
    if (!params) return false;

    const coreModel = model.internalModel.coreModel;
    params.forEach(p => coreModel.setParameterValueById(p.id, p.value));
    console.log("💪 Forced param expression:", expKey);

    return true;
  }

  function resetForced() {
    const coreModel = model.internalModel.coreModel;
    Object.values(forceMap).flat().forEach(p => {
      coreModel.setParameterValueById(p.id, 0.0);
    });
    console.log("🔄 Reset forced params");
  }

  async function playExpression(expFile, expKey) {
    if (!expFile) return;

    // 1️⃣ First try force-map
    const forced = forceExpression(expKey);

    if (!forced) {
      // 2️⃣ If no force-map, fallback to exp3.json
      try {
        const expData = await fetch(expFile).then((res) => res.json());
        const expression = CubismExpressionMotion.create(expData);

        model.expressionManager?.setExpression(expression);

        console.log("✅ Expression applied:", expFile, "as", expKey);
      } catch (e) {
        console.error("❌ Failed to load expression:", expFile, e);
      }
    }

    // Reset after 3s
    if (resetTimeout) clearTimeout(resetTimeout);
    resetTimeout = setTimeout(() => {
      if (forced) {
        resetForced();
      } else {
        model.expressionManager?.setExpression(null);
      }
    }, 6000);
  }

  let keys = Object.keys(expressions);
  let current = 0;

  const handleKey = (e) => {
    switch (e.key) {
      case "1":
        playExpression(expressions.happy, "happy");
        console.log("▶ Triggered expression: happy");
        break;
      case "2":
        playExpression(expressions.angry, "angry");
        console.log("▶ Triggered expression: angry");
        break;
      case "3":
        playExpression(expressions.mouthY, "mouthY");
        console.log("▶ Triggered expression: mouthY");
        break;
      case "4":
        playExpression(expressions.tongue, "tongue");
        console.log("▶ Triggered expression: tongue");
        break;
      case "5":
        playExpression(expressions.bleed, "bleed");
        console.log("▶ Triggered expression: bleed");
        break;
      case "6":
        playExpression(expressions.pose1, "pose1");
        console.log("▶ Triggered expression: pose1");
        break;
      case "7":
        playExpression(expressions.pose2, "pose2");
        console.log("▶ Triggered expression: pose2");
        break;
      case "8":
        playExpression(expressions.cry, "cry");
        console.log("▶ Triggered expression: cry");
        break;
      case "0":
        resetForced();
        model.expressionManager?.setExpression(null);
        console.log("🔄 Manual reset triggered");
        break;
      default:
        break;
    }
  };


  window.addEventListener("keydown", handleKey);

  return () => {
    window.removeEventListener("keydown", handleKey);
    if (resetTimeout) clearTimeout(resetTimeout);
  };
}
