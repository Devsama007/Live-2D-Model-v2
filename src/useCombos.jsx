// useCombos.jsx
import { useEffect, useState } from "react";
import { combos } from "./combosMap";

export function useCombos(model, cursorRef) {
  const [isComboPlaying, setIsComboPlaying] = useState(false);

  useEffect(() => {
    if (!model) return;

    function lerpMotion(step) {
      return new Promise((resolve) => {
        const start = performance.now();
        const from = step.from ?? model.internalModel.coreModel.getParameterValueById(step.id);
        const to = step.to ?? step.value;

        function animate(time) {
          const elapsed = time - start;
          const t = Math.min(elapsed / step.duration, 1); // normalize 0 → 1
          const current = from + (to - from) * t;

          model.internalModel.coreModel.setParameterValueById(step.id, current);

          if (t < 1) {
            requestAnimationFrame(animate);
          } else {
            resolve();
          }
        }

        requestAnimationFrame(animate);
      });
    }

    async function playCombo(comboKey) {
      const combo = combos[comboKey];
      if (!combo) return;

      console.log("🎭 Combo triggered:", comboKey, combo.name);

      // ✅ Disable cursor tracking when combo starts
      setIsComboPlaying(true);
      if (cursorRef) {
        cursorRef.current.isEnabled = false;
      }

      try {
        // apply static expressions instantly
        if (combo.expressions) {
          combo.expressions.forEach(exp => {
            model.internalModel.coreModel.setParameterValueById(exp.id, exp.value);
          });
        }

        // play motions sequentially with smooth tween
        if (combo.motions && combo.motions.length > 0) {
          for (const step of combo.motions) {
            await lerpMotion(step);
          }
        }
      } finally {
        // ✅ Re-enable cursor tracking when combo finishes
        setIsComboPlaying(false);
        if (cursorRef) {
          cursorRef.current.isEnabled = true;
        }
      }
    }

    // 🔑 Handle key input
    const handleKey = (e) => {
      // Don't trigger new combos while one is already playing
      if (isComboPlaying) return;
      
      const key = e.key;
      if (combos[key]) {
        playCombo(key);
      }
    };

    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [model, cursorRef, isComboPlaying]); // Add dependencies

  return { isComboPlaying };
}