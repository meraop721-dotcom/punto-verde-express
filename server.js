const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const orders = new Map();
const driverLocations = new Map();
const sessions = new Map();

const VALID_STATUSES = new Set([
  "received", "accepted", "preparing", "ready",
  "picked_up", "on_the_way", "delivered", "cancelled"
]);

// Configure these in Render Environment Variables for production.
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "cambia-esta-clave";

function parseDrivers() {
  try {
    const parsed = JSON.parse(process.env.DRIVERS_JSON || "[]");
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch (_) {}
  return [
    { username: "delivery1", password: "cambia-esta-clave", name: "Repartidor 1" }
  ];
}
const DRIVERS = parseDrivers();

function makeId() { return "PV-" + Math.floor(100000 + Math.random() * 900000); }
function makeToken() { return crypto.randomBytes(32).toString("hex"); }
function safeUser(user) { return { username: user.username, name: user.name || user.username }; }

function auth(req, res, next) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ ok: false, error: "No autorizado" });
  req.session = session;
  req.token = token;
  next();
}
function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.session.role)
    ? next()
    : res.status(403).json({ ok: false, error: "Sin permisos" });
}
function canAccessOrder(order, session) {
  if (!session) return false;
  if (session.role === "admin") return true;
  if (session.role === "driver") return order.driverId === session.username;
  return session.role === "customer" && order.customerToken === session.customerToken;
}

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "Punto Verde Express", realtime: true }));

app.post("/api/auth/login", (req, res) => {
  const { role, username, password } = req.body || {};
  if (!username || !password || !["admin", "driver"].includes(role))
    return res.status(400).json({ ok: false, error: "Datos de acceso incompletos" });

  if (role === "admin") {
    if (username !== ADMIN_USER || password !== ADMIN_PASSWORD)
      return res.status(401).json({ ok: false, error: "Usuario o contraseña incorrectos" });
    const token = makeToken();
    sessions.set(token, { role: "admin", username: ADMIN_USER });
    return res.json({ ok: true, token, role: "admin", user: { username: ADMIN_USER, name: "Administrador" } });
  }

  const driver = DRIVERS.find(d => d.username === username && d.password === password);
  if (!driver) return res.status(401).json({ ok: false, error: "Usuario o contraseña incorrectos" });
  const token = makeToken();
  sessions.set(token, { role: "driver", username: driver.username, name: driver.name || driver.username });
  return res.json({ ok: true, token, role: "driver", user: safeUser(driver) });
});

app.post("/api/auth/logout", auth, (req, res) => {
  sessions.delete(req.token);
  res.json({ ok: true });
});

app.get("/api/auth/me", auth, (req, res) => res.json({ ok: true, role: req.session.role, user: req.session.username, name: req.session.name || req.session.username }));

app.post("/api/orders", (req, res) => {
  const { customerName = "Cliente", day = "", entry = "", main = "", zone = "Guadalupe", delivery = "delivery", address = "", phone = "", time = "", total = 12 } = req.body || {};
  if (delivery === "delivery" && !String(address).trim()) return res.status(400).json({ ok: false, error: "La dirección es obligatoria para delivery." });

  const id = makeId();
  const customerToken = makeToken();
  const order = {
    id, customerToken, customerName: String(customerName), day: String(day), entry: String(entry), main: String(main),
    zone: zone === "Chepén" ? "Chepén" : "Guadalupe", delivery: delivery === "pickup" ? "pickup" : "delivery",
    address: String(address), phone: String(phone), time: String(time), total: Number(total) || 12,
    status: "received", driverId: null, createdAt: new Date().toISOString()
  };
  orders.set(id, order);
  io.to("admins").emit("new-order", order);
  res.json({ ok: true, order: { ...order, customerToken: undefined }, customerToken });
});

app.get("/api/drivers", auth, requireRole("admin"), (_req, res) => {
  res.json({ ok: true, drivers: DRIVERS.map(safeUser) });
});

app.get("/api/orders", auth, (req, res) => {
  let list = [...orders.values()];
  if (req.session.role === "driver") list = list.filter(o => o.driverId === req.session.username);
  const status = req.query.status;
  if (status === "active_delivery") list = list.filter(o => o.delivery === "delivery" && !["delivered", "cancelled"].includes(o.status));
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ ok: true, orders: list.map(({ customerToken, ...o }) => o) });
});

app.get("/api/orders/:id", (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) return res.status(404).json({ ok: false, error: "Pedido no encontrado" });
  const token = String(req.headers["x-customer-token"] || "");
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const session = sessions.get(bearer);
  const allowed = (session && canAccessOrder(order, session)) || token === order.customerToken;
  if (!allowed) return res.status(403).json({ ok: false, error: "No tienes acceso a este pedido" });
  const { customerToken, ...publicOrder } = order;
  res.json({ ok: true, order: publicOrder, driverLocation: driverLocations.get(order.id) || null });
});

app.patch("/api/orders/:id/status", auth, requireRole("admin", "driver"), (req, res) => {
  const order = orders.get(req.params.id), { status } = req.body || {};
  if (!order) return res.status(404).json({ ok: false, error: "Pedido no encontrado" });
  if (!VALID_STATUSES.has(status)) return res.status(400).json({ ok: false, error: "Estado inválido" });
  if (req.session.role === "driver" && order.driverId !== req.session.username) return res.status(403).json({ ok: false, error: "Pedido no asignado a este repartidor" });
  order.status = status; orders.set(order.id, order);
  io.to(`order:${order.id}`).emit("order-status", { orderId: order.id, status });
  io.to("admins").emit("order-updated", order); io.to("drivers").emit("order-updated", order);
  res.json({ ok: true, order: { ...order, customerToken: undefined } });
});

app.patch("/api/orders/:id/assign", auth, requireRole("admin"), (req, res) => {
  const order = orders.get(req.params.id), { driverId } = req.body || {};
  if (!order) return res.status(404).json({ ok: false, error: "Pedido no encontrado" });
  if (driverId && !DRIVERS.some(d => d.username === driverId)) return res.status(400).json({ ok: false, error: "Repartidor no válido" });
  order.driverId = driverId || null; orders.set(order.id, order);
  io.to("admins").emit("order-updated", order); io.to("drivers").emit("order-updated", order);
  res.json({ ok: true, order: { ...order, customerToken: undefined } });
});

io.use((socket, next) => {
  const authData = socket.handshake.auth || {};
  const token = authData.token;
  const staff = sessions.get(token);
  if (staff) { socket.session = staff; return next(); }
  const customerToken = authData.customerToken;
  if (customerToken) {
    const order = [...orders.values()].find(o => o.customerToken === customerToken);
    if (order) { socket.session = { role: "customer", customerToken }; return next(); }
  }
  next(new Error("No autorizado"));
});

io.on("connection", socket => {
  const session = socket.session;
  if (session.role === "admin") socket.join("admins");
  if (session.role === "driver") socket.join("drivers");

  socket.on("join-order", ({ orderId, customerToken } = {}) => {
    const order = orders.get(orderId);
    if (!order) return;
    const allowed = canAccessOrder(order, session) || (session.role === "customer" && customerToken === order.customerToken);
    if (!allowed) return;
    socket.join(`order:${orderId}`);
    const loc = driverLocations.get(orderId); if (loc) socket.emit("driver-location", loc);
  });

  socket.on("driver-status", ({ orderId, status } = {}) => {
    if (session.role !== "driver" && session.role !== "admin") return;
    const order = orders.get(orderId); if (!order || !VALID_STATUSES.has(status)) return;
    if (session.role === "driver" && order.driverId !== session.username) return;
    order.status = status; orders.set(order.id, order);
    io.to(`order:${order.id}`).emit("order-status", { orderId: order.id, status });
    io.to("admins").emit("order-updated", order); io.to("drivers").emit("order-updated", order);
  });

  socket.on("driver-location", ({ orderId, lat, lng, accuracy, timestamp } = {}) => {
    if (session.role !== "driver") return;
    if (!orderId || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const order = orders.get(orderId);
    if (!order || order.delivery !== "delivery" || order.driverId !== session.username) return;
    const location = { lat, lng, accuracy: Number.isFinite(accuracy) ? accuracy : null, timestamp: timestamp || new Date().toISOString() };
    driverLocations.set(orderId, location);
    io.to(`order:${orderId}`).emit("driver-location", location);
    io.to("admins").emit("driver-location", { orderId, ...location });
  });
});

server.listen(PORT, () => console.log(`Punto Verde Express running on port ${PORT}`));
