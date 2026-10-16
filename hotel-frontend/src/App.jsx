import { useState } from "react";
import { api, SERVICIOS, MOCK } from "./api";

const cop = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
const hoy = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [vista, setVista] = useState("buscar");
  const [busq, setBusq] = useState({ entrada: hoy(), salida: "", huespedes: 1 });
  const [habs, setHabs] = useState(null);
  const [sel, setSel] = useState(null);
  const [precio, setPrecio] = useState(null);
  const [reserva, setReserva] = useState(null);
  const [factura, setFactura] = useState(null);
  const [huesped, setHuesped] = useState({ nombre: "", email: "", telefono: "", documento: "" });
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn) => {
    setError(""); setCargando(true);
    try { await fn(); } catch (e) { setError(e.message); } finally { setCargando(false); }
  };

  const buscar = (e) => { e.preventDefault(); run(async () => {
    setSel(null); setPrecio(null); setHabs(await api.buscar(busq)); }); };

  const elegir = (h) => run(async () => {
    setSel(h); setPrecio(await api.precio({ habitacionId: h.id, entrada: busq.entrada, salida: busq.salida }));
  });

  const reservar = (e) => { e.preventDefault(); run(async () => {
    const r = await api.crear({ habitacionId: sel.id, entrada: busq.entrada, salida: busq.salida, huesped });
    setReserva(r); setVista("gestion"); }); };

  const accion = (fn) => run(async () => setReserva(await fn()));
  const verFactura = () => run(async () => { setFactura(await api.factura(reserva.id)); setVista("factura"); });
  const abrir = (e) => { e.preventDefault(); run(async () => {
    const id = Number(codigo.replace(/\D/g, "")); setReserva(await api.obtener(id)); setVista("gestion"); }); };

  const h = reserva?.habitacion;
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
                <label>Huéspedes<input type="number" min="1" max="6" value={busq.huespedes} onChange={(e) => setBusq({ ...busq, huespedes: +e.target.value })} /></label>
                <button className="primario">Buscar</button>
              </form>
            </section>

            {habs && (
              <section className="card">
                <h2>2. Selecciona tu habitación</h2>
                <div className="grid">
                  {habs.map((x) => (
                    <button key={x.id} disabled={!x.disponible} onClick={() => elegir(x)}
                      className={"hab " + (sel?.id === x.id ? "sel " : "") + (x.disponible ? "" : "ocupada")}>
                      <strong>Hab. {x.numero} · {x.tipo}</strong>
                      <span>Hasta {x.capacidad} huésped(es)</span>
                      <span>Desde {cop(x.precioBase)}/noche</span>
                      <em>{x.disponible ? "Disponible" : "No disponible"}</em>
                    </button>
                  ))}
                  {habs.length === 0 && <p>No hay habitaciones para esa capacidad.</p>}
                </div>
                {sel && precio && (
                  <div className="preview">
                    <h3>Precio dinámico</h3>
                    <p>{precio.noches} noche(s): {precio.nochesAlta} en temporada alta (+30%) y {precio.nochesBaja} en baja.</p>
                    <p className="total">Total alojamiento: {cop(precio.total)}</p>
                  </div>
                )}
              </section>
            )}

            {sel && precio && (
              <section className="card">
                <h2>3. Datos del huésped</h2>
                <form className="form" onSubmit={reservar}>
                  {[["nombre", "Nombre completo", "text"], ["documento", "Documento", "text"], ["email", "Correo", "email"], ["telefono", "Teléfono", "tel"]].map(([k, l, t]) => (
                    <label key={k}>{l}<input type={t} required value={huesped[k]} onChange={(e) => setHuesped({ ...huesped, [k]: e.target.value })} /></label>
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
            <h2>Reserva {reserva.codigo} <span className={"badge " + reserva.estado}>{reserva.estado.replace("_", "-")}</span></h2>
            <p>Hab. {h.numero} ({h.tipo}) · {reserva.entrada} → {reserva.salida} · {reserva.huesped.nombre}</p>
            <p>Alojamiento: <b>{cop(reserva.alojamiento.total)}</b></p>

            <h3>Servicios adicionales</h3>
            <div className="fila">
              {SERVICIOS.map((s) => (
                <button key={s.id} disabled={reserva.estado === "CHECK_OUT"} onClick={() => accion(() => api.agregarServicio(reserva.id, s.id))}>
                  + {s.nombre} ({cop(s.precio)})
                </button>
              ))}
            </div>
            <ul>{reserva.servicios.map((s, i) => <li key={i}>{s.nombre} — {cop(s.precio)}</li>)}
              {reserva.servicios.length === 0 && <li>Sin servicios agregados.</li>}</ul>

            {reserva.llaveDigital && <p className="llave">🔑 Llave digital: <code>{reserva.llaveDigital}</code></p>}

            <div className="fila">
              <button className="primario" disabled={reserva.estado !== "CONFIRMADA"} onClick={() => accion(() => api.checkin(reserva.id))}>Check-in</button>
              <button className="primario" disabled={reserva.estado !== "CHECK_IN"} onClick={() => accion(() => api.checkout(reserva.id))}>Check-out</button>
              <button onClick={verFactura}>Ver factura</button>
            </div>
          </section>
        )}

        {vista === "factura" && factura && (
          <section className="card factura">
            <h2>Factura {factura.numero}</h2>
            <p>{factura.reserva.huesped.nombre} · Reserva {factura.reserva.codigo}</p>
            <table>
              <tbody>
                <tr><td>Alojamiento (Hab. {factura.reserva.habitacion.numero})</td><td>{cop(factura.alojamiento)}</td></tr>
                {factura.servicios.map((s, i) => <tr key={i}><td>{s.nombre}</td><td>{cop(s.precio)}</td></tr>)}
                <tr><td>Subtotal</td><td>{cop(factura.subtotal)}</td></tr>
                <tr><td>IVA 19%</td><td>{cop(factura.iva)}</td></tr>
                <tr className="total"><td>Total</td><td>{cop(factura.total)}</td></tr>
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
