import { jsxDEV } from "react/jsx-dev-runtime";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { WebsimSocket, useQuery } from "@websim/use-query";
const room = new WebsimSocket();
const PIXEL_SIZE = 16;
const PLAYER_IMG_SRC = "player.png";
const getRandomColor = () => {
  return "hsl(" + 360 * Math.random() + "," + (25 + 70 * Math.random()) + "%," + (85 + 10 * Math.random()) + "%)";
};
function App() {
  const canvasRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [player, setPlayer] = useState({ x: 10, y: 10, color: getRandomColor() });
  const playerImage = useRef(null);
  const { data: allLayers, loading } = useQuery(
    room.query("SELECT id, pixels, last_updated, user_id FROM public.user_layers ORDER BY last_updated DESC")
  );
  const [myLayer, setMyLayer] = useState({ pixels: {} });
  useEffect(() => {
    window.websim.getCurrentUser().then(setCurrentUser);
    const img = new Image();
    img.src = PLAYER_IMG_SRC;
    playerImage.current = img;
  }, []);
  useEffect(() => {
    if (currentUser && allLayers) {
      const foundMyLayer = allLayers.find((layer) => layer.id === currentUser.id);
      if (foundMyLayer) {
        setMyLayer(foundMyLayer);
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
      ctx.drawImage(playerImage.current, player.x * PIXEL_SIZE, player.y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    }
  }, [allLayers, currentUser, myLayer, player]);
  useEffect(() => {
    draw();
  }, [draw]);
  const handleCanvasClick = async (event) => {
    if (!currentUser) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = event.clientX || event.touches[0].clientX;
    const clientY = event.clientY || event.touches[0].clientY;
    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;
    const targetX = Math.floor(canvasX / PIXEL_SIZE);
    const targetY = Math.floor(canvasY / PIXEL_SIZE);
    const updatedPlayerPos = { x: targetX, y: targetY };
    setPlayer((p) => ({ ...p, ...updatedPlayerPos }));
    const pixelKey = `${targetX},${targetY}`;
    const newPixels = { ...myLayer.pixels, [pixelKey]: player.color };
    setMyLayer((l) => ({ ...l, pixels: newPixels }));
    await room.collection("user_layers").upsert({
      id: currentUser.id,
      pixels: newPixels,
      last_updated: (/* @__PURE__ */ new Date()).toISOString()
    });
  };
  return /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col items-center justify-center w-full h-full p-4", children: [
    /* @__PURE__ */ jsxDEV("h1", { className: "text-3xl font-bold mb-4", children: "Pixel Layer Land" }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 124,
      columnNumber: 13
    }, this),
    loading && !allLayers && /* @__PURE__ */ jsxDEV("p", { children: "Loading World..." }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 125,
      columnNumber: 39
    }, this),
    /* @__PURE__ */ jsxDEV(
      "canvas",
      {
        ref: canvasRef,
        width: 800,
        height: 600,
        onClick: handleCanvasClick,
        onTouchStart: handleCanvasClick
      },
      void 0,
      false,
      {
        fileName: "<stdin>",
        lineNumber: 126,
        columnNumber: 13
      },
      this
    ),
    /* @__PURE__ */ jsxDEV("div", { className: "mt-4 text-center", children: [
      /* @__PURE__ */ jsxDEV("p", { children: "Tap or click on the canvas to move your character." }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 134,
        columnNumber: 17
      }, this),
      /* @__PURE__ */ jsxDEV("p", { children: "As you move, you paint your layer with your color." }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 135,
        columnNumber: 17
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-center mt-2", children: [
        "Your current color: ",
        /* @__PURE__ */ jsxDEV("div", { className: "w-5 h-5 ml-2 border border-white", style: { backgroundColor: player.color } }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 137,
          columnNumber: 41
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 136,
        columnNumber: 17
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 133,
      columnNumber: 13
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 123,
    columnNumber: 9
  }, this);
}
const root = createRoot(document.getElementById("root"));
root.render(/* @__PURE__ */ jsxDEV(App, {}, void 0, false, {
  fileName: "<stdin>",
  lineNumber: 145,
  columnNumber: 13
}));
