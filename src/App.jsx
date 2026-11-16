
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null

const WHATSAPP = '5491133067296'
const categorias = ['Todos', 'Almacén', 'Bebidas', 'Limpieza', 'Perfumería', 'Lácteos', 'Otros']

export default function App() {
  const [productos, setProductos] = useState([])
  const [categoria, setCategoria] = useState('Todos')
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState([])
  const [cargando, setCargando] = useState(true)
  const [admin, setAdmin] = useState(false)
  const [usuario, setUsuario] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [editando, setEditando] = useState(null)

  async function cargarProductos() {
    if (!supabase) {
      setCargando(false)
      return
    }
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name')
    if (error) setMensaje('No se pudo cargar el catálogo: ' + error.message)
    else setProductos(data || [])
    setCargando(false)
  }

  useEffect(() => {
    cargarProductos()
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setUsuario(data.session?.user || null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuario(session?.user || null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    async function verificarAdmin() {
      if (!supabase || !usuario) {
        setAdmin(false)
        return
      }
      const { data } = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', usuario.id)
        .maybeSingle()
      setAdmin(Boolean(data))
    }
    verificarAdmin()
  }, [usuario])

  const visibles = useMemo(() => productos.filter(p => {
    const coincideCategoria = categoria === 'Todos' ||
      (p.category || 'Otros').toLowerCase() === categoria.toLowerCase()
    const coincideBusqueda = `${p.name} ${p.brand || ''} ${p.presentation || ''}`
      .toLowerCase().includes(busqueda.toLowerCase())
    return coincideCategoria && coincideBusqueda
  }), [productos, categoria, busqueda])

  const total = carrito.reduce((s, item) => s + Number(item.price || 0) * item.cantidad, 0)

  function agregar(producto) {
  const disponible = Number(producto.stock || 0)

  if (disponible <= 0) return

  setCarrito(actual => {
    const existe = actual.find(p => p.id === producto.id)

    if (existe) {
      if (existe.cantidad >= disponible) return actual

      return actual.map(p =>
        p.id === producto.id
          ? { ...p, cantidad: p.cantidad + 1 }
          : p
      )
    }

    return [...actual, { ...producto, cantidad: 1 }]
  })
}

  function cambiarCantidad(id, cantidad) {
    setCarrito(actual => actual
      .map(p => p.id === id ? { ...p, cantidad: Math.max(0, cantidad) } : p)
      .filter(p => p.cantidad > 0))
  }

  function enviarWhatsApp() {
    if (!carrito.length) return
    const lineas = carrito.map(p =>
      `${p.cantidad} x ${p.name} - $${(Number(p.price) * p.cantidad).toLocaleString('es-AR')}`
    )
    const texto = `Hola, quiero hacer este pedido en Almacén Monty y Maru:\n\n${lineas.join('\n')}\n\nTotal: $${total.toLocaleString('es-AR')}`
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  async function ingresar(e) {
    e.preventDefault()
    if (!supabase) return setMensaje('Falta configurar la conexión con Supabase.')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setMensaje(error ? error.message : 'Ingreso correcto.')
  }

  async function salir() {
    await supabase?.auth.signOut()
    setAdmin(false)
  }

  async function guardarProducto(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const producto = {
      name: form.get('name'),
      brand: form.get('brand') || null,
      category: form.get('category'),
      presentation: form.get('presentation') || null,
      price: Number(form.get('price')) || 0,
      image_url: form.get('image_url') || null,
      stock: Number(form.get('stock')) || 0,
      is_active: true,
      is_offer: form.get('is_offer') === 'on',
    }
    const resultado = editando
      ? await supabase.from('products').update(producto).eq('id', editando)
      : await supabase.from('products').insert(producto)
    if (resultado.error) setMensaje(resultado.error.message)
    else {
      setMensaje('Producto guardado.')
      setEditando(null)
      e.target.reset()
      cargarProductos()
    }
  }

  async function eliminar(id) {
    if (!confirm('¿Querés ocultar este producto del catálogo?')) return
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id)
    if (error) setMensaje(error.message)
    else cargarProductos()
  }

  function prepararEdicion(p) {
    setEditando(p.id)
    const form = document.getElementById('form-producto')
    if (!form) return
    for (const campo of ['name', 'brand', 'category', 'presentation', 'price', 'image_url', 'stock']) {
      if (form.elements[campo]) form.elements[campo].value = p[campo] ?? ''
    }
    form.elements.is_offer.checked = Boolean(p.is_offer)
  }

  return (
    <div className="pagina">
      <header className="encabezado">
        <div className="marca">
          <div className="marca-icono">M<span>&</span>M</div>
          <div><strong>Almacén Monty y Maru</strong><small>Tu almacén de confianza</small></div>
        </div>
        <a className="boton boton-rojo" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer">WhatsApp</a>
      </header>

      <section className="presentacion">
        <p className="sobrelinea">TU ALMACÉN DE CONFIANZA</p>
        <h1>Todo lo que necesitás,<br /><span>cerca de casa.</span></h1>
        <p>Almacén, bebidas, limpieza, perfumería y mucho más.</p>
        <a className="boton boton-azul" href="#catalogo">Ver productos</a>
      </section>

      <main>
        <section id="catalogo" className="catalogo">
          <div className="titulo-seccion">
            <div><p className="sobrelinea">NUESTRO CATÁLOGO</p><h2>Productos</h2></div>
            <span className="contador">{carrito.reduce((s, p) => s + p.cantidad, 0)} en carrito</span>
          </div>
          <input className="buscador" placeholder="Buscar un producto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <div className="categorias">
            {categorias.map(c => <button key={c} className={categoria === c ? 'categoria activa' : 'categoria'} onClick={() => setCategoria(c)}>{c}</button>)}
          </div>

          {!supabase && <div className="aviso">La tienda está preparada. Falta conectar Supabase para mostrar los productos.</div>}
          {cargando && <p className="estado">Cargando productos...</p>}
          {!cargando && supabase && visibles.length === 0 && <p className="estado">Todavía no hay productos publicados en esta categoría.</p>}

          <div className="productos">
            {visibles.map(p => <article className="producto" key={p.id}>
              {p.is_offer && <span className="etiqueta-oferta">OFERTA</span>}
              {p.image_url
                ? <img src={p.image_url} alt={p.name} />
                : <div className="sin-imagen">M&M</div>}
              <div className="producto-info">
                <small>{p.category || 'Almacén'}</small>
                <h3>{p.name}</h3>
                {p.presentation && <p>{p.presentation}</p>}
                <strong className="precio">{p.price ? `$${Number(p.price).toLocaleString('es-AR')}` : 'Consultar precio'}</strong>
                <button
  className="boton boton-azul ancho"
  disabled={Number(p.stock || 0) <= 0}
  onClick={() => agregar(p)}
>
  {Number(p.stock || 0) <= 0 ? 'SIN STOCK' : 'Agregar al carrito'}
</button>
                {admin && <div className="acciones-admin">
                  <button onClick={() => prepararEdicion(p)}>Editar</button>
                  <button onClick={() => eliminar(p.id)}>Ocultar</button>
                </div>}
              </div>
            </article>)}
          </div>
        </section>

        <section className="carrito">
          <div><p className="sobrelinea">TU COMPRA</p><h2>Carrito</h2></div>
          {carrito.length === 0 ? <p>Tu carrito está vacío.</p> : carrito.map(p => (
            <div className="linea-carrito" key={p.id}>
              <span>{p.name}</span>
              <div><button onClick={() => cambiarCantidad(p.id, p.cantidad - 1)}>−</button><b>{p.cantidad}</b><button onClick={() => cambiarCantidad(p.id, p.cantidad + 1)}>+</button></div>
              <strong>${(Number(p.price) * p.cantidad).toLocaleString('es-AR')}</strong>
            </div>
          ))}
          <div className="total"><span>Total</span><strong>${total.toLocaleString('es-AR')}</strong></div>
          <button className="boton boton-rojo ancho" disabled={!carrito.length} onClick={enviarWhatsApp}>Enviar pedido por WhatsApp</button>
          <small>El pedido se confirma directamente por WhatsApp con el almacén.</small>
        </section>

        <section className="contacto">
          <p className="sobrelinea">ESTAMOS CERCA</p><h2>Visitá nuestro almacén</h2>
          <p>Joaquín V. González 3548, Claypole, Buenos Aires.</p>
          <p>Lunes a sábado: 09:30 a 14:00 y 18:00 a 21:30.</p>
          <a href="https://www.google.com/maps/search/?api=1&query=Joaquin+V+Gonzalez+3548+Claypole" target="_blank" rel="noreferrer">Cómo llegar</a>
          <p>WhatsApp: 11 3306-7296</p>
        </section>

        <section className="panel">
          <details>
            <summary>Acceso administrador</summary>
            {!usuario ? <form onSubmit={ingresar} className="form-login">
              <input type="email" placeholder="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)} required />
              <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required />
              <button className="boton boton-azul">Ingresar</button>
            </form> : <div>
              {admin ? <p>Sesión de administrador activa.</p> : <p>Este usuario no tiene permisos de administrador.</p>}
              <button onClick={salir}>Cerrar sesión</button>
            </div>}
            {mensaje && <p className="mensaje">{mensaje}</p>}
          </details>
          {admin && <div className="administracion">
            <h2>{editando ? 'Editar producto' : 'Agregar producto'}</h2>
            <form id="form-producto" onSubmit={guardarProducto} className="form-producto">
              <input name="name" placeholder="Nombre del producto" required />
              <input name="brand" placeholder="Marca" />
              <select name="category" defaultValue="Almacén">{categorias.filter(c => c !== 'Todos').map(c => <option key={c}>{c}</option>)}</select>
              <input name="presentation" placeholder="Presentación (ej. 500 g)" />
              <input name="price" type="number" min="0" step="0.01" placeholder="Precio de venta" />
              <input name="image_url" placeholder="Enlace de foto del producto" />
              <input name="stock" type="number" min="0" step="0.01" placeholder="Stock" />
              <label><input name="is_offer" type="checkbox" /> Marcar como oferta</label>
              <button className="boton boton-rojo">Guardar producto</button>
              {editando && <button type="button" onClick={() => { setEditando(null); document.getElementById('form-producto').reset() }}>Cancelar edición</button>}
            </form>
          </div>}
        </section>
      </main>

      <footer>© {new Date().getFullYear()} Almacén Monty y Maru · Tu almacén de confianza</footer>
    </div>
  )
}
