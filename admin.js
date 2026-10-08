// ============================================================
// admin.js — Supabase Entegrasyonlu Tam Kod
// ============================================================

document.addEventListener('DOMContentLoaded', function(){
  document.getElementById('admin-login-form').addEventListener('submit', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('refresh-btn').addEventListener('click', loadAppointments);
  document.getElementById('site-content-form').addEventListener('submit', handleContentSave);
  document.getElementById('add-service-btn').addEventListener('click', addEditableService);

  document.querySelectorAll('[data-admin-tab]').forEach(button => {
    button.addEventListener('click', () => activateAdminTab(button.dataset.adminTab));
  });

  document.getElementById('editable-services').addEventListener('click', event => {
    const removeButton = event.target.closest('[data-remove-service]');
    if(removeButton) removeButton.closest('.admin-service-editor').remove();
  });

  document.getElementById('editable-booking-services').addEventListener('click', event => {
    const addButton = event.target.closest('[data-add-booking-service]');
    if(addButton){
      addEditableBookingService(addButton.dataset.addBookingService);
      return;
    }
    const removeButton = event.target.closest('[data-remove-booking-service]');
    if(removeButton){
      removeButton.closest('.admin-service-editor').remove();
    }
  });

  document.getElementById('content-hero-image').addEventListener('change', event => previewImage(event.target, 'hero-image-preview'));
  document.getElementById('content-about-image').addEventListener('change', event => previewImage(event.target, 'about-image-preview'));

  const barberFilter = document.getElementById('admin-barber-filter');
  if(barberFilter){
    barberFilter.innerHTML = '<option value="all">Tümü</option>' + BARBERS.map(barber => `<option value="${barber.id}">${barber.names?.tr || barber.name}</option>`).join('');
    barberFilter.addEventListener('change', loadAppointments);
  }

  const dateFilter = document.getElementById('admin-date-filter');
  if(dateFilter){
    dateFilter.addEventListener('change', loadAppointments);
  }

  window.addEventListener('gentlemens-barber-appointments-updated', () => {
    loadAppointments();
  });

  if(getAdminSession()?.access_token){
    showPanel();
  }
});

async function handleLogin(e){
  e.preventDefault();
  const msgBox = document.getElementById('admin-login-msg');
  const button = e.target.querySelector('button[type="submit"]');
  button.disabled = true;
  msgBox.textContent = '';
  try{
    const response = await supabaseAuthRequest('token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('admin-email').value.trim(),
        password: document.getElementById('admin-pass').value
      })
    });
    sessionStorage.setItem('adminAuthSession', JSON.stringify(await response.json()));
    showPanel();
  }catch(err){
    msgBox.innerHTML = `<div class="msg err">Giriş başarısız: ${escapeHtml(err.message)}</div>`;
  }finally{
    button.disabled = false;
  }
}

function handleLogout(){
  const session = getAdminSession();
  if(session?.access_token){
    supabaseAuthRequest('logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    }).catch(err => console.warn('Supabase oturumu kapatılamadı:', err));
  }
  sessionStorage.removeItem('adminAuthSession');
  document.getElementById('login-view').style.display = '';
  document.getElementById('panel-view').style.display = 'none';
  document.getElementById('admin-email').value = '';
  document.getElementById('admin-pass').value = '';
}

function showPanel(){
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('panel-view').style.display = '';
  loadAppointments();
  loadEditorContent().catch(err => {
    setContentMessage(`İçerikler yüklenemedi: ${err.message}`, true);
  });
}

function activateAdminTab(name){
  const showAppointments = name === 'appointments';
  document.getElementById('content-panel').hidden = showAppointments;
  document.getElementById('appointments-panel').hidden = !showAppointments;
  document.querySelectorAll('[data-admin-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.adminTab === name);
  });
  if(showAppointments) loadAppointments();
}

async function loadEditorContent(){
  const defaults = createDefaultSiteContent();
  const saved = await fetchSiteContent();
  const content = {
    ...defaults,
    ...(saved || {}),
    services: Array.isArray(saved?.services) ? saved.services : defaults.services,
    bookingServices: saved?.bookingServices && typeof saved.bookingServices === 'object'
      ? saved.bookingServices
      : defaults.bookingServices
  };
  fillContentForm(content);
}

function fillContentForm(content){
  const fields = {
    'content-shop-name': content.shopName,
    'content-shop-short': content.shopShort,
    'content-location': content.locationName,
    'content-phone': content.phone,
    'content-address': content.address,
    'content-whatsapp': content.whatsappNumber,
    'content-instagram': content.instagramUrl,
    'content-maps': content.mapsLink,
    'content-hero-eyebrow': content.heroEyebrow,
    'content-hero-highlight': content.heroHighlight,
    'content-about-quote': content.aboutQuote,
    'content-hero-lead': content.heroLead,
    'content-about-p1': content.aboutParagraphs[0],
    'content-about-p2': content.aboutParagraphs[1]
  };
  Object.entries(fields).forEach(([id, value]) => {
    document.getElementById(id).value = value || '';
  });
  document.getElementById('hero-image-preview').src = content.heroImage;
  document.getElementById('about-image-preview').src = content.aboutImage;
  renderEditableServices(content.services);
  renderEditableBookingServices(content.bookingServices);
}

function renderEditableServices(services){
  const container = document.getElementById('editable-services');
  container.innerHTML = services.map((service, index) => `
    <div class="admin-service-editor" data-service-index="${index}" data-service-id="${escapeHtml(service.id)}">
      <div class="admin-card-heading">
        <strong>Hizmet ${index + 1}</strong>
        <button type="button" class="link-btn" data-remove-service>Hizmeti Kaldır</button>
      </div>
      <div class="admin-form-grid">
        <div class="field"><label>Hizmet adı</label><input data-service-field="name" value="${escapeHtml(service.name)}" required></div>
        <div class="field"><label>Etiket</label><input data-service-field="tag" value="${escapeHtml(service.tag)}" required></div>
        <div class="field"><label>Fiyat</label><input data-service-field="price" value="${escapeHtml(service.price)}" required></div>
        <div class="field"><label>Fotoğraf bağlantısı</label><input data-service-field="img" type="url" value="${escapeHtml(service.img)}" required></div>
        <div class="field full"><label>Açıklama</label><textarea data-service-field="desc" rows="2" required>${escapeHtml(service.desc)}</textarea></div>
      </div>
    </div>
  `).join('');
}

function addEditableService(){
  const services = readEditableServices();
  services.push({
    id: `service-${Date.now()}`,
    name: '',
    tag: 'Yeni',
    price: '',
    img: '',
    desc: '',
    features: []
  });
  renderEditableServices(services);
}

function readEditableServices(){
  return Array.from(document.querySelectorAll('.admin-service-editor')).map(editor => {
    const read = field => editor.querySelector(`[data-service-field="${field}"]`).value.trim();
    return {
      id: editor.dataset.serviceId || `service-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      name: read('name'),
      tag: read('tag'),
      price: read('price'),
      img: read('img'),
      desc: read('desc'),
      features: []
    };
  });
}

function renderEditableBookingServices(bookingServices){
  const container = document.getElementById('editable-booking-services');
  container.innerHTML = BARBERS.map(barber => {
    const services = bookingServices[barber.id] || [];
    return `
      <div class="admin-booking-service-group" data-booking-barber="${escapeHtml(barber.id)}">
        <div class="admin-card-heading">
          <strong>${escapeHtml(barber.names.tr)} hizmetleri</strong>
          <button class="btn btn-outline btn-sm" type="button" data-add-booking-service="${escapeHtml(barber.id)}">Hizmet Ekle</button>
        </div>
        ${services.map(service => `
          <div class="admin-service-editor" data-booking-service-id="${escapeHtml(service.id)}">
            <div class="admin-card-heading">
              <strong>${escapeHtml(service.names?.tr || service.name || '')}</strong>
              <button type="button" class="link-btn" data-remove-booking-service>Hizmeti Kaldır</button>
            </div>
            <div class="admin-form-grid">
              <div class="field"><label>Hizmet adı</label><input data-booking-field="name" value="${escapeHtml(service.names?.tr || service.name || '')}" required></div>
              <div class="field"><label>Fiyat (₺)</label><input data-booking-field="price" type="number" min="0" step="1" value="${Number(service.price) || 0}" required></div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}

function addEditableBookingService(barberId){
  const group = document.querySelector(`[data-booking-barber="${barberId}"]`);
  if(!group) return;
  const editor = document.createElement('div');
  editor.className = 'admin-service-editor';
  editor.dataset.bookingServiceId = `service-${Date.now()}`;
  editor.innerHTML = `
    <div class="admin-card-heading">
      <strong>Yeni hizmet</strong>
      <button type="button" class="link-btn" data-remove-booking-service>Hizmeti Kaldır</button>
    </div>
    <div class="admin-form-grid">
      <div class="field"><label>Hizmet adı</label><input data-booking-field="name" required></div>
      <div class="field"><label>Fiyat (₺)</label><input data-booking-field="price" type="number" min="0" step="1" value="0" required></div>
    </div>
  `;
  group.append(editor);
}

function readEditableBookingServices(){
  return Object.fromEntries(BARBERS.map(barber => {
    const group = document.querySelector(`[data-booking-barber="${barber.id}"]`);
    const services = Array.from(group.querySelectorAll('.admin-service-editor')).map(editor => {
      const name = editor.querySelector('[data-booking-field="name"]').value.trim();
      const price = Number(editor.querySelector('[data-booking-field="price"]').value);
      if(!name || !Number.isFinite(price) || price < 0) throw new Error(`${barber.names.tr} için hizmet adı ve geçerli fiyat girin.`);
      const original = (BARBER_SERVICES[barber.id] || []).find(service => service.id === editor.dataset.bookingServiceId);
      const names = original?.names ? { ...original.names } : { tr: name, en: name, fr: name };
      names.tr = name;
      return {
        id: editor.dataset.bookingServiceId,
        names,
        price
      };
    });
    return [barber.id, services];
  }));
}

function previewImage(input, previewId){
  const file = input.files && input.files[0];
  if(file && file.type.startsWith('image/')){
    document.getElementById(previewId).src = URL.createObjectURL(file);
  }
}

function setContentMessage(message, isError = false){
  const box = document.getElementById('content-save-msg');
  if(box) box.innerHTML = `<div class="msg ${isError ? 'err' : 'ok'}">${escapeHtml(message)}</div>`;
}

async function handleContentSave(e){
  e.preventDefault();
  const submitButton = document.getElementById('save-content-btn');
  submitButton.disabled = true;
  setContentMessage('Değişiklikler kaydediliyor…');
  try{
    const current = {
      ...createDefaultSiteContent(),
      shopName: document.getElementById('content-shop-name').value.trim(),
      shopShort: document.getElementById('content-shop-short').value.trim(),
      locationName: document.getElementById('content-location').value.trim(),
      phone: document.getElementById('content-phone').value.trim(),
      address: document.getElementById('content-address').value.trim(),
      whatsappNumber: document.getElementById('content-whatsapp').value.replace(/\D/g, ''),
      instagramUrl: document.getElementById('content-instagram').value.trim(),
      mapsLink: document.getElementById('content-maps').value.trim(),
      heroEyebrow: document.getElementById('content-hero-eyebrow').value.trim(),
      heroHighlight: document.getElementById('content-hero-highlight').value.trim(),
      aboutQuote: document.getElementById('content-about-quote').value.trim(),
      heroLead: document.getElementById('content-hero-lead').value.trim(),
      aboutParagraphs: [
        document.getElementById('content-about-p1').value.trim(),
        document.getElementById('content-about-p2').value.trim()
      ],
      services: readEditableServices(),
      bookingServices: readEditableBookingServices()
    };
    if(!current.whatsappNumber) throw new Error('WhatsApp numarası geçerli olmalıdır.');
    for(const service of current.services){
      if(!service.name || !service.price || !service.desc || !service.img) throw new Error('Her hizmet için ad, fiyat, açıklama ve fotoğraf bağlantısı gereklidir.');
      const imageUrl = new URL(service.img, window.location.href);
      if(!['http:', 'https:', 'file:'].includes(imageUrl.protocol)) throw new Error('Hizmet fotoğrafı bağlantısı geçerli değil.');
    }

    const heroFile = document.getElementById('content-hero-image').files[0];
    const aboutFile = document.getElementById('content-about-image').files[0];
    if(heroFile) current.heroImage = await uploadSiteImage(heroFile);
    if(aboutFile) current.aboutImage = await uploadSiteImage(aboutFile);
    await saveSiteContent(current);
    setContentMessage('Kaydedildi. Değişiklikler site ziyaretçilerine yansıtılıyor.');
    await loadEditorContent();
  }catch(err){
    setContentMessage(`Kaydedilemedi: ${err.message}`, true);
  }finally{
    submitButton.disabled = false;
  }
}

function getFilteredAppointments(list){
  const barberFilter = document.getElementById('admin-barber-filter');
  const dateFilter = document.getElementById('admin-date-filter');
  const selectedBarber = barberFilter ? barberFilter.value : 'all';
  const selectedDate = dateFilter ? dateFilter.value : '';

  return list.filter(appt => {
    const barberMatch = selectedBarber === 'all' || (appt.barberId || appt.barber) === selectedBarber;
    const dateMatch = !selectedDate || normalizeDate(appt.date) === selectedDate;
    return barberMatch && dateMatch;
  });
}

function renderAdminSummary(list){
  const summaryEl = document.getElementById('admin-summary');
  if(!summaryEl) return;

  const total = list.length;
  const today = new Date().toISOString().slice(0,10);
  const todayCount = list.filter(appt => normalizeDate(appt.date) === today).length;

  summaryEl.innerHTML = `
    <div class="summary-card">
      <span>Toplam</span>
      <strong>${total}</strong>
    </div>
    <div class="summary-card">
      <span>Bugün</span>
      <strong>${todayCount}</strong>
    </div>
  `;
}

async function loadAppointments(){
  const listBox = document.getElementById('admin-list');
  listBox.innerHTML = '<div class="loading">Randevular yükleniyor...</div>';

  const token = getAdminSession()?.access_token;
  if(!token){ handleLogout(); return; }

  let list = await fetchAllAppointments();
  list.sort((a,b) => (normalizeDate(a.date) + normalizeTime(a.time)).localeCompare(normalizeDate(b.date) + normalizeTime(b.time)));

  // Özet kartlarını güncelle
  renderAdminSummary(list);

  const filteredList = getFilteredAppointments(list);

  if(filteredList.length === 0){
    listBox.innerHTML = '<div class="empty-state">Henüz randevu bulunamadı.</div>';
    return;
  }

  let html = '';
  let lastDate = null;

  for(const appt of filteredList){
    const normalizedDate = normalizeDate(appt.date);
    const dateParts = normalizedDate.split('-').map(Number);
    const appointmentLabel = `${dateParts[2]} ${MONTHS[dateParts[1] - 1]} ${dateParts[0]}`;
    const serviceName = appt.serviceName || 'Hizmet';
    let whatsappPhone = String(appt.phone || '').replace(/\D/g, '');
    if(whatsappPhone.startsWith('0')) whatsappPhone = '90' + whatsappPhone.slice(1);

    if(normalizedDate !== lastDate){
      html += `<div class="day-divider">${appointmentLabel.toUpperCase()}</div>`;
      lastDate = normalizedDate;
    }

    html += `
      <div class="appt-item">
        <div class="appt-date">${appointmentLabel}<br>${normalizeTime(appt.time)}</div>
        <div class="appt-details">
          <div class="name">${escapeHtml(appt.name)} · ${escapeHtml(appt.phone)}</div>
          <div class="meta">${escapeHtml(serviceName)} · ${escapeHtml(appt.barberName || 'Berber')}</div>
        </div>
        <a class="whatsapp-btn" href="https://wa.me/${escapeHtml(whatsappPhone)}" target="_blank" rel="noopener">WhatsApp</a>
        <button class="del-btn" data-id="${escapeHtml(appt.id)}">Sil</button>
      </div>
    `;
  }
  listBox.innerHTML = html;

  listBox.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteAppointment(btn.dataset.id));
  });
}

async function deleteAppointment(id){
  if(!confirm('Bu randevuyu silmek istediğinize emin misiniz?')) return;
  try{
    await supabaseRequest(`appointments?id=eq.${id}`, { method: 'DELETE' });
    await loadAppointments();
  }catch(err){
    alert('Randevu silinirken hata oluştu: ' + err.message);
  }
}