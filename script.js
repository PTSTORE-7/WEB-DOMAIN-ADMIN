// ========== FIREBASE CONFIG ==========
const firebaseConfig = {
  apiKey: "AIzaSyDDnTVE9Q8Ab5_4loaF52VKqVatxiRKuoE",
  authDomain: "pt-store-fce51.firebaseapp.com",
  databaseURL: "https://pt-store-fce51-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pt-store-fce51",
  storageBucket: "pt-store-fce51.firebasestorage.app",
  messagingSenderId: "915402985546",
  appId: "1:915402985546:web:c150e4d5e91c432c2456b3"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ========== PIN ==========
const ADMIN_PIN = '2010';

document.getElementById('pinSubmitBtn').addEventListener('click', checkPIN);
document.getElementById('pinInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') checkPIN(); });

function checkPIN() {
  if (document.getElementById('pinInput').value.trim() === ADMIN_PIN) {
    document.getElementById('pinScreen').classList.add('hidden');
    document.getElementById('adminMainScreen').classList.remove('hidden');
    document.getElementById('pinError').classList.remove('show');
    loadAllData();
  } else {
    document.getElementById('pinError').classList.add('show');
    document.getElementById('pinInput').value = '';
    document.getElementById('pinInput').focus();
  }
}

function logoutAdmin() {
  document.getElementById('adminMainScreen').classList.add('hidden');
  document.getElementById('pinScreen').classList.remove('hidden');
  document.getElementById('pinInput').value = '';
  document.getElementById('pinError').classList.remove('show');
  document.getElementById('pinInput').focus();
}

function loadAllData() {
  loadPurchases();
  renderPricingTable();
  renderPromoCodes();
  loadCounterData();
}

// ========== SIDEBAR NAVIGATION ==========
document.querySelectorAll('.sidebar-link').forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    this.classList.add('active');
    const menu = this.dataset.menu;
    document.querySelectorAll('.menu-content').forEach(m => m.classList.remove('active'));
    document.getElementById('menu-' + menu).classList.add('active');
  });
});

// ========== UTILS ==========
function formatDate(dateString) {
  const d = new Date(dateString);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatPrice(price) { return 'Rp ' + (price || 0).toLocaleString('id-ID'); }

function getStatus(purchase) {
  const now = new Date();
  const expiry = new Date(purchase.expiryDate);
  if (purchase.status === 'rejected') return { label: 'Ditolak', class: 'expired' };
  if (purchase.status === 'active') {
    if (now > expiry) return { label: 'Expired', class: 'expired' };
    return { label: 'Aktif', class: 'active' };
  }
  if (purchase.status === 'pending') return { label: 'Menunggu', class: 'pending' };
  return { label: '-', class: 'expired' };
}

function escapeHTML(str) { if (!str) return ''; const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

function showToast(msg) {
  const t = document.createElement('div'); t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#1e293b;color:white;padding:12px 24px;border-radius:30px;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,0.3);animation:fadeSlideIn 0.3s ease;';
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ========== LOAD PURCHASES ==========
function loadPurchases() {
  database.ref('purchases').on('value', (snap) => {
    const data = snap.val();
    const purchases = data ? Object.values(data).reverse() : [];
    renderVerification(purchases);
    renderAllPurchases(purchases);
  });
}

// ========== RENDER VERIFICATION ==========
function renderVerification(purchases) {
  const pending = purchases.filter(p => p.status === 'pending');
  const active = purchases.filter(p => p.status === 'active');
  
  document.getElementById('adminStatTotal').textContent = purchases.length;
  document.getElementById('adminStatPending').textContent = pending.length;
  document.getElementById('adminStatActive').textContent = active.length;

  const pc = document.getElementById('adminPendingContainer');
  if (!pending.length) {
    pc.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle" style="color:#10b981;"></i><p>Tidak ada menunggu verifikasi.</p></div>';
  } else {
    let html = '<div class="admin-list">';
    pending.forEach(p => {
      html += `<div class="admin-card">
        <div class="admin-card-info">
          <span class="admin-domain">${escapeHTML(p.domain)}</span>
          <span class="admin-price">${formatPrice(p.price)}${p.promoCode ? ' 🎫' : ''}</span>
          <span class="admin-date">${formatDate(p.purchaseDate)}</span>
          <span class="admin-user">${escapeHTML(p.userName||'')} | ${escapeHTML(p.userEmail||'')}</span>
        </div>
        <div class="admin-card-actions">
          <button class="btn-verify" onclick="verifyPurchase('${p.id}')"><i class="fas fa-check"></i> Verifikasi</button>
          <button class="btn-reject" onclick="rejectPurchase('${p.id}')"><i class="fas fa-times"></i> Tolak</button>
          <button class="btn-icon-sm delete" onclick="openDeleteModal('${p.id}', '${escapeHTML(p.domain)}')"><i class="fas fa-trash"></i></button>
        </div></div>`;
    });
    html += '</div>'; pc.innerHTML = html;
  }
}

// ========== RENDER ALL PURCHASES ==========
function renderAllPurchases(purchases) {
  const ac = document.getElementById('adminAllContainer');
  if (!purchases.length) {
    ac.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Belum ada pembelian.</p></div>';
  } else {
    let html = '<table class="admin-table"><thead><tr><th>Domain</th><th>Harga</th><th>User</th><th>Tanggal</th><th>Status</th><th>NS</th><th>Aksi</th></tr></thead><tbody>';
    purchases.forEach(p => {
      const s = getStatus(p);
      const nsStatus = p.nameservers?.status || 'not_submitted';
      let nsBadge = '';
      if (nsStatus === 'active') nsBadge = '<span class="status-badge active">NS Aktif</span>';
      else if (nsStatus === 'pending' && p.nameservers?.ns1) nsBadge = '<span class="status-badge warning">NS Pending</span>';
      else nsBadge = '<span class="status-badge expired">Belum NS</span>';
      
      let actions = '';
      if (p.status === 'pending') {
        actions = `<button class="btn-icon-sm verify" onclick="verifyPurchase('${p.id}')"><i class="fas fa-check"></i></button>
          <button class="btn-icon-sm reject" onclick="rejectPurchase('${p.id}')"><i class="fas fa-times"></i></button>
          <button class="btn-icon-sm delete" onclick="openDeleteModal('${p.id}', '${escapeHTML(p.domain)}')"><i class="fas fa-trash"></i></button>`;
      } else if (nsStatus === 'pending' && p.nameservers?.ns1) {
        actions = `<button class="btn-icon-sm reset" onclick="resetPurchase('${p.id}')"><i class="fas fa-undo"></i></button>
          <button class="btn-icon-sm ns" onclick="verifyNameserver('${p.id}')"><i class="fas fa-server"></i></button>
          <button class="btn-icon-sm delete" onclick="openDeleteModal('${p.id}', '${escapeHTML(p.domain)}')"><i class="fas fa-trash"></i></button>`;
      } else {
        actions = `<button class="btn-icon-sm reset" onclick="resetPurchase('${p.id}')"><i class="fas fa-undo"></i></button>
          <button class="btn-icon-sm delete" onclick="openDeleteModal('${p.id}', '${escapeHTML(p.domain)}')"><i class="fas fa-trash"></i></button>`;
      }
      
      html += `<tr>
        <td data-label="Domain"><span class="domain-name">${escapeHTML(p.domain)}</span></td>
        <td data-label="Harga">${formatPrice(p.price)}</td>
        <td data-label="User">${escapeHTML(p.userEmail||'-')}</td>
        <td data-label="Tanggal">${formatDate(p.purchaseDate)}</td>
        <td data-label="Status"><span class="status-badge ${s.class}">${s.label}</span></td>
        <td data-label="NS">${nsBadge}</td>
        <td data-label="Aksi">${actions}</td></tr>`;
    });
    html += '</tbody></table>'; ac.innerHTML = html;
  }
}

// ========== PRICING TABLE MANAGEMENT ==========
function renderPricingTable() {
  database.ref('pricingTable').on('value', (snap) => {
    const data = snap.val();
    const container = document.getElementById('pricingContainer');
    if (!data) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-tags"></i><p>Belum ada pricing. Tambahkan di atas.</p></div>';
      return;
    }
    let html = '<div class="admin-list">';
    Object.keys(data).forEach(key => {
      const item = data[key];
      const features = item.features ? item.features.join(', ') : '-';
      const popularBadge = item.popular ? ' ⭐ Populer' : '';
      html += `<div class="admin-card">
        <div class="admin-card-info">
          <span class="admin-domain">${item.tld}${popularBadge}</span>
          <span class="admin-price">${formatPrice(item.price)}/tahun</span>
          <span style="font-size:0.8rem;color:#64748b;">Fitur: ${features}</span>
        </div>
        <div class="admin-card-actions">
          <button class="btn-icon-sm ns" onclick="editPricing('${key}')"><i class="fas fa-edit"></i></button>
          <button class="btn-icon-sm delete" onclick="deletePricing('${key}')"><i class="fas fa-trash"></i></button>
        </div></div>`;
    });
    html += '</div>'; container.innerHTML = html;
  });
}

function addPricing() {
  const tld = document.getElementById('newTld').value.trim();
  const price = parseInt(document.getElementById('newPrice').value);
  const featuresStr = document.getElementById('newFeatures').value.trim();
  const popular = document.getElementById('newPopular').checked;
  
  if (!tld || !price) { showToast('Isi TLD dan Harga!'); return; }
  
  const features = featuresStr ? featuresStr.split(',').map(f => f.trim()) : ['Free Setup', '100% Private', 'Keamanan super ketat'];
  const id = tld.replace(/\./g, '_');
  
  database.ref('pricingTable/' + id).set({ tld, price, features, popular });
  
  document.getElementById('newTld').value = '';
  document.getElementById('newPrice').value = '';
  document.getElementById('newFeatures').value = '';
  document.getElementById('newPopular').checked = false;
  showToast('✅ Pricing ditambahkan!');
}

async function editPricing(id) {
  const snap = await database.ref('pricingTable/' + id).once('value');
  const data = snap.val();
  if (!data) return;
  
  const newPrice = prompt('Harga baru untuk ' + data.tld + ' (Rp):', data.price);
  if (newPrice && !isNaN(newPrice)) {
    await database.ref('pricingTable/' + id + '/price').set(parseInt(newPrice));
    showToast('✅ Harga diupdate!');
  }
}

async function deletePricing(id) {
  const snap = await database.ref('pricingTable/' + id).once('value');
  const data = snap.val();
  if (!confirm('Hapus ' + data.tld + '?')) return;
  await database.ref('pricingTable/' + id).remove();
  showToast('🗑️ Dihapus!');
}

// ========== PROMO CODES ==========
function renderPromoCodes() {
  database.ref('promoCodes').on('value', (snap) => {
    const data = snap.val();
    const container = document.getElementById('promoContainer');
    if (!data) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-ticket-alt"></i><p>Belum ada kode promo.</p></div>';
      return;
    }
    let html = '<div class="admin-list">';
    Object.keys(data).forEach(code => {
      const promo = data[code];
      const statusBadge = promo.active ? '<span class="status-badge active">Aktif</span>' : '<span class="status-badge expired">Nonaktif</span>';
      const maxUseText = promo.maxUse > 0 ? ` | Dipakai: ${promo.usedCount || 0}/${promo.maxUse}` : ' | Unlimited';
      html += `<div class="admin-card">
        <div class="admin-card-info">
          <span class="admin-domain">🎫 ${code}</span>
          <span class="admin-price">Diskon: Rp ${promo.discount.toLocaleString('id-ID')}${maxUseText}</span>
          <span>${statusBadge}</span>
        </div>
        <div class="admin-card-actions">
          <button class="btn-icon-sm verify" onclick="togglePromo('${code}', ${!promo.active})"><i class="fas fa-power-off"></i></button>
          <button class="btn-icon-sm delete" onclick="deletePromo('${code}')"><i class="fas fa-trash"></i></button>
        </div></div>`;
    });
    html += '</div>'; container.innerHTML = html;
  });
}

function addPromo() {
  const code = document.getElementById('newPromoCode').value.trim().toUpperCase();
  const discount = parseInt(document.getElementById('newPromoDiscount').value);
  const maxUse = parseInt(document.getElementById('newPromoMaxUse').value) || 0;
  
  if (!code || !discount) { showToast('Isi kode dan diskon!'); return; }
  
  database.ref('promoCodes/' + code).set({
    code, discount, maxUse, usedCount: 0, active: true,
    createdAt: firebase.database.ServerValue.TIMESTAMP
  });
  
  document.getElementById('newPromoCode').value = '';
  document.getElementById('newPromoDiscount').value = '';
  document.getElementById('newPromoMaxUse').value = '1';
  showToast('✅ Kode promo ditambahkan!');
}

async function togglePromo(code, active) {
  await database.ref('promoCodes/' + code + '/active').set(active);
  showToast(active ? '✅ Diaktifkan!' : '❌ Dinonaktifkan!');
}

async function deletePromo(code) {
  if (!confirm('Hapus ' + code + '?')) return;
  await database.ref('promoCodes/' + code).remove();
  showToast('🗑️ Dihapus!');
}

// ========== VERIFY / REJECT / RESET ==========
async function verifyPurchase(id) { 
  await database.ref('purchases/' + id + '/status').set('active'); 
  showToast('✅ Diverifikasi!'); 
}

async function rejectPurchase(id) { 
  if (!confirm('Yakin tolak?')) return; 
  await database.ref('purchases/' + id + '/status').set('rejected'); 
  showToast('❌ Ditolak'); 
}

async function resetPurchase(id) { 
  await database.ref('purchases/' + id + '/status').set('pending'); 
  showToast('🔄 Direset'); 
}

async function verifyNameserver(id) { 
  await database.ref('purchases/' + id + '/nameservers/status').set('active'); 
  showToast('✅ NS Diverifikasi!'); 
}

// ========== DELETE ==========
let deleteTargetId = null;

function openDeleteModal(purchaseId, domain) {
  deleteTargetId = purchaseId;
  document.getElementById('deleteDomainName').textContent = domain;
  document.getElementById('deleteModal').classList.remove('hidden');
}

function closeDeleteModal() { 
  document.getElementById('deleteModal').classList.add('hidden'); 
  deleteTargetId = null; 
}

async function confirmDelete() {
  if (!deleteTargetId) return;
  await database.ref('purchases/' + deleteTargetId).remove();
  closeDeleteModal(); 
  showToast('🗑️ Dihapus!');
}

document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
document.getElementById('deleteModal').addEventListener('click', function(e) { 
  if (e.target === this) closeDeleteModal(); 
});

// ================================================================
// ========== COUNTER MANAGEMENT ==================================
// ================================================================

function loadCounterData() {
  // Ambil data pembelian otomatis
  database.ref('purchases').on('value', (snap) => {
    const data = snap.val();
    let autoCount = 0;
    
    if (data) {
      Object.values(data).forEach(item => {
        if (item.status === 'active' || item.status === 'completed' || item.status === 'pending') {
          autoCount++;
        }
      });
    }
    
    // Ambil nilai manual
    database.ref('counterSettings/manualAdd').on('value', (manualSnap) => {
      const manualAdd = manualSnap.val() || 0;
      const totalCount = autoCount + manualAdd;
      
      // Update stat boxes
      const autoEl = document.getElementById('counterAuto');
      const manualEl = document.getElementById('counterManual');
      const totalEl = document.getElementById('counterTotal');
      const inputEl = document.getElementById('manualCounterInput');
      
      if (autoEl) autoEl.textContent = autoCount;
      if (manualEl) {
        manualEl.textContent = (manualAdd >= 0 ? '+' : '') + manualAdd;
        manualEl.style.color = manualAdd >= 0 ? 'var(--text-dark)' : 'var(--danger)';
      }
      if (totalEl) totalEl.textContent = totalCount;
      if (inputEl && document.activeElement !== inputEl) {
        inputEl.value = manualAdd;
      }
    });
  });
  
  // Load counter logs
  database.ref('counterSettings/logs').orderByChild('timestamp').limitToLast(20).on('value', (snap) => {
    const data = snap.val();
    const container = document.getElementById('counterLogContainer');
    
    if (!data) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-clock"></i><p>Belum ada perubahan</p></div>';
      return;
    }
    
    const logs = Object.values(data).reverse();
    let html = '<div style="max-height:400px;overflow-y:auto;">';
    
    logs.forEach(log => {
      const date = new Date(log.timestamp);
      const dateStr = date.toLocaleDateString('id-ID', { 
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit' 
      });
      const icon = log.action === 'set' ? '📝' : log.action === 'reset' ? '🔄' : '⚡';
      const valueColor = log.value >= 0 ? 'var(--success)' : 'var(--danger)';
      const valueStr = (log.value >= 0 ? '+' : '') + log.value;
      
      html += `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--border);font-size:0.85rem;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span>${icon}</span>
            <span style="color:${valueColor};font-weight:600;">${valueStr}</span>
            <span style="color:var(--text-soft);">${log.action === 'set' ? 'di-set' : log.action === 'reset' ? 'di-reset' : 'preset'}</span>
          </div>
          <span style="color:var(--text-soft);font-size:0.75rem;">${dateStr}</span>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
  });
}

function updateManualCounter() {
  const input = document.getElementById('manualCounterInput');
  const value = parseInt(input.value) || 0;
  
  if (isNaN(value)) {
    showToast('❌ Masukkan angka yang valid!');
    return;
  }
  
  if (value > 10000) {
    showToast('⚠️ Maksimal 10.000!');
    return;
  }
  if (value < -10000) {
    showToast('⚠️ Minimal -10.000!');
    return;
  }
  
  database.ref('counterSettings/manualAdd').set(value)
    .then(() => {
      const logRef = database.ref('counterSettings/logs').push();
      logRef.set({
        action: 'set',
        value: value,
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });
      
      const msg = document.getElementById('counterMessage');
      const msgText = document.getElementById('counterMessageText');
      if (msg && msgText) {
        msg.style.display = 'flex';
        msg.style.background = '#f0fdf4';
        msg.style.border = '1px solid #86efac';
        msgText.innerHTML = `<span style="color:#166534;">✅ Counter manual berhasil diupdate ke <strong>${value >= 0 ? '+' + value : value}</strong></span>`;
        const icon = msg.querySelector('i');
        if (icon) icon.style.color = '#10b981';
        
        setTimeout(() => {
          msg.style.display = 'none';
        }, 5000);
      }
      
      showToast(`✅ Counter diupdate! (${value >= 0 ? '+' : ''}${value})`);
    })
    .catch(err => {
      showToast('❌ Gagal menyimpan!');
      console.error(err);
    });
}

function resetManualCounter() {
  if (!confirm('Reset nilai manual ke 0? Riwayat akan tetap tersimpan.')) return;
  
  database.ref('counterSettings/manualAdd').set(0)
    .then(() => {
      document.getElementById('manualCounterInput').value = 0;
      
      const logRef = database.ref('counterSettings/logs').push();
      logRef.set({
        action: 'reset',
        value: 0,
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });
      
      showToast('🔄 Counter direset ke 0');
    });
}

function setManualCounter(value) {
  document.getElementById('manualCounterInput').value = value;
  updateManualCounter();
}