// Capa de acceso al backend. Contrato esperado del API Spring Boot:
//  GET  /api/habitaciones/disponibles?entrada&salida&huespedes
//  POST /api/reservas/precio            {habitacionId, entrada, salida}
//  POST /api/reservas                   {habitacionId, entrada, salida, huesped}
//  GET  /api/reservas/{id}
//  POST /api/reservas/{id}/servicios    {servicio}
//  POST /api/reservas/{id}/checkin | /checkout
//  GET  /api/reservas/{id}/factura
const BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
export const MOCK = !BASE;
export const SERVICIOS = [
  { id: "spa", nombre: "Spa", precio: 120000 },
  { id: "restaurante", nombre: "Restaurante", precio: 80000 },
  { id: "transporte", nombre: "Transporte", precio: 60000 },
];

async function http(path, method = "GET", body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error((await r.text()) || `Error ${r.status}`);
  return r.json();
}

/* ---------- Modo demo (simula el servidor en localStorage) ---------- */
const HABS = [
  { id: 1, numero: "101", tipo: "Sencilla", capacidad: 1, precioBase: 180000 },
  { id: 2, numero: "102", tipo: "Sencilla", capacidad: 1, precioBase: 180000 },
  { id: 3, numero: "201", tipo: "Doble", capacidad: 2, precioBase: 260000 },
  { id: 4, numero: "202", tipo: "Doble", capacidad: 2, precioBase: 260000 },
  { id: 5, numero: "301", tipo: "Familiar", capacidad: 4, precioBase: 380000 },
  { id: 6, numero: "401", tipo: "Suite", capacidad: 3, precioBase: 620000 },
];
const db = () => JSON.parse(localStorage.getItem("hotel_db") || '{"n":0,"r":{}}');
const save = (d) => localStorage.setItem("hotel_db", JSON.stringify(d));
const wait = (v) => new Promise((ok) => setTimeout(() => ok(v), 250));
const dias = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const alta = (d) => { const m = d.getUTCMonth() + 1, x = d.getUTCDate();
  return m === 12 && x >= 15 || m === 1 && x <= 15 || m === 6 && x >= 15 || m === 7; };

function precioDemo(h, entrada, salida) {
  const noches = dias(entrada, salida);
  if (!(noches > 0)) throw new Error("La salida debe ser posterior a la entrada");
  let nAlta = 0, total = 0;
  for (let i = 0; i < noches; i++) {
    const f = new Date(new Date(entrada).getTime() + i * 864e5);
    const a = alta(f); if (a) nAlta++;
    total += h.precioBase * (a ? 1.3 : 1);
  }
  return { noches, nochesAlta: nAlta, nochesBaja: noches - nAlta, total: Math.round(total) };
}
const ocupada = (d, id, e, s) => Object.values(d.r).some((r) =>
  r.habitacion.id === id && r.estado !== "CHECK_OUT" && e < r.salida && s > r.entrada);

const demo = {
  async buscar({ entrada, salida, huespedes }) {
    precioDemo(HABS[0], entrada, salida);
    const d = db();
    return wait(HABS.filter((h) => h.capacidad >= huespedes).map((h) =>
      ({ ...h, disponible: !ocupada(d, h.id, entrada, salida) })));
  },
  async precio({ habitacionId, entrada, salida }) {
    return wait(precioDemo(HABS.find((h) => h.id === habitacionId), entrada, salida));
  },
  async crear({ habitacionId, entrada, salida, huesped }) {
    const d = db(), h = HABS.find((x) => x.id === habitacionId);
    if (ocupada(d, h.id, entrada, salida)) throw new Error("La habitación ya no está disponible");
    const id = ++d.n;
    const r = { id, codigo: "RES-" + String(id).padStart(5, "0"), habitacion: h, entrada, salida,
      huesped, estado: "CONFIRMADA", servicios: [], llaveDigital: null,
      alojamiento: precioDemo(h, entrada, salida) };
    d.r[id] = r; save(d); return wait(r);
  },
  async obtener(id) {
    const r = db().r[id]; if (!r) throw new Error("Reserva no encontrada"); return wait(r);
  },
  async agregarServicio(id, servicio) {
    const d = db(), r = d.r[id], s = SERVICIOS.find((x) => x.id === servicio);
    if (r.estado === "CHECK_OUT") throw new Error("La reserva ya finalizó");
    r.servicios.push({ nombre: s.nombre, precio: s.precio }); save(d); return wait(r);
  },
  async checkin(id) {
    const d = db(), r = d.r[id];
    if (r.estado !== "CONFIRMADA") throw new Error("Solo se puede hacer check-in en reservas confirmadas");
    r.estado = "CHECK_IN";
    r.llaveDigital = "KEY-" + Math.random().toString(36).slice(2, 10).toUpperCase();
    save(d); return wait(r);
  },
  async checkout(id) {
    const d = db(), r = d.r[id];
    if (r.estado !== "CHECK_IN") throw new Error("Primero debes hacer check-in");
    r.estado = "CHECK_OUT"; r.llaveDigital = null; save(d); return wait(r);
  },
  async factura(id) {
    const r = db().r[id], aloj = r.alojamiento.total;
    const serv = r.servicios.reduce((a, s) => a + s.precio, 0);
    const sub = aloj + serv, iva = Math.round(sub * 0.19);
    return wait({ numero: "FAC-" + r.codigo.slice(4), reserva: r, alojamiento: aloj,
      servicios: r.servicios, subtotalServicios: serv, subtotal: sub, iva, total: sub + iva });
  },
};

/* ---------- Backend real ---------- */
const real = {
  buscar: (p) => http(`/api/habitaciones/disponibles?entrada=${p.entrada}&salida=${p.salida}&huespedes=${p.huespedes}`),
  precio: (p) => http("/api/reservas/precio", "POST", p),
  crear: (p) => http("/api/reservas", "POST", p),
  obtener: (id) => http(`/api/reservas/${id}`),
  agregarServicio: (id, servicio) => http(`/api/reservas/${id}/servicios`, "POST", { servicio }),
  checkin: (id) => http(`/api/reservas/${id}/checkin`, "POST"),
  checkout: (id) => http(`/api/reservas/${id}/checkout`, "POST"),
  factura: (id) => http(`/api/reservas/${id}/factura`),
};
export const api = MOCK ? demo : real;
