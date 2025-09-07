import { jsxDEV } from "react/jsx-dev-runtime";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { WebsimSocket, useQuery } from "@websim/use-query";
const room = new WebsimSocket();
const PIXEL_SIZE = 16;
const PLAYER_IMG_SRC = "player.png";
const PLAYER_SPEED = 2;
const getRandomColor = () => {
  return "hsl(" + 360 * Math.random() + "," + (25 + 70 * Math.random()) + "%," + (85 + 10 * Math.random()) + "%)";
};
const AnalogStick = ({ onMove }) => {
  const stickRef = useRef(null);
  const baseRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const radius = 50;
  const handleStart = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleMove = useCallback((e) => {
    if (!isDragging || !baseRef.current || !stickRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = baseRef.current.getBoundingClientRect();
    const baseX = rect.left + rect.width / 2;
    const baseY = rect.top + rect.height / 2;
    let dx = touch.clientX - baseX;
    let dy = touch.clientY - baseY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > radius) {
      dx = dx / distance * radius;
      dy = dy / distance * radius;
    }
    stickRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    onMove({ x: dx / radius, y: dy / radius });
  }, [isDragging, onMove, radius]);
  const handleEnd = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    setIsDragging(false);
    if (stickRef.current) {
      stickRef.current.style.transform = "translate(0,0)";
    }
    onMove({ x: 0, y: 0 });
  };
  useEffect(() => {
    const moveHandler = (e) => handleMove(e);
    const endHandler = (e) => handleEnd(e);
    window.addEventListener("touchmove", moveHandler, { passive: false });
    window.addEventListener("touchend", endHandler, { passive: false });
    window.addEventListener("touchcancel", endHandler, { passive: false });
    return () => {
      window.removeEventListener("touchmove", moveHandler);
      window.removeEventListener("touchend", endHandler);
      window.removeEventListener("touchcancel", endHandler);
    };
  }, [handleMove, isDragging]);
  return /* @__PURE__ */ jsxDEV("div", { id: "analog-stick-base", ref: baseRef, onTouchStart: handleStart, children: /* @__PURE__ */ jsxDEV("div", { id: "analog-stick-knob", ref: stickRef }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 80,
    columnNumber: 13
  }) }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 79,
    columnNumber: 9
  });
};
function App() {
  const canvasRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [player, setPlayer] = useState({ x: 10 * PIXEL_SIZE, y: 10 * PIXEL_SIZE, color: getRandomColor() });
  const playerImage = useRef(null);
  const keysPressed = useRef({});
  const lastPaintedCell = useRef(null);
  const pixelUpdateQueue = useRef({});
  const myLayerRef = useRef({ pixels: {} });
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const analogInput = useRef({ x: 0, y: 0 });
  const { data: allLayers, loading } = useQuery(
    room.query("SELECT id, pixels, last_updated, user_id FROM public.user_layers ORDER BY last_updated DESC")
  );
  const [myLayer, setMyLayer] = useState({ pixels: {} });
  useEffect(() => {
    myLayerRef.current = myLayer;
  }, [myLayer]);
  useEffect(() => {
    setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);
    window.websim.getCurrentUser().then(setCurrentUser);
    const img = new Image();
    img.src = PLAYER_IMG_SRC;
    playerImage.current = img;
    const handleKeyDown = (e) => {
      keysPressed.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);
  useEffect(() => {
    if (currentUser && allLayers) {
      const foundMyLayer = allLayers.find((layer) => layer.id === currentUser.id);
      if (foundMyLayer) {
        setMyLayer(foundMyLayer);
      } else {
        setMyLayer({ id: currentUser.id, pixels: {} });
      }
    }
  }, [allLayers, currentUser]);
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !allLayers || !currentUser) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    for (let i = allLayers.length - 1; i >= 0; i--) {
      const layer = allLayers[i];
      if (layer.id === currentUser.id) continue;
      const pixels = layer.pixels || {};
      for (const key in pixels) {
        const [x, y] = key.split(",").map(Number);
        ctx.fillStyle = pixels[key];
        ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
      }
    }
    const myPixels = myLayer.pixels || {};
    for (const key in myPixels) {
      const [x, y] = key.split(",").map(Number);
      ctx.fillStyle = myPixels[key];
      ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    }
    if (playerImage.current && playerImage.current.complete) {
      ctx.drawImage(playerImage.current, player.x, player.y, PIXEL_SIZE, PIXEL_SIZE);
    }
  }, [allLayers, currentUser, myLayer, player]);
  const paintPixel = useCallback((gridX, gridY) => {
    const pixelKey = `${gridX},${gridY}`;
    if (!myLayerRef.current.pixels[pixelKey] || myLayerRef.current.pixels[pixelKey] !== player.color) {
      pixelUpdateQueue.current[pixelKey] = player.color;
      setMyLayer((l) => ({
        ...l,
        pixels: { ...l.pixels, [pixelKey]: player.color }
      }));
    }
  }, [player.color]);
  useEffect(() => {
    let animationFrameId;
    const gameLoop = () => {
      let dx = analogInput.current.x;
      let dy = analogInput.current.y;
      if (keysPressed.current["w"] || keysPressed.current["arrowup"]) dy -= 1;
      if (keysPressed.current["s"] || keysPressed.current["arrowdown"]) dy += 1;
      if (keysPressed.current["a"] || keysPressed.current["arrowleft"]) dx -= 1;
      if (keysPressed.current["d"] || keysPressed.current["arrowright"]) dx += 1;
      const magnitude = Math.sqrt(dx * dx + dy * dy);
      if (magnitude > 1) {
        dx /= magnitude;
        dy /= magnitude;
      }
      if (dx !== 0 || dy !== 0) {
        setPlayer((p) => {
          const canvas = canvasRef.current;
          const newX = Math.max(0, Math.min(p.x + dx * PLAYER_SPEED, canvas.width - PIXEL_SIZE));
          const newY = Math.max(0, Math.min(p.y + dy * PLAYER_SPEED, canvas.height - PIXEL_SIZE));
          return { ...p, x: newX, y: newY };
        });
      }
      const gridX = Math.floor((player.x + PIXEL_SIZE / 2) / PIXEL_SIZE);
      const gridY = Math.floor((player.y + PIXEL_SIZE / 2) / PIXEL_SIZE);
      const currentCellKey = `${gridX},${gridY}`;
      if (lastPaintedCell.current !== currentCellKey) {
        paintPixel(gridX, gridY);
        lastPaintedCell.current = currentCellKey;
      }
      draw();
      animationFrameId = requestAnimationFrame(gameLoop);
    };
    gameLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [draw, player.x, player.y, paintPixel]);
  useEffect(() => {
    const interval = setInterval(async () => {
      if (currentUser && Object.keys(pixelUpdateQueue.current).length > 0) {
        const pixelsToUpdate = { ...pixelUpdateQueue.current };
        pixelUpdateQueue.current = {};
        const newPixels = { ...myLayerRef.current.pixels, ...pixelsToUpdate };
        await room.collection("user_layers").upsert({
          id: currentUser.id,
          pixels: newPixels,
          last_updated: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }, 1e3);
    return () => clearInterval(interval);
  }, [currentUser]);
  const handleAnalogMove = useCallback((vec) => {
    analogInput.current = vec;
  }, []);
  return /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col items-center justify-center w-full h-full p-4", children: [
    /* @__PURE__ */ jsxDEV("h1", { className: "text-3xl font-bold mb-4", children: "Pixel Layer Land" }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 251,
      columnNumber: 13
    }, this),
    loading && !allLayers && /* @__PURE__ */ jsxDEV("p", { children: "Loading World..." }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 252,
      columnNumber: 39
    }, this),
    /* @__PURE__ */ jsxDEV(
      "canvas",
      {
        ref: canvasRef,
        width: 800,
        height: 600
      },
      void 0,
      false,
      {
        fileName: "<stdin>",
        lineNumber: 253,
        columnNumber: 13
      },
      this
    ),
    /* @__PURE__ */ jsxDEV("div", { className: "mt-4 text-center", children: [
      /* @__PURE__ */ jsxDEV("p", { children: "Use WASD/Arrow keys or the analog stick to move." }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 259,
        columnNumber: 17
      }, this),
      /* @__PURE__ */ jsxDEV("p", { children: "As you move, you paint your layer with your color." }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 260,
        columnNumber: 17
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-center mt-2", children: [
        "Your current color: ",
        /* @__PURE__ */ jsxDEV("div", { className: "w-5 h-5 ml-2 border border-white", style: { backgroundColor: player.color } }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 262,
          columnNumber: 41
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 261,
        columnNumber: 17
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 258,
      columnNumber: 13
    }, this),
    isTouchDevice && /* @__PURE__ */ jsxDEV(AnalogStick, { onMove: handleAnalogMove }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 265,
      columnNumber: 31
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 250,
    columnNumber: 9
  }, this);
}
const root = createRoot(document.getElementById("root"));
root.render(/* @__PURE__ */ jsxDEV(App, {}, void 0, false, {
  fileName: "<stdin>",
  lineNumber: 271,
  columnNumber: 13
}));
