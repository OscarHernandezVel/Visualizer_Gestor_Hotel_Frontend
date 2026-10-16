// Capa de acceso al backend (Spring Boot). JSON en camelCase, alineado con hotel_db.sql.
//  GET  /api/rooms/available?checkIn&checkOut&guests   -> [{id, roomNumber, roomType, capacity, basePrice, available}]
//  POST /api/reservations/quote {roomId, checkInDate, checkOutDate} -> {totalNights, season, nightlyRate, lodgingSubtotal}
//  POST /api/reservations {roomId, checkInDate, checkOutDate, guestName, guestDocument, guestEmail, guestPhone} -> Reservation
//  GET  /api/reservations/{id}                          -> Reservation
//  GET  /api/services                                   -> [{id, name, cost}]
//  POST /api/reservations/{id}/services {serviceId, quantity} -> Reservation
//  POST /api/reservations/{id}/check-in | /check-out    -> Reservation
//  GET  /api/reservations/{id}/invoice                  -> {id, reservationId, lodgingSubtotal, servicesTotal, grandTotal, issueDate}
// Reservation = {id, room:{id, roomNumber, roomType, basePrice}, checkInDate, checkOutDate, totalNights, season,
//   lodgingSubtotal, digitalKeyUuid, reservationStatus, guestName, guestDocument, guestEmail, guestPhone,
//   services:[{id, serviceId, serviceName, quantity, subtotal}]}
// reservationStatus: CREATED | CHECKED_IN | CHECKED_OUT | CANCELLED   ·   season: HIGH | LOW
const BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
export const MOCK = !BASE;

async function http(path, method = "GET", body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error((await r.text()) || `Error ${r.status}`);
  return r.json();
}

/* ---------- Modo demo: simula el servidor y la BD en localStorage ---------- */
const TIPOS = [["SINGLE", 1, 80], ["DOUBLE", 2, 130], ["SUITE", 4, 220]];
const ROOMS = TIPOS.flatMap(([roomType, capacity, basePrice], t) =>
  [1, 2, 3, 4, 5].map((i) => ({ id: t * 5 + i, roomNumber: `${t + 1}0${i}`, roomType, capacity, basePrice })));
const SERVICES = [{ id: 1, name: "Spa", cost: 50 }, { id: 2, name: "Breakfast", cost: 15 }, { id: 3, name: "Transport", cost: 30 }];

const KEY = "hotel_db_v2";
const db = () => JSON.parse(localStorage.getItem(KEY) || '{"n":0,"line":0,"r":{}}');
const save = (d) => localStorage.setItem(KEY, JSON.stringify(d));
const wait = (v) => new Promise((ok) => setTimeout(() => ok(v), 250));
const r2 = (n) => Math.round(n * 100) / 100;
const nights = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const isHigh = (iso) => { const d = new Date(iso), m = d.getUTCMonth() + 1, x = d.getUTCDate();
  return (m === 12 && x >= 15) || (m === 1 && x <= 15) || (m === 6 && x >= 15) || m === 7; };

function quote(room, ci, co) {
  const totalNights = nights(ci, co);
  if (!(totalNights > 0)) throw new Error("La salida debe ser posterior a la entrada");
  const season = isHigh(ci) ? "HIGH" : "LOW";
  const nightlyRate = r2(room.basePrice * (season === "HIGH" ? 1.3 : 1));
  return { totalNights, season, nightlyRate, lodgingSubtotal: r2(nightlyRate * totalNights) };
}
const busy = (d, id, ci, co) => Object.values(d.r).some((r) => r.room.id === id &&
  ["CREATED", "CHECKED_IN"].includes(r.reservationStatus) && ci < r.checkOutDate && co > r.checkInDate);

const demo = {
  async buscar({ entrada, salida, huespedes }) {
    quote(ROOMS[0], entrada, salida);
    const d = db();
    return wait(ROOMS.filter((r) => r.capacity >= huespedes)
      .map((r) => ({ ...r, available: !busy(d, r.id, entrada, salida) })));
  },
  async cotizar({ roomId, checkInDate, checkOutDate }) {
    return wait(quote(ROOMS.find((r) => r.id === roomId), checkInDate, checkOutDate));
  },
  async crear(p) {
    const d = db(), room = ROOMS.find((r) => r.id === p.roomId);
    if (busy(d, room.id, p.checkInDate, p.checkOutDate)) throw new Error("La habitación ya no está disponible");
    const q = quote(room, p.checkInDate, p.checkOutDate), id = ++d.n;
    d.r[id] = { id, room: { id: room.id, roomNumber: room.roomNumber, roomType: room.roomType, basePrice: room.basePrice },
      checkInDate: p.checkInDate, checkOutDate: p.checkOutDate, totalNights: q.totalNights, season: q.season,
      lodgingSubtotal: q.lodgingSubtotal, digitalKeyUuid: null, reservationStatus: "CREATED",
      guestName: p.guestName, guestDocument: p.guestDocument, guestEmail: p.guestEmail, guestPhone: p.guestPhone,
      services: [] };
    save(d); return wait(d.r[id]);
  },
  async obtener(id) {
    const r = db().r[id]; if (!r) throw new Error("Reserva no encontrada"); return wait(r);
  },
  async servicios() { return wait(SERVICES); },
  async agregarServicio(id, serviceId, quantity = 1) {
    const d = db(), r = d.r[id], s = SERVICES.find((x) => x.id === serviceId);
    if (!["CREATED", "CHECKED_IN"].includes(r.reservationStatus)) throw new Error("La reserva ya no admite servicios");
    const l = r.services.find((x) => x.serviceId === serviceId);
    if (l) { l.quantity += quantity; l.subtotal = r2(l.quantity * s.cost); }
    else r.services.push({ id: ++d.line, serviceId, serviceName: s.name, quantity, subtotal: r2(quantity * s.cost) });
    save(d); return wait(r);
  },
  async checkin(id) {
    const d = db(), r = d.r[id];
    if (r.reservationStatus !== "CREATED") throw new Error("Solo se puede hacer check-in en reservas creadas");
    r.reservationStatus = "CHECKED_IN"; r.digitalKeyUuid = crypto.randomUUID(); save(d); return wait(r);
  },
  async checkout(id) {
    const d = db(), r = d.r[id];
    if (r.reservationStatus !== "CHECKED_IN") throw new Error("Primero debes hacer check-in");
    const servicesTotal = r2(r.services.reduce((a, s) => a + s.subtotal, 0));
    r.reservationStatus = "CHECKED_OUT";
    r.invoice = { id, reservationId: id, lodgingSubtotal: r.lodgingSubtotal, servicesTotal,
      grandTotal: r2(r.lodgingSubtotal + servicesTotal), issueDate: new Date().toISOString() };
    save(d); return wait(r);
  },
  async factura(id) {
    const r = db().r[id];
    if (!r?.invoice) throw new Error("La factura se genera al hacer check-out");
    return wait(r.invoice);
  },
};

/* ---------- Backend real ---------- */
const real = {
  buscar: (p) => http(`/api/rooms/available?checkIn=${p.entrada}&checkOut=${p.salida}&guests=${p.huespedes}`),
  cotizar: (p) => http("/api/reservations/quote", "POST", p),
  crear: (p) => http("/api/reservations", "POST", p),
  obtener: (id) => http(`/api/reservations/${id}`),
  servicios: () => http("/api/services"),
  agregarServicio: (id, serviceId, quantity = 1) => http(`/api/reservations/${id}/services`, "POST", { serviceId, quantity }),
  checkin: (id) => http(`/api/reservations/${id}/check-in`, "POST"),
  checkout: (id) => http(`/api/reservations/${id}/check-out`, "POST"),
  factura: (id) => http(`/api/reservations/${id}/invoice`),
};
export const api = MOCK ? demo : real;
