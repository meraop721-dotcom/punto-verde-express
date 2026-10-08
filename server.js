
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

app.get("/api/health", (_req,res) => res.json({ok:true, service:"Punto Verde Express", realtime:true}));

app.post("/api/orders", (req, res) => {
  const {
    customerName="Cliente",
    day="",
    entry="",
    main="",
    zone="Guadalupe",
    delivery="delivery",
    address="",
    phone="",
    time="",
    total=12
  } = req.body || {};

  if (delivery === "delivery" && !address.trim()) {
    return res.status(400).json({ok:false, error:"La dirección es obligatoria para delivery."});
  }

  const id = makeId();
  const order = {
    id, customerName, day, entry, main, zone, delivery, address, phone, time,
    total: Number(total) || 12,
    status: "received",
    createdAt: new Date().toISOString()
  };

  orders.set(id, order);
  io.to("admins").emit("new-order", order);
  res.json({ok:true, order});
});

app.get("/api/orders", (_req, res) => {
  res.json({ok:true, orders:[...orders.values()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))});
});

app.get("/api/orders/:id", (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) return res.status(404).json({ok:false,error:"Pedido no encontrado"});
  res.json({ok:true, order, driverLocation:driverLocations.get(order.id)||null});
});

const validStatuses = new Set([
  "received","accepted","preparing","ready","picked_up","on_the_way","delivered","cancelled"
]);

app.patch("/api/orders/:id/status", (req,res) => {
  const order = orders.get(req.params.id);
  const {status} = req.body || {};
  if (!order) return res.status(404).json({ok:false,error:"Pedido no encontrado"});
  if (!validStatuses.has(status)) return res.status(400).json({ok:false,error:"Estado inválido"});
  order.status = status;
  orders.set(order.id, order);
  io.to(`order:${order.id}`).emit("order-status",{orderId:order.id,status});
  io.to("admins").emit("order-updated",order);
  res.json({ok:true,order});
});

io.on("connection", socket => {
  socket.on("join-order", ({orderId}) => {
    if (!orderId) return;
    socket.join(`order:${orderId}`);
    const loc = driverLocations.get(orderId);
    if (loc) socket.emit("driver-location",loc);
  });

  socket.on("join-admin", () => socket.join("admins"));

  socket.on("driver-location", ({orderId,lat,lng,accuracy,timestamp}) => {
    if (!orderId || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const location = {
      lat,lng,
      accuracy:Number.isFinite(accuracy)?accuracy:null,
      timestamp:timestamp || new Date().toISOString()
    };
    driverLocations.set(orderId,location);
    io.to(`order:${orderId}`).emit("driver-location",location);
    io.to("admins").emit("driver-location",{orderId,...location});
  });
});

server.listen(PORT,()=>console.log(`Punto Verde Express running on ${PORT}`));
