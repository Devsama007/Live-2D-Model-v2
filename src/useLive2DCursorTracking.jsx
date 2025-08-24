import { useEffect } from "react";

export function useLive2DCursorTracking(model) {
  useEffect(() => {
    if (!model) return;

    let targetX = 0;
    let targetY = 0;
    let smoothX = 0;
    let smoothY = 0;

    const handleMouseMove = (e) => {
      targetX = (e.clientX / window.innerWidth) * 2 - 1; // range -1..1
      targetY = (e.clientY / window.innerHeight) * 2 - 1;
    };

    const updateTracking = () => {
      if (!model?.internalModel?.coreModel) return;
      const core = model.internalModel.coreModel;

      // Smooth motion (lerp toward target)
      smoothX += (targetX - smoothX) * 0.1;
      smoothY += (targetY - smoothY) * 0.1;

      // Head / body
      core.setParameterValueById("ParamAngleX", smoothX * 30);
      core.setParameterValueById("ParamAngleY", -smoothY * 30);
      core.setParameterValueById("ParamBodyAngleX", smoothX * 10);

      // Eyes
      core.setParameterValueById("ParamEyeBallX", smoothX);
      core.setParameterValueById("ParamEyeBallY", -smoothY);

      requestAnimationFrame(updateTracking);
    };

    window.addEventListener("mousemove", handleMouseMove);
    updateTracking();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [model]);
}
