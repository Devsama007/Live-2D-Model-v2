import { cleanup } from "@testing-library/react";

// useLive2DMotions.jsx
export function useLive2DMotions(model, app, motions) {
  if (!model || !app) return { playMotion: () => { } };

  function playMotion(motionKey) {
    const sequence = motions[motionKey];
    if (!sequence) return;

    console.log("🎬 Playing motion:", motionKey);

    let step = 0;

    function runStep() {
      if (step >= sequence.length) return;

      const { id, from, to, duration } = sequence[step];
      let startTime = Date.now();

      function animate() {
        const now = Date.now();
        const t = Math.min((now - startTime) / duration, 1);
        const value = from + (to - from) * t;

        model.internalModel.coreModel.setParameterValueById(id, value);
        model.internalModel.coreModel.update();

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          step++;
          runStep(); // go to next part of sequence
        }
      }

      animate();
    }

    runStep();
  }

  const keyToMotion = {
    a: "tiltHead",
    b: "blinkLeft",
    c: "blinkRight",
    d: "eyebrowUp",
    e: "angryBrow",
    f: "smile",
    g: "chinMove",
    h: "swayBody",
    i: "nodHead",
    j: "mouthOpenY",
    k: "breath",
  };

  const handleKey = (e) => {
    const motionKey = keyToMotion[e.key]; // ✅ case-sensitive, lowercase only
    if (motionKey) {
      playMotion(motionKey);
    }
  };

  window.addEventListener("keydown", handleKey);

  return {
    playMotion,
    cleanup: () => {
      window.removeEventListener("keydown", handleKey);
    },
  };
}
