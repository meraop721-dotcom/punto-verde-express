
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const orders = new Map();
const driverLocations = new Map();

function makeId() {
  return "PV-" + Math.floor(100000 + Math.random() * 900000);
}

app.post("/api/orders", (req, res) => {
  const { customerName="Cliente", day, entry, main, zone="Guadalupe",
          delivery="delivery", time="", total=12 } = req.body || {};

  const id = makeId();
  const order = {
    id, customerName, day, entry, main, zone, delivery, time,
    total: Number(total) || 12,
    status: "received",
    createdAt: new Date().toISOString()
  };

  orders.set(id, order);
  res.json({ ok: true, order });
});

app.get("/api/orders/:id", (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) return res.status(404).json({ ok:false, error:"Pedido no encontrado" });
  res.json({
    ok: true,
    order,
    driverLocation: driverLocations.get(order.id) || null
  });
});

app.get("/api/health", (_req,res) => res.json({
  ok:true,
  service:"Punto Verde Express",
  realtime:true
}));

io.on("connection", socket => {
  socket.on("join-order", ({ orderId }) => {
    if (!orderId) return;
    socket.join(`order:${orderId}`);
    const loc = driverLocations.get(orderId);
    if (loc) socket.emit("driver-location", loc);
  });

  socket.on("driver-location", ({ orderId, lat, lng, accuracy, timestamp }) => {
    if (!orderId || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const location = {
      lat, lng,
      accuracy: Number.isFinite(accuracy) ? accuracy : null,
      timestamp: timestamp || new Date().toISOString()
    };
    driverLocations.set(orderId, location);
    io.to(`order:${orderId}`).emit("driver-location", location);
  });

  socket.on("driver-status", ({ orderId, status }) => {
    const valid = new Set(["accepted","preparing","ready","picked_up","on_the_way","delivered","cancelled"]);
    if (!orderId || !valid.has(status)) return;
    const order = orders.get(orderId);
    if (!order) return;
    order.status = status;
    orders.set(orderId, order);
    io.to(`order:${orderId}`).emit("order-status", { orderId, status });
  });
});

server.listen(PORT, () => console.log(`Punto Verde Express running on ${PORT}`));
