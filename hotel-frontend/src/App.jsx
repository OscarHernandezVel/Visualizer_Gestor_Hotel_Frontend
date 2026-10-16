import { useEffect, useState } from "react";
import { api, MOCK } from "./api";

const usd = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const hoy = () => new Date().toISOString().slice(0, 10);
const TIPOS = { SINGLE: "Sencilla", DOUBLE: "Doble", SUITE: "Suite" };
const ESTADOS = { CREATED: "Creada", CHECKED_IN: "Check-in", CHECKED_OUT: "Check-out", CANCELLED: "Cancelada" };
const TEMP = { HIGH: "temporada alta", LOW: "temporada baja" };
const codigoDe = (id) => "RES-" + String(id).padStart(5, "0");

export default function App() {
  const [vista, setVista] = useState("buscar");
  const [busq, setBusq] = useState({ entrada: hoy(), salida: "", huespedes: 1 });
  const [habs, setHabs] = useState(null);
  const [sel, setSel] = useState(null);
  const [cotiz, setCotiz] = useState(null);
  const [reserva, setReserva] = useState(null);
  const [factura, setFactura] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [g, setG] = useState({ guestName: "", guestDocument: "", guestEmail: "", guestPhone: "" });
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api.servicios().then(setCatalogo).catch((e) => setError(e.message)); }, []);

  const run = async (fn) => {
    setError(""); setCargando(true);
    try { await fn(); } catch (e) { setError(e.message); } finally { setCargando(false); }
  };

  const buscar = (e) => { e.preventDefault(); run(async () => {
    setSel(null); setCotiz(null); setHabs(await api.buscar(busq)); }); };

  const elegir = (h) => run(async () => {
    setSel(h);
    setCotiz(await api.cotizar({ roomId: h.id, checkInDate: busq.entrada, checkOutDate: busq.salida }));
  });

  const reservar = (e) => { e.preventDefault(); run(async () => {
    const r = await api.crear({ roomId: sel.id, checkInDate: busq.entrada, checkOutDate: busq.salida, ...g });
    setReserva(r); setFactura(null); setVista("gestion"); }); };

  const accion = (fn) => run(async () => setReserva(await fn()));
  const checkout = () => run(async () => {
    setReserva(await api.checkout(reserva.id));
    setFactura(await api.factura(reserva.id)); setVista("factura"); });
  const verFactura = () => run(async () => { setFactura(await api.factura(reserva.id)); setVista("factura"); });
  const abrir = (e) => { e.preventDefault(); run(async () => {
    const r = await api.obtener(Number(codigo.replace(/\D/g, "")));
    setReserva(r); setFactura(null); setVista("gestion"); }); };

  const st = reserva?.reservationStatus;
  const activa = st === "CREATED" || st === "CHECKED_IN";
  return (
    <>
      <header>
        <h1>🏨 Reservas de Hotel</h1>
        <nav>
          <button className={vista === "buscar" ? "on" : ""} onClick={() => setVista("buscar")}>Reservar</button>
          <button className={vista === "gestion" ? "on" : ""} disabled={!reserva} onClick={() => setVista("gestion")}>Mi reserva</button>
          <button className={vista === "factura" ? "on" : ""} disabled={!factura} onClick={() => setVista("factura")}>Factura</button>
        </nav>
      </header>
      <main>
        {MOCK && <p className="aviso">Modo demo: datos simulados (define VITE_API_URL para usar el backend).</p>}
        {error && <p className="error">⚠ {error}</p>}
        {cargando && <p className="cargando">Cargando…</p>}

        {vista === "buscar" && (
          <>
            <section className="card">
              <h2>1. Buscar habitaciones</h2>
              <form className="fila" onSubmit={buscar}>
                <label>Entrada<input type="date" min={hoy()} required value={busq.entrada} onChange={(e) => setBusq({ ...busq, entrada: e.target.value })} /></label>
                <label>Salida<input type="date" min={busq.entrada} required value={busq.salida} onChange={(e) => setBusq({ ...busq, salida: e.target.value })} /></label>
                <label>Huéspedes<input type="number" min="1" max="4" value={busq.huespedes} onChange={(e) => setBusq({ ...busq, huespedes: +e.target.value })} /></label>
                <button className="primario">Buscar</button>
              </form>
            </section>

            {habs && (
              <section className="card">
                <h2>2. Selecciona tu habitación</h2>
                <div className="grid">
                  {habs.map((x) => (
                    <button key={x.id} disabled={!x.available} onClick={() => elegir(x)}
                      className={"hab " + (sel?.id === x.id ? "sel " : "") + (x.available ? "" : "ocupada")}>
                      <strong>Hab. {x.roomNumber} · {TIPOS[x.roomType]}</strong>
                      <span>Hasta {x.capacity} huésped(es)</span>
                      <span>Base {usd(x.basePrice)}/noche</span>
                      <em>{x.available ? "Disponible" : "No disponible"}</em>
                    </button>
                  ))}
                  {habs.length === 0 && <p>No hay habitaciones para esa capacidad.</p>}
                </div>
                {sel && cotiz && (
                  <div className="preview">
                    <h3>Precio dinámico</h3>
                    <p>{cotiz.totalNights} noche(s) en <b>{TEMP[cotiz.season]}</b> · {usd(cotiz.nightlyRate)} por noche.</p>
                    <p className="total">Total alojamiento: {usd(cotiz.lodgingSubtotal)}</p>
                  </div>
                )}
              </section>
            )}

            {sel && cotiz && (
              <section className="card">
                <h2>3. Datos del huésped</h2>
                <form className="form" onSubmit={reservar}>
                  {[["guestName", "Nombre completo", "text", true], ["guestDocument", "Documento", "text", true], ["guestEmail", "Correo", "email", true], ["guestPhone", "Teléfono", "tel", false]].map(([k, l, t, req]) => (
                    <label key={k}>{l}<input type={t} required={req} value={g[k]} onChange={(e) => setG({ ...g, [k]: e.target.value })} /></label>
                  ))}
                  <button className="primario">Confirmar reserva</button>
                </form>
              </section>
            )}

            <section className="card">
              <h2>¿Ya tienes una reserva?</h2>
              <form className="fila" onSubmit={abrir}>
                <label>Código<input placeholder="RES-00001" value={codigo} onChange={(e) => setCodigo(e.target.value)} required /></label>
                <button>Abrir</button>
              </form>
            </section>
          </>
        )}

        {vista === "gestion" && reserva && (
          <section className="card">
            <h2>Reserva {codigoDe(reserva.id)} <span className={"badge " + st}>{ESTADOS[st]}</span></h2>
            <p>Hab. {reserva.room.roomNumber} ({TIPOS[reserva.room.roomType]}) · {reserva.checkInDate} → {reserva.checkOutDate} · {reserva.guestName}</p>
            <p>Alojamiento ({reserva.totalNights} noche(s), {TEMP[reserva.season]}): <b>{usd(reserva.lodgingSubtotal)}</b></p>

            <h3>Servicios adicionales</h3>
            <div className="fila">
              {catalogo.map((s) => (
                <button key={s.id} disabled={!activa} onClick={() => accion(() => api.agregarServicio(reserva.id, s.id, 1))}>
                  + {s.name} ({usd(s.cost)})
                </button>
              ))}
            </div>
            <ul>
              {reserva.services.map((s) => <li key={s.id}>{s.serviceName} × {s.quantity} — {usd(s.subtotal)}</li>)}
              {reserva.services.length === 0 && <li>Sin servicios agregados.</li>}
            </ul>

            {st === "CHECKED_IN" && reserva.digitalKeyUuid && <p className="llave">🔑 Llave digital: <code>{reserva.digitalKeyUuid}</code></p>}

            <div className="fila">
              <button className="primario" disabled={st !== "CREATED"} onClick={() => accion(() => api.checkin(reserva.id))}>Check-in</button>
              <button className="primario" disabled={st !== "CHECKED_IN"} onClick={checkout}>Check-out</button>
              <button disabled={st !== "CHECKED_OUT"} onClick={verFactura}>Ver factura</button>
            </div>
            {st !== "CHECKED_OUT" && <p className="nota">La factura se genera al hacer check-out.</p>}
          </section>
        )}

        {vista === "factura" && factura && reserva && (
          <section className="card factura">
            <h2>Factura #{factura.id}</h2>
            <p>{reserva.guestName} · Reserva {codigoDe(reserva.id)} · Hab. {reserva.room.roomNumber} · Emitida {new Date(factura.issueDate).toLocaleString("es-CO")}</p>
            <table>
              <tbody>
                <tr><td>Alojamiento ({reserva.totalNights} noche(s), {TEMP[reserva.season]})</td><td>{usd(factura.lodgingSubtotal)}</td></tr>
                {reserva.services.map((s) => <tr key={s.id}><td>{s.serviceName} × {s.quantity}</td><td>{usd(s.subtotal)}</td></tr>)}
                <tr><td>Total servicios</td><td>{usd(factura.servicesTotal)}</td></tr>
                <tr className="total"><td>Total a pagar</td><td>{usd(factura.grandTotal)}</td></tr>
              </tbody>
            </table>
            <p className="nota">Factura generada por el servidor.</p>
            <button onClick={() => window.print()}>Imprimir</button>
          </section>
        )}
      </main>
    </>
  );
}
