// =========================================
// 1. CONFIGURACIÓN DE APIs
// =========================================
// Discogs
const discogsToken = 'MoULOWotMYgLOPkTmlpzqAOLdaWVYetxnNKvMxvh'; 

// Supabase
const supabaseUrl = 'https://ygzocglafldsjpvdiqpl.supabase.co'; 
const supabaseKey = 'sb_publishable_PfRk21ghxhOMuF-J9DLkMA_MpM6LYsg'; 
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

// Memoria global
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

async function obtenerPreciosMercado(idDiscogs) {
  try {
    // Le ordenamos a la API que devuelva los datos directamente en Pesos Mexicanos
    const url = `https://api.discogs.com/releases/${idDiscogs}?curr_abbr=MXN`;
    const respuesta = await fetch(url, {
      headers: { 'Authorization': `Discogs token=${discogsToken}` }
    });
    const datos = await respuesta.json();
    
    // Discogs ahora nos entrega este número ya convertido a MXN
    const precioBaseMXN = datos.lowest_price || 0;
    
    // Calculamos las proyecciones en base al precio más bajo del mercado actual
    return {
      min: precioBaseMXN.toFixed(2),
      med: (precioBaseMXN * 1.5).toFixed(2), 
      max: (precioBaseMXN * 2).toFixed(2)  
    };
  } catch (error) {
    return { min: 0, med: 0, max: 0 };
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
let paginaActual = 1;

window.cambiarFiltro = function(categoria, boton) {
  filtroActual = categoria;
  paginaActual = 1; // Regresa a la página 1 al cambiar de filtro
  
  // Actualiza el color verde en los botones
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  if (boton) boton.classList.add('active');

  actualizarVista();
};

window.cambiarPagina = function(numero) {
  paginaActual = numero;
  actualizarVista();
};

window.actualizarVista = function() {
  let datos = inventarioGlobal;

  //Detectamos en qué pantalla estamos para definir el límite
  const esAdmin = document.querySelector('.inventory-list') !== null;
  const itemsPorPagina = esAdmin ? 40 : 10;

  // 1. Filtrar
  if (filtroActual !== 'All') {
    datos = datos.filter(item => item.category === filtroActual);
  }

  // 2. Ordenar (Sin stock al fondo, luego alfabético)
  datos.sort((a, b) => {
    if (a.stock <= 0 && b.stock > 0) return 1;  
    if (a.stock > 0 && b.stock <= 0) return -1; 
    if (a.title < b.title) return -1;
    if (a.title > b.title) return 1;
    return 0; 
  });

  // 3. Paginar (Cortar la lista en rebanadas de 40)
  const totalPaginas = Math.ceil(datos.length / itemsPorPagina) || 1;
  const inicio = (paginaActual - 1) * itemsPorPagina;
  const fin = inicio + itemsPorPagina;
  const datosPaginados = datos.slice(inicio, fin);

  // 4. Dibujar Pantalla
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
// 3. RENDERIZADO VISUAL ACTUALIZADO
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
    
    // --- MAGIA PARA LAS PLAYERAS ---
    let nombreAMostrar = item.title;
    let columnasRopa = '';
    let detallesRopaPOS = '';

    if (item.category === 'Shirt' || item.category === 'Playeras') {
      // Leemos directamente de tus columnas de Supabase
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
      // Columna de Discogs SOLO para música
      let columnaDiscogs = '';
      if (item.category !== 'Shirt' && item.category !== 'Playeras') {
      columnaDiscogs = `
        <div class="col-extras">
          <div class="row-col" style="width: 100%;">
            <span class="col-label" style="font-size: 10px;">DISCOGS (MIN|MED|MAX)</span>
            <span class="col-value" style="color: #aaa; display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: bold;">
              <span style="color: #ff3333;">$${item.price_min || 0}</span> | 
              <span style="color: #37ff8e;">$${item.price_med || 0}</span> | 
              <span style="color: #4da6ff;">$${item.price_max || 0}</span>
              ${item.barcode ? `<button onclick="refrescarPrecioDiscogs('${item.id}', this)" style="background: none; border: none; cursor: pointer; color: #4da6ff;">🔄</button>` : ''}
            </span>
          </div>
        </div>
      `;
    }

      // DIBUJAR FILA (Admin) STOCK
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

          <!-- AQUÍ SE INYECTAN LOS EXTRAS -->
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
      // DIBUJAR TARJETA (POS)
      const stockHTML = item.stock <= 0 ? '<p class="stock-status red-text">NO STOCK</p>' : '<p class="stock-status"></p>';
      const botonAdd = (esPOS && item.stock > 0) ? `<button onclick="agregarAlTicket('${item.id}')
        "style="width: 100%; margin-top: auto; padding: 8px; background: #37ff8e; border: none; color: #000; border-radius: 4px; cursor: pointer; font-weight: bold;"
        >+ ADD</button>` : '';

      const cardHTML = `
        <article class="album-card">
          <img src="${item.image_url}" alt="cover" class="album-cover">
          <div class="album-info">
            <div class="album-text">
              <p class="album-title">${nombreAMostrar}</p>
              ${detallesRopaPOS} <!-- Los detalles de ropa inyectados en la tarjeta -->
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

// Ejecutamos la carga inicial
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

// Filtros de Categoría
const botonesFiltro = document.querySelectorAll('.public-filters .chip');
botonesFiltro.forEach(boton => {
  boton.addEventListener('click', (evento) => {
    botonesFiltro.forEach(btn => btn.classList.remove('active'));
    
    const botonClickeado = evento.target;
    botonClickeado.classList.add('active');

    const categoriaSeleccionada = botonClickeado.getAttribute('data-category');
    
    let resultadosFiltrados = categoriaSeleccionada === 'All' 
      ? inventarioGlobal 
      : inventarioGlobal.filter(item => item.category === categoriaSeleccionada);

    renderizarTarjetas(resultadosFiltrados);
  });
});


// =========================================
// 5. BUSCADOR GLOBAL (SÓLO SUPABASE)
// =========================================
const searchInput = document.querySelector('.search-input');

if (searchInput) {
  // A. Búsqueda manual por texto (Teclado normal)
  searchInput.addEventListener('input', (evento) => {
    const textoBuscado = evento.target.value.toLowerCase();
    const resultadosFiltrados = inventarioGlobal.filter(item => {
      return item.title.toLowerCase().includes(textoBuscado);
    });
    renderizarTarjetas(resultadosFiltrados);
  });

  // B. Búsqueda por Escáner Físico (Código + Enter)
  searchInput.addEventListener('keypress', (evento) => {
    if (evento.key === 'Enter') {
      const codigoEscaneado = evento.target.value.trim();
      if (!codigoEscaneado) return;

      console.log("Buscando en Stock Local (Supabase)...");
      
      // Busca en la memoria global si el código coincide (asegúrate de que en Supabase tu columna se llame 'barcode')
      const resultadosFiltrados = inventarioGlobal.filter(item => {
        return item.barcode === codigoEscaneado || item.codigo_barras === codigoEscaneado;
      });

      if (resultadosFiltrados.length > 0) {
        console.log("¡Encontrado en local!");
        renderizarTarjetas(resultadosFiltrados);
      } else {
        alert("Este artículo NO está en tu inventario local.");
      }
      
      evento.target.value = ''; // Limpia la barra para el siguiente escaneo
    }
  });
}


// =========================================
// 6. MODAL "NUEVO ARTÍCULO"
// =========================================
// CORRECCIÓN: Ahora buscamos el botón por su ID exacto
const btnCrearItem = document.getElementById('btnAbrirModalNuevo'); 
const modalNuevo = document.getElementById('modalNuevoItem');
const btnCerrarModal = document.getElementById('cerrarModalNuevo');
const inputDiscogs = document.getElementById('discogsScanner');
const btnGuardarSupabase = document.getElementById('btnGuardarSupabase'); 

// Atrapamos los contenedores dinámicos del HTML
const selectCategoria = document.getElementById('nuevaCategoria');
const divMusica = document.getElementById('camposMusica');
const divRopa = document.getElementById('camposRopa');

// 1. Memoria temporal para guardar la imagen y el código que no están a la vista
let discoTemporal = null;

// 2. Escuchador para alternar los campos dependiendo de la categoría
window.alternarCampos = function(categoria) {
  const divMusica = document.getElementById('camposMusica');
  const divRopa = document.getElementById('camposRopa');
  
  console.log("Categoría seleccionada:", categoria); 
  
  if (categoria === "Shirt" || categoria === "Playeras") {
    if (divMusica) divMusica.style.display = 'none'; 
    if (divRopa) divRopa.style.display = 'block';    
  } else {
    if (divMusica) divMusica.style.display = 'block'; 
    if (divRopa) divRopa.style.display = 'none';      
  }
};

if (btnCrearItem && modalNuevo && inputDiscogs) {
  
  // Abrir Modal
  btnCrearItem.addEventListener('click', () => {
    modalNuevo.style.display = 'flex';
    // Si estamos en categoría música, enfocamos el escáner automáticamente
    if (selectCategoria.value !== "Shirt") {
      setTimeout(() => inputDiscogs.focus(), 100); 
    }
  });

  // Cerrar Modal
  btnCerrarModal.addEventListener('click', () => {
    modalNuevo.style.display = 'none';
  });

  // Escáner de Discogs dentro del Modal
  inputDiscogs.addEventListener('keypress', async (evento) => {
    if (evento.key === 'Enter') {
      const codigo = evento.target.value.trim();
      if (!codigo) return;

      console.log("Consultando nube de Discogs...");
      const disco = await buscarPorCodigoDeBarras(codigo); 

      if (disco) {
        // Guardamos la imagen y el código en memoria
        discoTemporal = {
          barcode: codigo,
          image_url: disco.cover_image
        };
        
        // Llenamos el nombre
        document.getElementById('nuevoNombre').value = disco.title;
        
        // Buscamos y llenamos los precios
        const precios = await obtenerPreciosMercado(disco.id);
        document.getElementById('lblMin').innerText = precios.min;
        document.getElementById('lblMed').innerText = precios.med;
        document.getElementById('lblMax').innerText = precios.max;

        document.getElementById('nuevoPrecioFinal').value = precios.med;
        
      } else {
        alert("Discogs no encontró este código de barras.");
      }
      
      evento.target.value = ''; // Limpiamos para evitar escanear doble
    }
  });

  // LÓGICA DE GUARDADO EN SUPABASE
  if (btnGuardarSupabase) {
    btnGuardarSupabase.addEventListener('click', async () => {
      
      // A. Recolectamos datos
      const categoria = document.getElementById('nuevaCategoria').value;
      const precio = parseFloat(document.getElementById('nuevoPrecioFinal').value);
      let nombreFinal = document.getElementById('nuevoNombre').value;
      
      // NUEVO: Atrapamos Min, Med y Max de la interfaz
      let precioMin = null;
      let precioMed = null;
      let precioMax = null;
      
      if (categoria !== "Shirt" && categoria !== "Playeras") {
        precioMin = parseFloat(document.getElementById('lblMin').innerText) || null;
        precioMed = parseFloat(document.getElementById('lblMed').innerText) || null;
        precioMax = parseFloat(document.getElementById('lblMax').innerText) || null;
      }

      // B. Si es ropa, armamos el nombre concatenado
      if (categoria === "Shirt" || categoria === "Playeras") {
        const talla = document.getElementById('nuevaTalla').value;
        const color = document.getElementById('nuevoColor').value || 'S/C';
        const tipo = document.getElementById('nuevoTipoRopa').value;
        nombreFinal = `${nombreFinal} - ${talla} - ${color} - ${tipo}`;
      }
      
      // Validación rápida
      if (!nombreFinal || !precio) {
        alert("Faltan datos (Nombre o Precio).");
        return;
      }

      console.log("Guardando en inventario...");
      btnGuardarSupabase.innerText = "GUARDANDO..."; 

      // C. Insertamos a Supabase con las 3 columnas nuevas
      const { data, error } = await db.from('Inventory').insert([
        {
          barcode: discoTemporal ? discoTemporal.barcode : '',
          title: nombreFinal,
          category: categoria,
          price: precio,
          stock: 1, 
          image_url: discoTemporal ? discoTemporal.image_url : '',
          price_min: precioMin,
          price_med: precioMed,
          price_max: precioMax
        }
      ]);

      if (error) {
        console.error("Error al guardar en Supabase:", error);
        alert("Hubo un error al guardar. Revisa la consola.");
        btnGuardarSupabase.innerText = "GUARDAR EN STOCK";
      } else {
        // D. Éxito: Feedback visual rápido
        btnGuardarSupabase.innerText = "¡GUARDADO! ✔";
        btnGuardarSupabase.style.backgroundColor = "#00aa00"; 
        
        setTimeout(() => {
          // Limpiar el formulario
          document.getElementById('discogsScanner').value = '';
          document.getElementById('nuevoNombre').value = '';
          document.getElementById('nuevoPrecioFinal').value = '';
          if (document.getElementById('nuevoColor')) document.getElementById('nuevoColor').value = '';
          document.getElementById('lblMin').innerText = '0';
          document.getElementById('lblMed').innerText = '0';
          document.getElementById('lblMax').innerText = '0';
          discoTemporal = null; 

          // Restaurar botón, cerrar ventana y refrescar catálogo
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

// A. Función para alternar visualmente Ropa/Música en el modal de edición
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

// B. Función que abre el modal y llena los datos
window.abrirEdicion = function(id) {
  const item = inventarioGlobal.find(i => i.id == id);
  if (!item) return;

  idItemEditando = item.id;
  
  // Llenamos los campos básicos comunes
  document.getElementById('editCategoria').value = item.category;
  document.getElementById('editPrecio').value = item.price;
  document.getElementById('editStock').value = item.stock;
  document.getElementById('editBarcode').value = item.barcode || '';
  document.getElementById('editImagen').value = item.image_url || '';
  document.getElementById('editNombre').value = item.title;

  // Llenamos los campos de ropa directamente desde la base de datos
  if (item.category === 'Shirt' || item.category === 'Playeras') {
    const selectTalla = document.getElementById('editTalla');
    if (selectTalla && item.size) selectTalla.value = item.size.toUpperCase(); // Para que coincida con "M", "L", etc.
    
    document.getElementById('editColor').value = item.color || '';
    
    const selectTipo = document.getElementById('editTipoRopa');
    if (selectTipo && item.type && item.type !== 'Shirt') selectTipo.value = item.type;
  }

  alternarCamposEdicion(item.category);
  document.getElementById('modalEditarItem').style.display = 'flex';
};

// C. Botón de Actualizar en Supabase
const btnGuardarEdicion = document.getElementById('btnGuardarEdicion');
if (btnGuardarEdicion) {
  btnGuardarEdicion.addEventListener('click', async () => {
    if (!idItemEditando) return;

    const nuevaCat = document.getElementById('editCategoria').value;
    
    // Preparamos el paquete de datos a actualizar
    const datosActualizados = { 
      title: document.getElementById('editNombre').value, 
      price: parseFloat(document.getElementById('editPrecio').value), 
      stock: parseInt(document.getElementById('editStock').value),
      category: nuevaCat,
      barcode: document.getElementById('editBarcode').value,
      image_url: document.getElementById('editImagen').value
    };

    // Si es ropa, agregamos los campos extra a sus columnas en Supabase
    if (nuevaCat === 'Shirt' || nuevaCat === 'Playeras') {
      datosActualizados.size = document.getElementById('editTalla').value;
      datosActualizados.color = document.getElementById('editColor').value || 'S/C';
      datosActualizados.type = document.getElementById('editTipoRopa').value;
    }

    btnGuardarEdicion.innerText = "ACTUALIZANDO...";

    // Mandamos el UPDATE a Supabase
    const { data, error } = await db.from('Inventory')
      .update(datosActualizados)
      .eq('id', idItemEditando);

    if (error) {
      console.error("Error al actualizar:", error);
      alert("Hubo un error al actualizar.");
      btnGuardarEdicion.innerText = "ACTUALIZAR ARTÍCULO";
    } else {
      btnGuardarEdicion.innerText = "¡ACTUALIZADO! ✔";
      btnGuardarEdicion.style.backgroundColor = "#37ff8e";
      btnGuardarEdicion.style.color = "#000";

      setTimeout(() => {
        document.getElementById('modalEditarItem').style.display = 'none';
        btnGuardarEdicion.innerText = "ACTUALIZAR ARTÍCULO";
        idItemEditando = null;
        
        cargarCatalogo(); 
      }, 800);
    }
  });
}

// D. Escáner de Discogs dentro del modal de Edición
const inputEditBarcode = document.getElementById('editBarcode');
if (inputEditBarcode) {
  inputEditBarcode.addEventListener('keypress', async (e) => {
    // Los lectores de barras mandan un "Enter" al final de la lectura
    if (e.key === 'Enter') {
      e.preventDefault(); // Evita que la página intente recargarse
      
      const barcode = inputEditBarcode.value.trim();
      if (!barcode) return;

      // Efecto visual de "Buscando..."
      inputEditBarcode.style.backgroundColor = '#333';
      inputEditBarcode.style.color = '#ffaa00';
      
      try {
        console.log(`Re-buscando código ${barcode} en Discogs...`);
        // Usamos la misma función de Discogs que ya tienes en la Sección 1
        const disco = await buscarPorCodigoDeBarras(barcode);
        
        if (disco) {
          // Si lo encuentra, sobreescribe los campos de texto
          document.getElementById('editNombre').value = disco.title;
          document.getElementById('editImagen').value = disco.cover_image || disco.thumb || disco.image_url || '';
          
          // Efecto visual de éxito
          inputEditBarcode.style.backgroundColor = '#00aa00';
          inputEditBarcode.style.color = '#fff';
        } else {
          alert("No se encontró ninguna coincidencia en Discogs para este código.");
          inputEditBarcode.style.backgroundColor = '#550000';
          inputEditBarcode.style.color = '#fff';
        }
      } catch (err) {
        console.error("Error al buscar en Discogs desde edición:", err);
        alert("Hubo un problema de conexión con Discogs.");
      } finally {
        // Regresa el campo a su color normal después de 1.5 segundos
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
let carrito = []; // Memoria temporal del ticket

// A. Agregar artículo al ticket
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
    carrito.push({
      id: itemBD.id,
      title: itemBD.title,
      price: itemBD.price,
      cantidad: 1
    });
  }
  
  renderizarTicket();
};

// B. Quitar artículo del ticket
window.quitarDelTicket = function(id) {
  // También usamos != flexible aquí por seguridad
  carrito = carrito.filter(item => item.id != id); 
  renderizarTicket();
};

// C. Dibujar el ticket en la barra lateral
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

// D. Calcular sumas y actualizar etiquetas
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

// E. CHECKOUT: Restar de Supabase y vaciar ticket
window.procesarVenta = async function() {
  // Si no hay nada en el carrito, simplemente ignoramos el clic (sin alertas)
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
        
        const { error } = await db.from('Inventory')
          .update({ stock: nuevoStock })
          .eq('id', itemTicket.id);

        if (error) throw error;
      }
    }

    // GUARDAR LA VENTA EN LA NUBE (Para el Corte de Caja)
    if (typeof guardarVentaEnHistorial === "function") {
      await guardarVentaEnHistorial(carrito);
    }

    carrito = []; 
    renderizarTicket(); 
    await cargarCatalogo(); 

    // ÉXITO VISUAL: El botón se pone verde sin lanzar pop-ups molestos
    if (btnCheckout) {
      btnCheckout.innerText = "¡ÉXITO! ✔";
      btnCheckout.style.backgroundColor = "#37ff8e";
      btnCheckout.style.color = "#000";
      
      // Regresa a ser el botón normal de CHECKOUT después de 1.5 segundos
      setTimeout(() => {
        btnCheckout.innerText = "CHECKOUT";
        btnCheckout.style.pointerEvents = "auto";
        btnCheckout.style.backgroundColor = "#fff";
        btnCheckout.style.color = "#000";
      }, 1500);
    }

  } catch (err) {
    console.error("Error en el checkout:", err);
    alert("Hubo un problema de conexión al procesar la venta."); // Solo alertamos si hay un error real de internet o base de datos
    
    // Restauramos el botón si hubo error
    if (btnCheckout) {
      btnCheckout.innerText = "CHECKOUT";
      btnCheckout.style.pointerEvents = "auto";
      btnCheckout.style.backgroundColor = "#fff";
      btnCheckout.style.color = "#000";
    }
  } 
};

// =========================================
// 9. ACTUALIZAR PRECIO DE MERCADO (DISCOGS)
// =========================================
window.refrescarPrecioDiscogs = async function(idArticulo, btnElement) {
  try {
    // 1. Encontrar el artículo para sacar su código de barras
    const itemBD = inventarioGlobal.find(i => i.id == idArticulo);
    if (!itemBD || !itemBD.barcode) {
      alert("Este artículo no tiene código de barras guardado.");
      return;
    }

    console.log(`Buscando nuevos precios para el código: ${itemBD.barcode}...`);
    
    // Cambiar el botón visualmente para que sepas que está cargando
    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = "⏳";
    btnElement.style.pointerEvents = "none";

    // 2. Buscar en Discogs
    const disco = await buscarPorCodigoDeBarras(itemBD.barcode);
    if (!disco) throw new Error("No se encontró en Discogs");

    // Traemos los tres precios
    const precios = await obtenerPreciosMercado(disco.id);

    // 3. Actualizamos LAS 3 COLUMNAS NUEVAS en Supabase
    const { error } = await db.from('Inventory')
      .update({
        price_min: precios.min,
        price_med: precios.med,
        price_max: precios.max
      })
      .eq('id', idArticulo);

    if (error) throw error;

    console.log("¡Precios de mercado actualizados en Supabase!");

    // 4. Recargar el catálogo para que la tarjeta se redibuje con los 3 números nuevos
    await cargarCatalogo();

  } catch (error) {
    console.error("Error al refrescar precios:", error);
    alert("Hubo un problema al contactar a Discogs o guardar en la base de datos.");
    
    // Restaurar el botón si falla
    btnElement.innerHTML = "🔄";
    btnElement.style.pointerEvents = "auto";
  }
};

// =========================================
// 10. SEGURIDAD Y AUTENTICACIÓN
// =========================================

// 1. Escudo protector de rutas
window.addEventListener('DOMContentLoaded', async () => {
  const pagina = window.location.pathname.toLowerCase();
  const esPrivada = pagina.includes('admin.html') || pagina.includes('pos.html');
  
  // Revisamos en la memoria de Supabase si hay una sesión activa
  const { data: { session } } = await db.auth.getSession(); 

  // --- NUEVO: ACTUALIZAR BOTÓN DEL MENÚ PÚBLICO ---
  const btnSidebarLogin = document.getElementById('btnSidebarLogin');
  if (btnSidebarLogin) {
    if (session) {
      btnSidebarLogin.innerHTML = '⚙️ ADMIN';
      btnSidebarLogin.href = 'admin.html';
      btnSidebarLogin.style.color = '#37ff8e'; // Lo pintamos de tu verde neón
    } else {
      btnSidebarLogin.innerHTML = '👤 LOGIN';
      btnSidebarLogin.href = 'login.html';
      btnSidebarLogin.style.color = ''; // Regresa al color normal
    }
  }

  // Si intentan entrar a POS/Admin sin estar logueados, los pateamos al login
  if (esPrivada && !session) {
    window.location.href = 'login.html';
    return;
  }

  // Si ya están logueados y abren la pantalla de login, los mandamos directo a trabajar
  if (pagina.includes('login.html') && session) {
    window.location.href = 'admin.html';
    return;
  }

  // Si pasaron la aduana y no están en login, descargamos la base de datos
  if (!pagina.includes('login.html')) {
    cargarCatalogo();
  }
});

// 2. Botón de Entrar (En login.html)
const btnLogin = document.getElementById('btnLogin');
if (btnLogin) {
  btnLogin.addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    
    if(!email || !pass) return;

    btnLogin.innerText = "VERIFICANDO...";

    const { data, error } = await db.auth.signInWithPassword({
      email: email,
      password: pass
    });

    if (error) {
      alert("Acceso denegado: Revisa tus credenciales.");
      btnLogin.innerText = "ENTRAR";
    } else {
      window.location.href = 'admin.html';
    }
  });
}

// 3. Botón de Salir (Log Off del menú lateral)
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

// A. Guardar venta en Supabase (Sincronización Multi-Dispositivo)
window.guardarVentaEnHistorial = async function(itemsVenta) {
  let totalVenta = itemsVenta.reduce((acc, item) => acc + (item.price * item.cantidad), 0);
  
  // Identificamos quién está cobrando
  const { data: { session } } = await db.auth.getSession();
  const cajero = session ? session.user.email : "Usuario Local";

  // Insertamos en la tabla 'Sales' (Con mayúscula)
  const { error } = await db.from('Sales').insert([
    { 
      total: totalVenta, 
      items: itemsVenta,
      cashier: cajero 
    }
  ]);

  if (error) {
    console.error("Error al sincronizar la venta en la nube:", error);
  }
};

// B. Inicializador de la vista de Corte (Se ejecuta solo en corte.html)
window.addEventListener('DOMContentLoaded', async () => {
  if (!window.location.pathname.toLowerCase().includes('corte.html')) return;

  const tablaDesglose = document.getElementById('tablaDesglose');
  const lblIngresos = document.getElementById('lblIngresosTotales');
  const lblArticulos = document.getElementById('lblArticulosVendidos');

  // 1. Definimos la fecha de hoy (a las 00:00 hrs) para traer solo el corte del día actual
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // 2. Descargamos las ventas de HOY desde Supabase (Tabla 'Sales')
  const { data: ventasNube, error } = await db
    .from('Sales')
    .select('*')
    .gte('created_at', hoy.toISOString());

  if (error) {
    console.error("Error consultando cortes:", error);
    if(tablaDesglose) tablaDesglose.innerHTML = `<p style="color: #ff3333; text-align: center;">Error de conexión con la nube.</p>`;
    return;
  }

  const historial = ventasNube || [];
  let totalIngresos = 0;
  let totalArticulos = 0;
  let resumenArticulos = {}; 

  // 3. Procesamos los datos de la nube
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

  // 4. Actualizamos la pantalla visualmente
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

  // C. Botón Descargar PDF
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

  // D. Botón Cerrar Turno
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