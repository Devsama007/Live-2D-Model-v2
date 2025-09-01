// src/FaceTracker.jsx
import React, { useEffect, useRef } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";

export default function FaceTracker({ onFaceData }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const faceMesh = new FaceMesh({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults((results) => {
      if (!results.multiFaceLandmarks || !onFaceData) return;

      const landmarks = results.multiFaceLandmarks[0];
      const nose = landmarks[1]; // nose tip
      const leftEye = landmarks[33]; 
      const rightEye = landmarks[263];

      const headX = (nose.x - 0.5) * -60;
      const headY = (nose.y - 0.5) * -60;
      const eyeX = ((leftEye.x + rightEye.x) / 2 - 0.5) * -4;
      const eyeY = ((leftEye.y + rightEye.y) / 2 - 0.5) * -4;

      onFaceData({ headX, headY, eyeX, eyeY });
    });

    if (videoRef.current) {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          await faceMesh.send({ image: videoRef.current });
        },
        width: 640,
        height: 480,
      });
      camera.start();
    }
  }, [onFaceData]);

  return (
    <video
      ref={videoRef}
      style={{ display: "none" }}
      autoPlay
      playsInline
      muted
    />
  );
}
