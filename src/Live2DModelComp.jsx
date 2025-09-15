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
// ✅ FIXED: Correct import
import io from "socket.io-client";

// Import components
import AnnieStats from "./components/AnnieStats";
import ChatInterface from "./components/ChatInterface";

export default function Live2DModelComp() {
  const canvasRef = useRef();
  const [model, setModel] = useState(null);
  const [app, setApp] = useState(null);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Use useRef for cursor tracking (no re-renders)
  const cursorRef = useRef({ x: 0, y: 0, isEnabled: true });
  
  // ✅ Ref to prevent multiple socket connections
  const socketInitialized = useRef(false);

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

      pixiApp.ticker.add((delta) => {
        modelInstance.update(delta * motionSpeed);

        if (modelInstance.expressionManager) {
          modelInstance.expressionManager.update(modelInstance.internalModel.coreModel, delta);
        }

        if (cursorRef.current.isEnabled && !isComboPlaying && modelInstance.internalModel) {
          const coreModel = modelInstance.internalModel.coreModel;
          coreModel.setParameterValueById("ParamAngleX", cursorRef.current.x * 8);
          coreModel.setParameterValueById("ParamAngleY", cursorRef.current.y * -8);
          coreModel.setParameterValueById("ParamEyeBallX", cursorRef.current.x);
          coreModel.setParameterValueById("ParamEyeBallY", cursorRef.current.y * -1);
        }
      });

      setModel(modelInstance);
    }

    initLive2D().catch(console.error);
  }, []);

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
      cursorRef.current.isEnabled = false;
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
  }, [model, app]);

  const { playExpression } = useLive2DExpressions(model, app, expressions) || {};
  const { playMotion } = useLive2DMotions(model, app, motions);
  const { isComboPlaying } = useCombos(model, cursorRef) || {};

  // ✅ FIXED: Initialize Socket.IO connection ONCE
  useEffect(() => {
    // Prevent multiple socket connections
    if (socketInitialized.current) return;
    socketInitialized.current = true;
    
    console.log('🔌 Initializing Socket.IO connection...');
    
    const newSocket = io("http://localhost:5000", {
      // Force polling first (most stable)
      transports: ['polling', 'websocket'],
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 3,
      forceNew: true,
      upgrade: true
    });

    // Connection events
    newSocket.on("connect", () => {
      console.log("✅ Connected to Annie:", newSocket.id);
      setIsConnected(true);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("❌ Disconnected:", reason);
      setIsConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      console.error("🔴 Connection error:", error);
      setIsConnected(false);
    });

    newSocket.on("reconnect", (attemptNumber) => {
      console.log("🔄 Reconnected after", attemptNumber, "attempts");
      setIsConnected(true);
    });

    setSocket(newSocket);

    // ✅ Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up socket');
      socketInitialized.current = false;
      newSocket.removeAllListeners();
      newSocket.disconnect();
    };
  }, []); // ✅ Empty dependencies - run only once

  // ✅ Handle AI events separately (only when socket exists)
  useEffect(() => {
    if (!socket || !playExpression || !playMotion) return;

    const handleAiReply = (msg) => {
      console.log("💬 Annie replied:", msg);

      const expKey = msg.expression || "neutral";
      const motionKey = msg.motion || "idle";

      if (expressions[expKey]) {
        playExpression(expressions[expKey], expKey);
      }
      
      playMotion(motionKey);
    };

    const handleProactiveMessage = (msg) => {
      console.log("🤖 Annie initiated:", msg);
      
      if (expressions[msg.expression]) {
        playExpression(expressions[msg.expression], msg.expression);
      }
      
      playMotion(msg.motion);
    };

    // Add event listeners
    socket.on("aiReply", handleAiReply);
    socket.on("proactiveMessage", handleProactiveMessage);

    // Cleanup listeners
    return () => {
      socket.off("aiReply", handleAiReply);
      socket.off("proactiveMessage", handleProactiveMessage);
    };
  }, [socket, playExpression, playMotion]); // Dependencies for AI events only

  return (
    <>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      
      {/* Simple connection indicator */}
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        padding: '8px 16px',
        borderRadius: '20px',
        fontSize: '14px',
        fontWeight: 'bold',
        zIndex: 1000,
        background: isConnected ? '#4CAF50' : '#F44336',
        color: 'white',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
      }}>
        {isConnected ? '✅ Annie Online' : '❌ Connecting...'}
      </div>
      
      {/* Pass socket to components */}
      <AnnieStats socket={socket} />
      <ChatInterface socket={socket} />
      
      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'fixed',
          bottom: '10px',
          left: '10px',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: 'monospace'
        }}>
          <div>Socket: {socket ? (isConnected ? 'Connected' : 'Disconnected') : 'Not initialized'}</div>
          <div>Model: {model ? 'Loaded' : 'Loading...'}</div>
        </div>
      )}
    </>
  );
}