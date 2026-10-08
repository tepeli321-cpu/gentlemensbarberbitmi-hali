// ============================================================
// utils.js — Yardımcı Fonksiyonlar ve Supabase İletişimi
// ============================================================

function daysInMonth(month, year){
  return new Date(year, month, 0).getDate();
}

function normalizeDate(date){
  if(!date) return '';
  const value = String(date).trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if(!isoMatch) return value.slice(0,10);

  const utcDate = new Date(Date.UTC(
    Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]),
    Number(isoMatch[4]), Number(isoMatch[5])
  ) + 3 * 60 * 60 * 1000);
  return utcDate.toISOString().slice(0,10);
}

function normalizeTime(time){
  if(!time) return '';
  let value = String(time).trim();
  if(/^\d{1,2}:\d{2}$/.test(value)){
    const [hour, minute] = value.split(':').map(Number);
    return String(hour).padStart(2,'0') + ':' + String(minute).padStart(2,'0');
  }
  if(value.includes(' - ')) value = value.split(' - ')[0].trim();
  if(/^\d{1,2}:\d{2}:\d{2}$/.test(value)) value = value.slice(0,5);
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if(!match) return value;
  return String(parseInt(match[1],10)).padStart(2,'0') + ':' + match[2];
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

const LOCAL_APPOINTMENTS_KEY = 'gentlemens_barber_appointments';

function readLocalAppointments(){
  try{
    const value = localStorage.getItem(LOCAL_APPOINTMENTS_KEY);
    return value ? JSON.parse(value) : [];
  }catch(err){
    return [];
  }
}

function writeLocalAppointments(list){
  try{
    localStorage.setItem(LOCAL_APPOINTMENTS_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('gentlemens-barber-appointments-updated'));
    return true;
  }catch(err){
    return false;
  }
}

function mergeAppointments(...lists){
  const map = new Map();
  lists.filter(Array.isArray).flat().forEach(item => {
    if(!item) return;
    const key = item.id || `${item.date || ''}|${item.time || ''}|${item.phone || ''}`;
    if(!map.has(key)) map.set(key, item);
  });
  return Array.from(map.values());
}

function isSupabaseConfigured(){
  return Boolean(
    typeof SUPABASE_URL === 'string' && SUPABASE_URL.trim() &&
    typeof SUPABASE_ANON_KEY === 'string' && SUPABASE_ANON_KEY.trim()
  );
}

async function supabaseAuthRequest(path, options = {}){
  const cleanUrl = SUPABASE_URL.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  const response = await fetch(`${cleanUrl}/auth/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if(!response.ok){
    let detail = '';
    try{ detail = await response.text(); }catch(err){}
    throw new Error(detail || 'Supabase kimlik doğrulama hatası.');
  }
  return response;
}

function getAdminSession(){
  try{
    return JSON.parse(sessionStorage.getItem('adminAuthSession') || 'null');
  }catch(err){
    return null;
  }
}

async function cmsRequest(path, options = {}){
  const cleanUrl = SUPABASE_URL.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  const accessToken = getAdminSession()?.access_token;
  const response = await fetch(`${cleanUrl}/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if(!response.ok){
    let detail = '';
    try{ detail = await response.text(); }catch(err){}
    throw new Error(detail || 'Supabase içerik işlemi başarısız oldu.');
  }
  return response;
}

async function fetchSiteContent(){
  const response = await cmsRequest('rest/v1/site_content?id=eq.main&select=content');
  const rows = await response.json();
  return rows.length && rows[0].content && typeof rows[0].content === 'object'
    ? rows[0].content
    : null;
}

async function saveSiteContent(content){
  await cmsRequest('rest/v1/site_content?on_conflict=id', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: 'main', content, updated_at: new Date().toISOString() })
  });
}

async function uploadSiteImage(file){
  if(!file || !file.type.startsWith('image/')) throw new Error('Lütfen bir görsel dosyası seçin.');
  if(file.size > 5 * 1024 * 1024) throw new Error('Görsel en fazla 5 MB olabilir.');

  const accessToken = getAdminSession()?.access_token;
  if(!accessToken) throw new Error('Görsel yüklemek için yeniden giriş yapın.');
  const cleanName = file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '');
  const filePath = `${Date.now()}-${cleanName || 'site-image'}`;
  const cleanUrl = SUPABASE_URL.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  const response = await fetch(`${cleanUrl}/storage/v1/object/site-media/${filePath}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': file.type,
      'x-upsert': 'false'
    },
    body: file
  });
  if(!response.ok){
    let detail = '';
    try{ detail = await response.text(); }catch(err){}
    throw new Error(detail || 'Görsel yüklenemedi.');
  }
  return `${cleanUrl}/storage/v1/object/public/site-media/${filePath}`;
}

// Doğrudan Supabase REST API Çağrısı
async function supabaseRequest(path, options = {}){
  const cleanUrl = SUPABASE_URL.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  const response = await fetch(`${cleanUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if(!response.ok){
    let detail = '';
    try{ detail = await response.text(); }catch(e){}
    const error = new Error(detail || 'Supabase sunucu hatası.');
    error.status = response.status;
    throw error;
  }
  return response;
}

async function fetchSupabaseAppointments(){
  const response = await supabaseRequest('appointments?select=*&order=appointment_date.asc,appointment_time.asc');
  const rows = await response.json();
  return Array.isArray(rows) ? rows.map(row => ({
    id: row.id || '',
    name: row.name || '',
    phone: row.phone || '',
    serviceId: row.service_id || '',
    serviceName: row.service_name || '',
    barberId: row.barber_id || '',
    barberName: row.barber_name || '',
    date: row.appointment_date || '',
    time: row.appointment_time || '',
    createdAt: row.created_at || ''
  })) : [];
}

async function addAppointmentToSupabase(appointment){
  const row = {
    id: appointment.id,
    name: appointment.name,
    phone: appointment.phone,
    service_id: appointment.serviceId || '',
    service_name: appointment.serviceName || '',
    barber_id: appointment.barberId || '',
    barber_name: appointment.barberName || '',
    appointment_date: appointment.date,
    appointment_time: appointment.time,
    created_at: appointment.createdAt || new Date().toISOString()
  };
  await supabaseRequest('appointments', {
    method: 'POST',
    headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify(row)
  });
  return { success: true };
}

async function deleteAppointmentLocally(id){
  const list = readLocalAppointments().filter(item => item.id !== id);
  writeLocalAppointments(list);
  return { success: true };
}

async function fetchAllAppointments(){
  if(!isSupabaseConfigured()) return readLocalAppointments();
  try {
    const remoteAppointments = await fetchSupabaseAppointments();
    writeLocalAppointments(remoteAppointments);
    return remoteAppointments;
  } catch(err) {
    console.warn('Supabase randevuları çekilemedi:', err);
    return readLocalAppointments();
  }
}