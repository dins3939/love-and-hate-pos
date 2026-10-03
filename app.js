// =========================================
// 1. CONFIGURACIÓN DE APIs
// =========================================
const discogsToken = 'MoULOWotMYgLOPkTmlpzqAOLdaWVYetxnNKvMxvh'; 
const supabaseUrl = 'https://ygzocglafldsjpvdiqpl.supabase.co'; 
const supabaseKey = 'sb_publishable_PfRk21ghxhOMuF-J9DLkMA_MpM6LYsg'; 
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let inventarioGlobal = [];

// =========================================
// 2. FUNCIONES DE DISCOGS (NUBE)
// =========================================
async function buscarPorCodigoDeBarras(codigo) {
  try {
    const urlBusqueda = `https://api.discogs.com/database/search?q=${codigo}&type=release`;
    const respuesta = await fetch(urlBusqueda, {
      headers: { 'Authorization': `Discogs token=${discogsToken}` }
    });
    const datos = await respuesta.json();
    return (datos.results && datos.results.length > 0) ? datos.results[0] : null;
  } catch (error) {
    console.error("Error buscando el código:", error);
    return null;
  }
}

// =========================================
// 3. FUNCIONES DE SUPABASE (LOCAL)
// =========================================
async function cargarCatalogo() {
  const { data, error } = await db.from('Inventory').select('*');
  if (error) {
    console.error("Error al descargar inventario:", error);
    return;
  }
  inventarioGlobal = data;
  actualizarVista();
}

// =========================================
// MOTOR DE FILTRADO Y PAGINACIÓN
// =========================================
let filtroActual = 'All';
let busquedaActual = ''; 
let paginaActual = 1;

window.cambiarFiltro = function(categoria, boton) {
  filtroActual = categoria;
  paginaActual = 1; // Regresa a la página 1 al cambiar de filtro
  
  // Actualiza el color verde en los botones
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  if (boton) boton.classList.add('active');

  actualizarVista();
};

// ESTA ES LA FUNCIÓN QUE BORRASTE POR ACCIDENTE Y ROMPÍA LOS CLICS
window.cambiarPagina = function(numero) {
  paginaActual = numero;
  actualizarVista();
};

window.actualizarVista = function() {
  let datos = inventarioGlobal;
  const esAdmin = document.querySelector('.inventory-list') !== null;
  const itemsPorPagina = esAdmin ? 60 : 30;

  // 1. Filtrar por Categoría
  if (filtroActual !== 'All') {
    datos = datos.filter(item => item.category === filtroActual);
  }

  // 2. Filtrar por Búsqueda (Buscador manual o Escáner)
  if (busquedaActual !== '') {
    datos = datos.filter(item => {
      const titulo = (item.title || '').toLowerCase();
      const codigo = (item.barcode || '').toLowerCase();
      return titulo.includes(busquedaActual) || codigo.includes(busquedaActual);
    });
  }

  // 3. Ordenar (Sin stock al fondo, luego alfabético)
  datos.sort((a, b) => {
    if (a.stock <= 0 && b.stock > 0) return 1;  
    if (a.stock > 0 && b.stock <= 0) return -1; 
    if (a.title < b.title) return -1;
    if (a.title > b.title) return 1;
    return 0; 
  });

  // 4. Paginar (El corte de 30 o 60 discos)
  const totalPaginas = Math.ceil(datos.length / itemsPorPagina) || 1;
  const inicio = (paginaActual - 1) * itemsPorPagina;
  const fin = inicio + itemsPorPagina;
  const datosPaginados = datos.slice(inicio, fin);

  // 5. Dibujar Pantalla
  renderizarTarjetas(datosPaginados);
  dibujarControlesPaginacion(totalPaginas);
};

function dibujarControlesPaginacion(totalPaginas) {
  const contenedor = document.getElementById('paginacion');
  if (!contenedor) return;
  contenedor.innerHTML = '';
  
  for (let i = 1; i <= totalPaginas; i++) {
    const claseActiva = i === paginaActual ? 'active' : '';
    contenedor.innerHTML += `<button class="page-btn ${claseActiva}" onclick="cambiarPagina(${i})">${i}</button>`;
  }
}

// =========================================
// RENDERIZADO VISUAL ACTUALIZADO
// =========================================
function renderizarTarjetas(articulos) {
  const grid = document.querySelector('.catalog-grid');
  const list = document.querySelector('.inventory-list');
  const contenedor = list || grid; 
  if (!contenedor) return;
  
  contenedor.innerHTML = ''; 
  const esAdmin = !!list; 
  const esPOS = document.querySelector('.pos-cart') !== null; 

  articulos.forEach(item => {
    const claseStock = item.stock <= 0 ? 'red-text' : '';
    let nombreAMostrar = item.title;
    let columnasRopa = '';
    let detallesRopaPOS = '';

    if (item.category === 'Shirt' || item.category === 'Playeras') {
      const talla = item.size || '---';
      const color = item.color || '---';
      const tipo = item.type || '---';
      
      columnasRopa = `
      <div class="col-extras">
        <div class="row-col" style="flex: 1;">
          <span class="col-label">Talla</span>
          <span class="col-value" style="text-transform: uppercase;">${talla}</span>
        </div>
        <div class="row-col" style="flex: 1;">
          <span class="col-label">Color</span>
          <span class="col-value" style="text-transform: capitalize;">${color}</span>
        </div>
        <div class="row-col" style="flex: 1;">
          <span class="col-label">Tipo</span>
          <span class="col-value" style="text-transform: capitalize;">${tipo}</span>
        </div>
      </div>
    `;
      detallesRopaPOS = `
        <p style="font-size: 10px; color: #888; margin-top: 4px; line-height: 1.3;">
          Talla: <span style="color:#fff; font-weight:bold; text-transform:uppercase;">${talla}</span> • 
          Color: <span style="color:#fff; font-weight:bold; text-transform:capitalize;">${color}</span><br>
          Tipo: <span style="color:#fff; font-weight:bold; text-transform:capitalize;">${tipo}</span>
        </p>
      `;
    }

   if (esAdmin) {
      let columnaDiscogs = '';
      if (item.category !== 'Shirt' && item.category !== 'Playeras') {
        columnaDiscogs = `
          <div class="col-extras">
            <div class="row-col" style="width: 100%;">
              <span class="col-label" style="font-size: 10px;">MERCADO DISCOGS</span>
              <span class="col-value" style="margin-top: 5px;">
                ${item.discogs_url 
                  ? `<a href="${item.discogs_url}" target="_blank" style="background: #4da6ff; color: #000; padding: 5px 10px; border-radius: 4px; text-decoration: none; font-size: 11px; font-weight: bold;">↗ VER PRECIOS</a>` 
                  : (item.barcode 
                      ? `<button onclick="vincularDiscogsViejo('${item.id}', this)" style="background: transparent; color: #ffaa00; border: 1px solid #ffaa00; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 10px;">🔗 VINCULAR</button>` 
                      : `<span style="color: #555; font-size: 11px;">Falta código de barras</span>`)}
              </span>
            </div>
          </div>
        `;
      }

      const rowHTML = `
      <article class="item-row" style="display: flex; align-items: center;">
        <div class="row-image" style="width: 60px; height: 60px; margin-right: 15px; flex-shrink: 0;">
          <img src="${item.image_url || 'ruta_a_imagen_por_defecto.jpg'}" alt="cover" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;">
        </div>
        
        <div class="row-data" style="display: flex; flex: 1; align-items: center; width: 100%;">
          <div class="row-col col-cat">
            <span class="col-label">Categoría</span>
            <span class="col-value">${item.category}</span>
          </div>
          <div class="row-col name-col col-name">
            <span class="col-label">Nombre</span>
            <span class="col-value">${nombreAMostrar}</span>
          </div>
          <div class="row-col col-price">
            <span class="col-label">Precio</span>
            <span class="col-value">$${item.price} MXN</span>
          </div>
          <div class="row-col col-stock">
            <span class="col-label">Stock</span>
            <span class="col-value ${claseStock}">${item.stock}</span>
          </div>
          ${columnasRopa}
          ${columnaDiscogs}
          <div class="row-col col-btn">
            <button class="edit-btn" onclick="abrirEdicion('${item.id}')">✏️ Editar</button>
          </div>
        </div>
      </article>
      `;
      contenedor.innerHTML += rowHTML;

    } else {
      const stockHTML = item.stock <= 0 ? '<p class="stock-status red-text">NO STOCK</p>' : '<p class="stock-status"></p>';
      const botonAdd = (esPOS && item.stock > 0) ? `<button onclick="agregarAlTicket('${item.id}')" style="width: 100%; margin-top: auto; padding: 8px; background: #37ff8e; border: none; color: #000; border-radius: 4px; cursor: pointer; font-weight: bold;">+ ADD</button>` : '';

      const cardHTML = `
        <article class="album-card">
          <img src="${item.image_url}" alt="cover" class="album-cover">
          <div class="album-info">
            <div class="album-text">
              <p style="font-size: 10px; color: #888; text-transform: uppercase; margin: 4px 0 2px 0; letter-spacing: 1px;">${item.category}</p>
              <p class="album-title">${nombreAMostrar}</p>
              ${detallesRopaPOS}
              <p class="album-price" style="margin-top: 8px;">$${item.price} MXN</p>
            </div>
            ${stockHTML}
            ${botonAdd}
          </div>
        </article>
      `;
      contenedor.innerHTML += cardHTML;
    }
  });
}

cargarCatalogo();

// =========================================
// 4. INTERFAZ Y NAVEGACIÓN
// =========================================
const sidebar = document.getElementById('sidebar');
const openMenuBtn = document.getElementById('openMenu');
const closeMenuBtn = document.getElementById('closeMenu');

if(openMenuBtn && closeMenuBtn && sidebar) {
  openMenuBtn.addEventListener('click', () => sidebar.classList.add('open'));
  closeMenuBtn.addEventListener('click', () => sidebar.classList.remove('open'));
}

// =========================================
// 5. BUSCADOR GLOBAL (INTEGRADO A PAGINACIÓN)
// =========================================
const searchInput = document.querySelector('.search-input');

if (searchInput) {
  searchInput.addEventListener('input', (evento) => {
    busquedaActual = evento.target.value.toLowerCase().trim();
    paginaActual = 1; 
    actualizarVista();
  });

  searchInput.addEventListener('keypress', (evento) => {
    if (evento.key === 'Enter') {
      evento.preventDefault(); 
    }
  });
}

// =========================================
// 6. MODAL "NUEVO ARTÍCULO"
// =========================================
const btnCrearItem = document.getElementById('btnAbrirModalNuevo'); 
const modalNuevo = document.getElementById('modalNuevoItem');
const btnCerrarModal = document.getElementById('cerrarModalNuevo');
const inputDiscogs = document.getElementById('discogsScanner');
const btnGuardarSupabase = document.getElementById('btnGuardarSupabase'); 

const selectCategoria = document.getElementById('nuevaCategoria');
const divMusica = document.getElementById('camposMusica');
const divRopa = document.getElementById('camposRopa');

let discoTemporal = null;

window.alternarCampos = function(categoria) {
  const divMusica = document.getElementById('camposMusica');
  const divRopa = document.getElementById('camposRopa');
  
  if (categoria === "Shirt" || categoria === "Playeras") {
    if (divMusica) divMusica.style.display = 'none'; 
    if (divRopa) divRopa.style.display = 'block';    
  } else {
    if (divMusica) divMusica.style.display = 'block'; 
    if (divRopa) divRopa.style.display = 'none';      
  }
};

if (btnCrearItem && modalNuevo && inputDiscogs) {
  btnCrearItem.addEventListener('click', () => {
    modalNuevo.style.display = 'flex';
    if (selectCategoria.value !== "Shirt") {
      setTimeout(() => inputDiscogs.focus(), 100); 
    }
  });

  btnCerrarModal.addEventListener('click', () => {
    modalNuevo.style.display = 'none';
  });

  inputDiscogs.addEventListener('keypress', async (evento) => {
    if (evento.key === 'Enter') {
      const codigo = evento.target.value.trim();
      if (!codigo) return;

      console.log("Consultando nube de Discogs...");
      const disco = await buscarPorCodigoDeBarras(codigo); 

      if (disco) {
        const urlDiscogs = `https://www.discogs.com/release/${disco.id}`;
        discoTemporal = {
          barcode: codigo,
          image_url: disco.cover_image,
          discogs_url: urlDiscogs
        };
        document.getElementById('nuevoNombre').value = disco.title;
        document.getElementById('nuevoPrecioFinal').focus();
      } else {
        alert("Discogs no encontró este código de barras.");
      }
      evento.target.value = ''; 
    }
  });

  if (btnGuardarSupabase) {
    btnGuardarSupabase.addEventListener('click', async () => {
      const categoria = document.getElementById('nuevaCategoria').value;
      const precio = parseFloat(document.getElementById('nuevoPrecioFinal').value);
      let nombreFinal = document.getElementById('nuevoNombre').value;

      if (categoria === "Shirt" || categoria === "Playeras") {
        const talla = document.getElementById('nuevaTalla').value;
        const color = document.getElementById('nuevoColor').value || 'S/C';
        const tipo = document.getElementById('nuevoTipoRopa').value;
        nombreFinal = `${nombreFinal} - ${talla} - ${color} - ${tipo}`;
      }
      
      if (!nombreFinal || !precio) {
        alert("Faltan datos (Nombre o Precio).");
        return;
      }

      btnGuardarSupabase.innerText = "GUARDANDO..."; 
      const { data, error } = await db.from('Inventory').insert([{
        barcode: discoTemporal ? discoTemporal.barcode : '',
        title: nombreFinal,
        category: categoria,
        price: precio,
        stock: 1, 
        image_url: discoTemporal ? discoTemporal.image_url : '',
        discogs_url: discoTemporal ? discoTemporal.discogs_url : null
      }]);

      if (error) {
        alert("Hubo un error al guardar.");
        btnGuardarSupabase.innerText = "GUARDAR EN STOCK";
      } else {
        btnGuardarSupabase.innerText = "¡GUARDADO! ✔";
        btnGuardarSupabase.style.backgroundColor = "#00aa00"; 
        
        setTimeout(() => {
          document.getElementById('discogsScanner').value = '';
          document.getElementById('nuevoNombre').value = '';
          document.getElementById('nuevoPrecioFinal').value = '';
          if (document.getElementById('nuevoColor')) document.getElementById('nuevoColor').value = '';
          discoTemporal = null; 

          btnGuardarSupabase.innerText = "GUARDAR EN STOCK";
          btnGuardarSupabase.style.backgroundColor = "red"; 
          modalNuevo.style.display = 'none';
          cargarCatalogo(); 
        }, 800); 
      }
    });
  }
}

// =========================================
// 7. LÓGICA DE EDICIÓN DE ARTÍCULOS
// =========================================
let idItemEditando = null; 

window.alternarCamposEdicion = function(categoria) {
  const divMusica = document.getElementById('editCamposMusica');
  const divRopa = document.getElementById('editCamposRopa');
  
  if (categoria === "Shirt" || categoria === "Playeras") {
    if (divMusica) divMusica.style.display = 'none';
    if (divRopa) divRopa.style.display = 'block';
  } else {
    if (divMusica) divMusica.style.display = 'block';
    if (divRopa) divRopa.style.display = 'none';
  }
};

window.abrirEdicion = function(id) {
  const item = inventarioGlobal.find(i => i.id == id);
  if (!item) return;

  idItemEditando = item.id;
  
  document.getElementById('editCategoria').value = item.category;
  document.getElementById('editPrecio').value = item.price;
  document.getElementById('editStock').value = item.stock;
  document.getElementById('editBarcode').value = item.barcode || '';
  document.getElementById('editImagen').value = item.image_url || '';
  document.getElementById('editDiscogsUrl').value = item.discogs_url || '';
  document.getElementById('editNombre').value = item.title;

  if (item.category === 'Shirt' || item.category === 'Playeras') {
    const selectTalla = document.getElementById('editTalla');
    if (selectTalla && item.size) selectTalla.value = item.size.toUpperCase(); 
    document.getElementById('editColor').value = item.color || '';
    const selectTipo = document.getElementById('editTipoRopa');
    if (selectTipo && item.type && item.type !== 'Shirt') selectTipo.value = item.type;
  }

  alternarCamposEdicion(item.category);
  document.getElementById('modalEditarItem').style.display = 'flex';
};

const btnGuardarEdicion = document.getElementById('btnGuardarEdicion');
if (btnGuardarEdicion) {
  btnGuardarEdicion.addEventListener('click', async () => {
    if (!idItemEditando) return;

    const nuevaCat = document.getElementById('editCategoria').value;
    const datosActualizados = { 
      title: document.getElementById('editNombre').value, 
      price: parseFloat(document.getElementById('editPrecio').value), 
      stock: parseInt(document.getElementById('editStock').value),
      category: nuevaCat,
      barcode: document.getElementById('editBarcode').value,
      image_url: document.getElementById('editImagen').value,
      discogs_url: document.getElementById('editDiscogsUrl').value
    };

    if (nuevaCat === 'Shirt' || nuevaCat === 'Playeras') {
      datosActualizados.size = document.getElementById('editTalla').value;
      datosActualizados.color = document.getElementById('editColor').value || 'S/C';
      datosActualizados.type = document.getElementById('editTipoRopa').value;
    }

    btnGuardarEdicion.innerText = "ACTUALIZANDO...";
    const { data, error } = await db.from('Inventory').update(datosActualizados).eq('id', idItemEditando);

    if (error) {
      alert("Hubo un error al actualizar.");
      btnGuardarEdicion.innerText = "ACTUALIZAR ARTÍCULO";
    } else {
      btnGuardarEdicion.innerText = "¡ACTUALIZADO! ✔";
      btnGuardarEdicion.style.backgroundColor = "#37ff8e";
      btnGuardarEdicion.style.color = "#000";

      setTimeout(() => {
        document.getElementById('modalEditarItem').style.display = 'none';
        btnGuardarEdicion.innerText = "ACTUALIZAR ARTÍCULO";
        btnGuardarEdicion.style.backgroundColor = "#00aa00";
        btnGuardarEdicion.style.color = "white";
        idItemEditando = null;
        cargarCatalogo(); 
      }, 800);
    }
  });
}

const inputEditBarcode = document.getElementById('editBarcode');
if (inputEditBarcode) {
  inputEditBarcode.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); 
      const barcode = inputEditBarcode.value.trim();
      if (!barcode) return;

      inputEditBarcode.style.backgroundColor = '#333';
      inputEditBarcode.style.color = '#ffaa00';
      
      try {
        const disco = await buscarPorCodigoDeBarras(barcode);
        if (disco) {
          document.getElementById('editNombre').value = disco.title;
          document.getElementById('editImagen').value = disco.cover_image || disco.thumb || disco.image_url || '';
          inputEditBarcode.style.backgroundColor = '#00aa00';
          inputEditBarcode.style.color = '#fff';
        } else {
          alert("No se encontró ninguna coincidencia en Discogs para este código.");
          inputEditBarcode.style.backgroundColor = '#550000';
          inputEditBarcode.style.color = '#fff';
        }
      } catch (err) {
        alert("Hubo un problema de conexión con Discogs.");
      } finally {
        setTimeout(() => {
          inputEditBarcode.style.backgroundColor = '#fff';
          inputEditBarcode.style.color = '#000';
        }, 1500);
      }
    }
  });
}

// =========================================
// 8. CARRITO Y CHECKOUT (POS)
// =========================================
let carrito = []; 

window.agregarAlTicket = function(id) {
  const itemBD = inventarioGlobal.find(i => i.id == id);
  if (!itemBD || itemBD.stock <= 0) return;
  const itemEnCarrito = carrito.find(i => i.id == id);
  
  if (itemEnCarrito) {
    if (itemEnCarrito.cantidad < itemBD.stock) {
      itemEnCarrito.cantidad++;
    } else {
      alert("No hay más stock disponible de este artículo.");
    }
  } else {
    carrito.push({ id: itemBD.id, title: itemBD.title, price: itemBD.price, cantidad: 1 });
  }
  renderizarTicket();
};

window.quitarDelTicket = function(id) {
  carrito = carrito.filter(item => item.id != id); 
  renderizarTicket();
};

function renderizarTicket() {
  const contenedor = document.getElementById('contenedorTicket');
  if (!contenedor) return; 
  contenedor.innerHTML = '';
  carrito.forEach(item => {
    const rowHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 10px;">
        <div style="flex: 1;">
          <p style="margin: 0; font-size: 14px; font-weight: bold; color: #fff;">${item.title}</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #888;">$${item.price} x ${item.cantidad}</p>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end;">
          <p style="margin: 0; font-size: 14px; font-weight: bold; color: #37ff8e;">$${item.price * item.cantidad}</p>
          <button onclick="quitarDelTicket('${item.id}')" style="background: none; border: none; color: #ff3333; cursor: pointer; font-size: 12px; margin-top: 5px; font-weight: bold;">[ Quitar ]</button>
        </div>
      </div>
    `;
    contenedor.innerHTML += rowHTML;
  });
  actualizarTotales();
}

function actualizarTotales() {
  const lblTotalItems = document.getElementById('lblTotalItems');
  const lblGrandTotal = document.getElementById('lblGrandTotal');
  if (!lblTotalItems || !lblGrandTotal) return;

  let totalItems = 0;
  let grandTotal = 0;
  carrito.forEach(item => {
    totalItems += item.cantidad;
    grandTotal += (item.price * item.cantidad);
  });
  lblTotalItems.innerText = totalItems;
  lblGrandTotal.innerText = `$${grandTotal} MXN`;
}

window.procesarVenta = async function() {
  if (carrito.length === 0) return; 
  const btnCheckout = document.getElementById('btnCheckout');
  if (btnCheckout) {
    btnCheckout.innerText = "PROCESANDO...";
    btnCheckout.style.pointerEvents = "none"; 
    btnCheckout.style.backgroundColor = "#555";
    btnCheckout.style.color = "#fff";
  }

  try {
    for (let itemTicket of carrito) {
      const itemBD = inventarioGlobal.find(i => i.id == itemTicket.id);
      if (itemBD) {
        const nuevoStock = itemBD.stock - itemTicket.cantidad; 
        const { error } = await db.from('Inventory').update({ stock: nuevoStock }).eq('id', itemTicket.id);
        if (error) throw error;
      }
    }

    if (typeof guardarVentaEnHistorial === "function") {
      await guardarVentaEnHistorial(carrito);
    }

    carrito = []; 
    renderizarTicket(); 
    await cargarCatalogo(); 

    if (btnCheckout) {
      btnCheckout.innerText = "¡ÉXITO! ✔";
      btnCheckout.style.backgroundColor = "#37ff8e";
      btnCheckout.style.color = "#000";
      setTimeout(() => {
        btnCheckout.innerText = "CHECKOUT";
        btnCheckout.style.pointerEvents = "auto";
        btnCheckout.style.backgroundColor = "#fff";
        btnCheckout.style.color = "#000";
      }, 1500);
    }
  } catch (err) {
    alert("Hubo un problema de conexión al procesar la venta."); 
    if (btnCheckout) {
      btnCheckout.innerText = "CHECKOUT";
      btnCheckout.style.pointerEvents = "auto";
      btnCheckout.style.backgroundColor = "#fff";
      btnCheckout.style.color = "#000";
    }
  } 
};

// =========================================
// 9. VINCULAR DISCOS VIEJOS A DISCOGS
// =========================================
window.vincularDiscogsViejo = async function(idArticulo, btnElement) {
  try {
    const itemBD = inventarioGlobal.find(i => i.id == idArticulo);
    if (!itemBD || !itemBD.barcode) return;

    btnElement.innerHTML = "⏳ BUSCANDO...";
    btnElement.style.pointerEvents = "none";

    const disco = await buscarPorCodigoDeBarras(itemBD.barcode);
    if (!disco) throw new Error("No encontrado");

    const urlDiscogs = `https://www.discogs.com/release/${disco.id}`;
    const { error } = await db.from('Inventory').update({ discogs_url: urlDiscogs }).eq('id', idArticulo);
    if (error) throw error;

    await cargarCatalogo();
  } catch (error) {
    alert("Discogs no reconoció este código de barras.");
    btnElement.innerHTML = "🔗 REINTENTAR";
    btnElement.style.pointerEvents = "auto";
  }
};

// =========================================
// 10. SEGURIDAD Y AUTENTICACIÓN
// =========================================
window.addEventListener('DOMContentLoaded', async () => {
  const pagina = window.location.pathname.toLowerCase();
  const esPrivada = pagina.includes('admin.html') || pagina.includes('pos.html');
  
  const { data: { session } } = await db.auth.getSession(); 
  
  const btnSidebarLogin = document.getElementById('btnSidebarLogin');
  if (btnSidebarLogin) {
    if (session) {
      btnSidebarLogin.innerHTML = '⚙️ ADMIN';
      btnSidebarLogin.href = 'admin.html';
      btnSidebarLogin.style.color = '#37ff8e'; 
    } else {
      btnSidebarLogin.innerHTML = '👤 LOGIN';
      btnSidebarLogin.href = 'login.html';
      btnSidebarLogin.style.color = ''; 
    }
  }

  if (esPrivada && !session) {
    window.location.href = 'login.html';
    return;
  }
  if (pagina.includes('login.html') && session) {
    window.location.href = 'admin.html';
    return;
  }
  if (!pagina.includes('login.html')) {
    cargarCatalogo();
  }
});

const btnLogin = document.getElementById('btnLogin');
if (btnLogin) {
  btnLogin.addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    if(!email || !pass) return;

    btnLogin.innerText = "VERIFICANDO...";
    const { data, error } = await db.auth.signInWithPassword({ email: email, password: pass });

    if (error) {
      alert("Acceso denegado: Revisa tus credenciales.");
      btnLogin.innerText = "ENTRAR";
    } else {
      window.location.href = 'admin.html';
    }
  });
}

const botonesLogOff = document.querySelectorAll('.log-off');
botonesLogOff.forEach(btn => {
  btn.addEventListener('click', async () => {
    await db.auth.signOut();
    window.location.href = 'login.html';
  });
});

// =========================================
// 11. CORTE DE CAJA EN LA NUBE Y PDF
// =========================================
window.guardarVentaEnHistorial = async function(itemsVenta) {
  let totalVenta = itemsVenta.reduce((acc, item) => acc + (item.price * item.cantidad), 0);
  const { data: { session } } = await db.auth.getSession();
  const cajero = session ? session.user.email : "Usuario Local";
  const { error } = await db.from('Sales').insert([{ total: totalVenta, items: itemsVenta, cashier: cajero }]);
};

window.addEventListener('DOMContentLoaded', async () => {
  if (!window.location.pathname.toLowerCase().includes('corte.html')) return;

  const tablaDesglose = document.getElementById('tablaDesglose');
  const lblIngresos = document.getElementById('lblIngresosTotales');
  const lblArticulos = document.getElementById('lblArticulosVendidos');

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const { data: ventasNube, error } = await db.from('Sales').select('*').gte('created_at', hoy.toISOString());

  if (error) {
    if(tablaDesglose) tablaDesglose.innerHTML = `<p style="color: #ff3333; text-align: center;">Error de conexión con la nube.</p>`;
    return;
  }

  const historial = ventasNube || [];
  let totalIngresos = 0;
  let totalArticulos = 0;
  let resumenArticulos = {}; 

  historial.forEach(venta => {
    let items = typeof venta.items === 'string' ? JSON.parse(venta.items) : venta.items;
    if (items) {
      items.forEach(item => {
        totalIngresos += (item.price * item.cantidad);
        totalArticulos += item.cantidad;

        if (resumenArticulos[item.title]) {
          resumenArticulos[item.title].cantidad += item.cantidad;
          resumenArticulos[item.title].subtotal += (item.price * item.cantidad);
        } else {
          resumenArticulos[item.title] = {
            precio: item.price,
            cantidad: item.cantidad,
            subtotal: item.price * item.cantidad
          };
        }
      });
    }
  });

  if (lblIngresos) lblIngresos.innerText = `$${totalIngresos} MXN`;
  if (lblArticulos) lblArticulos.innerText = totalArticulos;

  if (Object.keys(resumenArticulos).length > 0) {
    tablaDesglose.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; color: #fff; font-size: 13px;">
        <thead>
          <tr style="border-bottom: 1px solid #444; text-align: left; color: #888;">
            <th style="padding: 8px;">ARTÍCULO</th>
            <th style="padding: 8px; text-align: center;">CANTIDAD</th>
            <th style="padding: 8px; text-align: right;">SUBTOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(resumenArticulos).map(([nombre, datos]) => `
            <tr style="border-bottom: 1px solid #222;">
              <td style="padding: 10px;">${nombre}</td>
              <td style="padding: 10px; text-align: center;">${datos.cantidad}</td>               <td style="padding: 10px; text-align: right; color: #37ff8e; font-weight: bold;">$${datos.subtotal} MXN</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    tablaDesglose.innerHTML = `<p style="color: #888; text-align: center;">No hay ventas registradas hoy en la red.</p>`;
  }

  const btnPDF = document.getElementById('btnDescargarPDF');
  if (btnPDF) {
    btnPDF.addEventListener('click', () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("LOVE & HATE - CORTE DE CAJA", 14, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Fecha de corte: ${new Date().toLocaleDateString()}`, 14, 28);
      doc.line(14, 32, 196, 32); 

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`Ingresos Totales: $${totalIngresos} MXN`, 14, 42);
      doc.text(`Articulos Vendidos: ${totalArticulos}`, 14, 50);
      doc.line(14, 56, 196, 56);

      let y = 66;
      doc.setFontSize(11);
      doc.text("Desglose de Ventas:", 14, y);
      y += 8;

      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text("ARTICULO", 14, y);
      doc.text("CANT", 140, y);
      doc.text("SUBTOTAL", 170, y);
      y += 4;
      doc.line(14, y, 196, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);

      Object.entries(resumenArticulos).forEach(([nombre, datos]) => {
        const nombreCorto = doc.splitTextToSize(nombre, 120);
        doc.text(nombreCorto, 14, y);
        doc.text(datos.cantidad.toString(), 140, y);
        doc.text(`$${datos.subtotal} MXN`, 170, y);
        y += (nombreCorto.length * 6) + 4;
        
        if (y > 270) { 
          doc.addPage();
          y = 20;
        }
      });
      doc.save(`corte-caja-${new Date().toISOString().slice(0,10)}.pdf`);
    });
  }

  const btnCerrarTurno = document.getElementById('btnCerrarTurno');
  if (btnCerrarTurno) {
    btnCerrarTurno.addEventListener('click', async () => {
      const confirmar = confirm("¿Estás seguro de cerrar turno y salir del sistema?");
      if (!confirmar) return;
      await db.auth.signOut();
      window.location.href = 'login.html';
    });
  }
});
