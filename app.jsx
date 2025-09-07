import { jsxDEV } from "react/jsx-dev-runtime";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { WebsimSocket, useQuery } from "@websim/use-query";
const room = new WebsimSocket();
const PIXEL_SIZE = 16;
const PLAYER_IMG_SRC = "player.png";
const MOVE_INTERVAL = 50;
const getRandomHexColor = () => {
  return "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");
};
const mergeColors = (hex1, hex2) => {
  const c1 = parseInt(hex1.substring(1), 16);
  const c2 = parseInt(hex2.substring(1), 16);
  const r1 = c1 >> 16 & 255, g1 = c1 >> 8 & 255, b1 = c1 & 255;
  const r2 = c2 >> 16 & 255, g2 = c2 >> 8 & 255, b2 = c2 & 255;
  const r = Math.floor((r1 + r2) / 2);
  const g = Math.floor((g1 + g2) / 2);
  const b = Math.floor((b1 + b2) / 2);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).padStart(6, "0");
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
    lineNumber: 91,
    columnNumber: 13
  }) }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 90,
    columnNumber: 9
  });
};
function App() {
  const canvasRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const playerImages = useRef({});
  const keysPressed = useRef({});
  const pixelUpdateQueue = useRef({});
  const [livePixels, setLivePixels] = useState({});
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const analogInput = useRef({ x: 0, y: 0 });
  const lastMoveTime = useRef(0);
  const [playerState, setPlayerState] = useState({
    x: 10 * PIXEL_SIZE,
    y: 10 * PIXEL_SIZE,
    color: "#ffffff"
  });
  const [unlockedColors, setUnlockedColors] = useState([]);
  const [presence, setPresence] = useState({});
  const { data: allLayers, loading } = useQuery(
    room.query("SELECT id, pixels, last_updated, unlocked_colors FROM public.user_layers ORDER BY last_updated ASC")
  );
  useEffect(() => {
    const init = async () => {
      const user = await window.websim.getCurrentUser();
      setCurrentUser(user);
      await room.initialize();
      room.onmessage = (event) => {
        const { data, fromClientId } = event;
        if (data.type === "paint") {
          const painterPresence = room.presence[fromClientId];
          if (painterPresence && painterPresence.userId) {
            setLivePixels((prev) => ({
              ...prev,
              [painterPresence.userId]: {
                ...prev[painterPresence.userId],
                [`${data.x},${data.y}`]: data.color
              }
            }));
          }
        }
      };
      room.subscribePresence((currentPresence) => {
        setPresence({ ...currentPresence });
      });
    };
    init();
    setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);
    const img = new Image();
    img.src = PLAYER_IMG_SRC;
    playerImages.current["default"] = img;
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
      const myLayer = allLayers.find((l) => l.id === currentUser.id);
      if (myLayer && myLayer.unlocked_colors && myLayer.unlocked_colors.length > 0) {
        setUnlockedColors(myLayer.unlocked_colors);
        setPlayerState((p) => ({ ...p, color: myLayer.unlocked_colors[0] }));
      } else {
        const initialColor = getRandomHexColor();
        setUnlockedColors([initialColor]);
        setPlayerState((p) => ({ ...p, color: initialColor }));
        room.collection("user_layers").upsert({
          id: currentUser.id,
          pixels: {},
          unlocked_colors: [initialColor],
          last_updated: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
  }, [currentUser, allLayers]);
  useEffect(() => {
    if (currentUser && room.clientId) {
      room.updatePresence({
        ...playerState,
        userId: currentUser.id,
        username: currentUser.username
      });
    }
  }, [playerState, currentUser]);
  const getColorAt = useCallback((x, y) => {
    const key = `${x},${y}`;
    const onlineUserIds = Object.keys(presence).map((clientId) => presence[clientId].userId).filter((id) => id && id !== currentUser.id);
    for (const userId of onlineUserIds.reverse()) {
      if (livePixels[userId] && livePixels[userId][key]) {
        return livePixels[userId][key];
      }
    }
    for (let i = allLayers.length - 1; i >= 0; i--) {
      const layer = allLayers[i];
      if (layer.id !== currentUser.id && layer.pixels && layer.pixels[key]) {
        return layer.pixels[key];
      }
    }
    return null;
  }, [allLayers, presence, livePixels, currentUser]);
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !allLayers || !currentUser) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const onlineUserIds = Object.values(presence).map((p) => p.userId).filter(Boolean);
    allLayers.forEach((layer) => {
      if (layer.id === currentUser.id) {
        Object.entries(layer.pixels || {}).forEach(([key, color]) => {
          const [x, y] = key.split(",").map(Number);
          ctx.fillStyle = color;
          ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
        });
      } else if (!onlineUserIds.includes(layer.id)) {
        Object.entries(layer.pixels || {}).forEach(([key, color]) => {
          const [x, y] = key.split(",").map(Number);
          ctx.fillStyle = color;
          ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
        });
      }
    });
    Object.values(livePixels).forEach((userPixels) => {
      Object.entries(userPixels).forEach(([key, color]) => {
        const [x, y] = key.split(",").map(Number);
        ctx.fillStyle = color;
        ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
      });
    });
    Object.values(presence).forEach((p) => {
      if (p.x !== void 0 && p.y !== void 0) {
        const img = playerImages.current["default"];
        if (img && img.complete) {
          ctx.drawImage(img, p.x, p.y, PIXEL_SIZE, PIXEL_SIZE);
        } else if (img) {
          img.onload = draw;
        }
      }
    });
  }, [allLayers, currentUser, presence, livePixels]);
  const paintPixel = useCallback((gridX, gridY) => {
    const pixelKey = `${gridX},${gridY}`;
    const myLiveLayer = livePixels[currentUser.id] || {};
    const underlyingColor = getColorAt(gridX, gridY);
    if (underlyingColor) {
      const newColor = mergeColors(playerState.color, underlyingColor);
      if (!unlockedColors.includes(newColor)) {
        const newUnlocked = [...unlockedColors, newColor];
        setUnlockedColors(newUnlocked);
        room.collection("user_layers").upsert({
          id: currentUser.id,
          unlocked_colors: newUnlocked,
          last_updated: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
    if (myLiveLayer[pixelKey] !== playerState.color) {
      pixelUpdateQueue.current[pixelKey] = playerState.color;
      setLivePixels((prev) => ({
        ...prev,
        [currentUser.id]: {
          ...prev[currentUser.id],
          [pixelKey]: playerState.color
        }
      }));
      room.send({
        type: "paint",
        x: gridX,
        y: gridY,
        color: playerState.color
      });
    }
  }, [playerState.color, currentUser, livePixels, getColorAt, unlockedColors]);
  useEffect(() => {
    let animationFrameId;
    const gameLoop = () => {
      if (!currentUser) {
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
      }
      const now = Date.now();
      if (now - lastMoveTime.current > MOVE_INTERVAL) {
        let dx = 0;
        let dy = 0;
        const analogX = analogInput.current.x;
        const analogY = analogInput.current.y;
        if (Math.abs(analogX) > 0.1 || Math.abs(analogY) > 0.1) {
          dx = analogX;
          dy = analogY;
        } else {
          if (keysPressed.current["w"] || keysPressed.current["arrowup"]) dy = -1;
          if (keysPressed.current["s"] || keysPressed.current["arrowdown"]) dy = 1;
          if (keysPressed.current["a"] || keysPressed.current["arrowleft"]) dx = -1;
          if (keysPressed.current["d"] || keysPressed.current["arrowright"]) dx = 1;
        }
        if (dx !== 0 || dy !== 0) {
          const moveSpeed = PIXEL_SIZE / 4;
          const magnitude = Math.sqrt(dx * dx + dy * dy);
          const normalizedDx = magnitude > 0 ? dx / magnitude * moveSpeed : 0;
          const normalizedDy = magnitude > 0 ? dy / magnitude * moveSpeed : 0;
          setPlayerState((p) => {
            const canvas = canvasRef.current;
            const newX = Math.max(0, Math.min(p.x + normalizedDx, canvas.width - PIXEL_SIZE));
            const newY = Math.max(0, Math.min(p.y + normalizedDy, canvas.height - PIXEL_SIZE));
            const newState = { ...p, x: newX, y: newY };
            room.updatePresence({
              x: newState.x,
              y: newState.y,
              color: newState.color,
              userId: currentUser.id,
              username: currentUser.username
            });
            const gridX = Math.floor((newX + PIXEL_SIZE / 2) / PIXEL_SIZE);
            const gridY = Math.floor((newY + PIXEL_SIZE / 2) / PIXEL_SIZE);
            paintPixel(gridX, gridY);
            return newState;
          });
          lastMoveTime.current = now;
        }
      }
      draw();
      animationFrameId = requestAnimationFrame(gameLoop);
    };
    gameLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [draw, currentUser, paintPixel]);
  useEffect(() => {
    const interval = setInterval(async () => {
      if (currentUser && Object.keys(pixelUpdateQueue.current).length > 0) {
        const pixelsToUpdate = { ...pixelUpdateQueue.current };
        pixelUpdateQueue.current = {};
        const myLayerFromDB = allLayers?.find((l) => l.id === currentUser.id);
        const basePixels = myLayerFromDB?.pixels || {};
        const newPixels = { ...basePixels, ...pixelsToUpdate };
        await room.collection("user_layers").upsert({
          id: currentUser.id,
          pixels: newPixels,
          last_updated: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }, 1e3);
    return () => clearInterval(interval);
  }, [currentUser, allLayers]);
  const handleAnalogMove = useCallback((vec) => {
    analogInput.current = vec;
  }, []);
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !currentUser) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const gridX = Math.floor(mouseX / PIXEL_SIZE);
    const gridY = Math.floor(mouseY / PIXEL_SIZE);
    const newX = gridX * PIXEL_SIZE;
    const newY = gridY * PIXEL_SIZE;
    const boundedX = Math.max(0, Math.min(newX, canvas.width - PIXEL_SIZE));
    const boundedY = Math.max(0, Math.min(newY, canvas.height - PIXEL_SIZE));
    const newState = { ...playerState, x: boundedX, y: boundedY };
    setPlayerState(newState);
    room.updatePresence({
      x: newState.x,
      y: newState.y,
      color: newState.color,
      userId: currentUser.id,
      username: currentUser.username
    });
    paintPixel(gridX, gridY);
  };
  const selectColor = (color) => {
    setPlayerState((p) => ({ ...p, color }));
  };
  return /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col items-center justify-center w-full h-full p-4", children: [
    /* @__PURE__ */ jsxDEV("h1", { className: "text-3xl font-bold mb-4", children: "Pixel Layer Land" }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 452,
      columnNumber: 13
    }, this),
    loading && !allLayers && /* @__PURE__ */ jsxDEV("p", { children: "Loading World..." }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 453,
      columnNumber: 39
    }, this),
    /* @__PURE__ */ jsxDEV(
      "canvas",
      {
        ref: canvasRef,
        width: 800,
        height: 600,
        onClick: handleCanvasClick
      },
      void 0,
      false,
      {
        fileName: "<stdin>",
        lineNumber: 454,
        columnNumber: 13
      },
      this
    ),
    /* @__PURE__ */ jsxDEV("div", { className: "mt-4 text-center", children: [
      /* @__PURE__ */ jsxDEV("p", { children: "Click to move, or use WASD/Arrow keys or the analog stick." }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 461,
        columnNumber: 17
      }, this),
      /* @__PURE__ */ jsxDEV("p", { children: "As you move, you paint your layer. Paint over other colors to unlock new ones!" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 462,
        columnNumber: 17
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-center mt-2", id: "color-palette", children: unlockedColors.map((color) => /* @__PURE__ */ jsxDEV(
        "div",
        {
          className: `color-swatch ${playerState.color === color ? "selected" : ""}`,
          style: { backgroundColor: color },
          onClick: () => selectColor(color),
          title: color
        },
        color,
        false,
        {
          fileName: "<stdin>",
          lineNumber: 465,
          columnNumber: 25
        },
        this
      )) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 463,
        columnNumber: 17
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 460,
      columnNumber: 13
    }, this),
    isTouchDevice && /* @__PURE__ */ jsxDEV(AnalogStick, { onMove: handleAnalogMove }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 475,
      columnNumber: 31
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 451,
    columnNumber: 9
  }, this);
}
const root = createRoot(document.getElementById("root"));
root.render(/* @__PURE__ */ jsxDEV(App, {}, void 0, false, {
  fileName: "<stdin>",
  lineNumber: 481,
  columnNumber: 13
}));
