let isLicenseValid = false;

/* =========================================
   Greek keyboard → English keyboard mapper
========================================= */

const greekToEnglish = {
  'ς': 'w', 'ε': 'e', 'ρ': 'r', 'τ': 't', 'υ': 'y', 'θ': 'u', 'ι': 'i', 'ο': 'o', 'π': 'p',
  'α': 'a', 'σ': 's', 'δ': 'd', 'φ': 'f', 'γ': 'g', 'η': 'h', 'ξ': 'j', 'κ': 'k', 'λ': 'l',
  'ζ': 'z', 'χ': 'x', 'ψ': 'c', 'ω': 'v', 'β': 'b', 'ν': 'n', 'μ': 'm',
  'Σ': 'W', 'Ε': 'E', 'Ρ': 'R', 'Τ': 'T', 'Υ': 'Y', 'Θ': 'U', 'Ι': 'I', 'Ο': 'O', 'Π': 'P',
  'Α': 'A', 'Σ': 'S', 'Δ': 'D', 'Φ': 'F', 'Γ': 'G', 'Η': 'H', 'Ξ': 'J', 'Κ': 'K', 'Λ': 'L',
  'Ζ': 'Z', 'Χ': 'X', 'Ψ': 'C', 'Ω': 'V', 'Β': 'B', 'Ν': 'N', 'Μ': 'M',
  'ά': 'a', 'έ': 'e', 'ή': 'h', 'ί': 'i', 'ό': 'o', 'ύ': 'y', 'ώ': 'v',
  'Ά': 'A', 'Έ': 'E', 'Ή': 'H', 'Ί': 'I', 'Ό': 'O', 'Ύ': 'Y', 'Ώ': 'V',
  'ϊ': 'i', 'ΐ': 'i', 'ϋ': 'y', 'ΰ': 'y', 'Ϊ': 'I', 'Ϋ': 'Y'
};

function mapGreekToEnglish(val) {
  let res = '';
  for (const c of val) res += greekToEnglish[c] ?? c;
  return res;
}

function enableEnglishKeyboardMapper(input) {
  input.addEventListener('beforeinput', (e) => {
    if (e.inputType !== 'insertText' || !e.data) return;
    const mapped = mapGreekToEnglish(e.data);
    if (mapped === e.data) return;
    e.preventDefault();

    const start = input.selectionStart, end = input.selectionEnd, val = input.value;
    input.value = val.substring(0, start) + mapped + val.substring(end);
    const pos = start + mapped.length;
    input.setSelectionRange(pos, pos);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const makeInput = document.querySelector('input[name="make"]');
const modelInput = document.querySelector('input[name="model"]');
enableEnglishKeyboardMapper(makeInput);
enableEnglishKeyboardMapper(modelInput);


/* =========================================
   B2B Bridge extension (autospark, hatziligos, elkar)
========================================= */

// Paste the ID Chrome showed you at chrome://extensions after loading the
// extension unpacked. It changes if you remove and re-add the extension.
const PARTS_EXTENSION_ID = 'fleenbbdejbkedpgflpibipcdaamicde';
const EXTENSION_SITE_KEYS = ['autospark', 'hatziligos', 'elkar', 'car_gr_exact', 'car_gr_whole', 'intercars'];
function searchViaExtension(query) {
  return new Promise((resolve) => {
    if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
      // Extension not installed, or not Chrome/Edge — fail soft, just skip it.
      resolve({ results: [] });
      return;
    }
    chrome.runtime.sendMessage(
      PARTS_EXTENSION_ID,
      { type: 'searchSites', query, siteKeys: EXTENSION_SITE_KEYS },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn('Extension not reachable:', chrome.runtime.lastError.message);
          resolve({ results: [] });
          return;
        }
        resolve(response || { results: [] });
      }
    );
  });
}


/* =========================================
   Mode switching
========================================= */

const btnModeVehicle = document.getElementById('btnModeVehicle');
const btnModeCode = document.getElementById('btnModeCode');
const modeVehicleFields = document.getElementById('modeVehicleFields');
const modeCodeFields = document.getElementById('modeCodeFields');
const vehicleInputs = modeVehicleFields.querySelectorAll('input');
const codeInputs = modeCodeFields.querySelectorAll('input');

function setVehicleMode() {
  btnModeVehicle.classList.add('active');
  btnModeCode.classList.remove('active');
  modeVehicleFields.style.display = 'flex';
  modeCodeFields.style.display = 'none';
  vehicleInputs.forEach(i => i.disabled = false);
  codeInputs.forEach(i => { i.disabled = true; i.value = ''; });
  setTimeout(() => makeInput?.focus(), 50);
}

function setCodeMode() {
  btnModeCode.classList.add('active');
  btnModeVehicle.classList.remove('active');
  modeCodeFields.style.display = 'flex';
  modeVehicleFields.style.display = 'none';
  codeInputs.forEach(i => i.disabled = false);
  vehicleInputs.forEach(i => { i.disabled = true; i.value = ''; });
  setTimeout(() => codeInputs[0]?.focus(), 50);
}

btnModeVehicle.addEventListener('click', setVehicleMode);
btnModeCode.addEventListener('click', setCodeMode);


/* =========================================
   Search elements & Actions
========================================= */

const form = document.getElementById('searchForm');
const statusEl = document.getElementById('status');
const container = document.getElementById('resultsContainer');
const loader = document.getElementById('loader');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');

clearBtn.addEventListener('click', () => {
  form.reset();
  container.innerHTML = '';
  statusEl.textContent = '';
  statusEl.classList.remove('error');
  loader.classList.remove('visible');
  submitBtn.disabled = false;
  submitBtn.textContent = '🔍 Αναζήτηση';
  setVehicleMode();
});

function setSearchingState(isSearching) {
  submitBtn.disabled = isSearching;
  if (isSearching) {
    submitBtn.innerHTML = `<span class="search-btn-loader"></span> Αναζήτηση ανταλλακτικών...`;
    loader.classList.add('visible');
  } else {
    submitBtn.innerHTML = `🔍 Αναζήτηση`;
    loader.classList.remove('visible');
  }
}


/* =========================================
   Results generation helpers
========================================= */

function createResultsHeader({ mode, make, model, year, part, productCode, total }) {
  const header = document.createElement('div');
  header.className = 'results-header';
  
  let desc = mode === 'vehicle' 
    ? `<span class="results-label">Αποτελέσματα για</span> <strong>${escapeHTML([make, model, year].filter(Boolean).join(' '))}</strong>${part ? `<span class="results-part"> • ${escapeHTML(part)}</span>` : ''}`
    : `<span class="results-label">Αποτελέσματα για</span> <strong>OEM ${escapeHTML(productCode)}</strong>`;

  header.innerHTML = `
    <div class="results-title">${desc}</div>
    <div class="results-count"><span class="count-number">${total}</span> <span class="count-label">${total === 1 ? 'ανταλλακτικό' : 'ανταλλακτικά'}</span></div>
  `;
  return header;
}

function createProductRow(item, showSite = false) {
  const row = document.createElement('tr');
let priceStr = item.priceText || '-';
if (item.price === 0) {
  priceStr = 'Μη Διαθέσιμο';
} else if (item.price != null) {
  priceStr = Number(item.price).toFixed(2) + ' €';
}
  const imageHTML = item.image 
    ? `<img src="${escapeHTML(item.image)}" alt="" class="product-image" loading="lazy">`
    : `<div class="no-image">No IMG</div>`;
  const siteHTML = showSite ? `<td><span class="source-badge">${escapeHTML(item.site || '-')}</span></td>` : '';

  row.innerHTML = `
    <td style="text-align: center;">${imageHTML}</td>
    <td><a href="${escapeHTML(item.link)}" target="_blank" rel="noopener noreferrer" class="product-link">${escapeHTML(item.title || 'Προϊόν')}</a></td>
    ${siteHTML}
    <td class="price">${escapeHTML(priceStr)}</td>
  `;
  return row;
}

function createProductsTable(items, showSite = false) {
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrapper';
  const table = document.createElement('table');
  
  table.innerHTML = `
    <thead>
      <tr>
        <th style="width: 95px; text-align: center;">Εικόνα</th>
        <th>Προϊόν</th>
        ${showSite ? '<th style="width: 150px;">Από</th>' : ''}
        <th style="width: 130px;">Τιμή</th>
      </tr>
    </thead>
  `;
  
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);

  items.forEach((item, index) => {
    const row = createProductRow(item, showSite);
    row.classList.add('result-row-enter');
    row.style.animationDelay = `${Math.min(index * 35, 500)}ms`;
    tbody.appendChild(row);
  });

  wrapper.appendChild(table);
  return wrapper;
}

function createSiteTab(siteName, items, isActive) {
  const tabBtn = document.createElement('button');
  tabBtn.type = 'button';
  tabBtn.className = `tab ${isActive ? 'active' : ''}`;
  tabBtn.innerHTML = `${escapeHTML(siteName)} <span class="tab-count">${items.length}</span>`;

  const tabContent = document.createElement('div');
  tabContent.className = `tab-content ${isActive ? 'active' : ''}`;
  tabContent.appendChild(createProductsTable(items));

  return { tabBtn, tabContent };
}

function createAllTab(allItems, isActive) {
  const tabBtn = document.createElement('button');
  tabBtn.type = 'button';
  tabBtn.className = `tab all-results-tab ${isActive ? 'active' : ''}`;
  tabBtn.innerHTML = `Όλα <span class="tab-count">${allItems.length}</span>`;

  const tabContent = document.createElement('div');
  tabContent.className = `tab-content ${isActive ? 'active' : ''}`;
  tabContent.appendChild(createProductsTable(allItems, true));

  return { tabBtn, tabContent };
}

function createCarGrTab(manualLinks, isActive) {
  const tabBtn = document.createElement('button');
  tabBtn.type = 'button';
  tabBtn.className = `tab car-gr-tab ${isActive ? 'active' : ''}`;
  tabBtn.innerHTML = `🔗 Car.gr (Εφεδρικό) <span class="tab-count">${manualLinks.length}</span>`;
  const tabContent = document.createElement('div');
  tabContent.className = `tab-content ${isActive ? 'active' : ''}`;
  
  const carContainer = document.createElement('div');
  carContainer.className = 'car-gr-container';

  manualLinks.forEach((m, index) => {
    const card = document.createElement('div');
    card.className = 'car-gr-card result-row-enter';
    card.style.animationDelay = `${Math.min(index * 50, 400)}ms`;
    card.innerHTML = `
      <div class="car-gr-info"><strong>${escapeHTML(m.site)}</strong><span>${escapeHTML(m.reason)}</span></div>
      <a href="${escapeHTML(m.url)}" target="_blank" rel="noopener noreferrer" class="car-gr-btn">🔗 Άνοιγμα στο car.gr</a>
    `;
    carContainer.appendChild(card);
  });

  tabContent.appendChild(carContainer);
  return { tabBtn, tabContent };
}

function activateTab(tabsDiv, contentDiv, selectedBtn, selectedContent) {
  tabsDiv.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  contentDiv.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  selectedBtn.classList.add('active');
  selectedContent.classList.add('active');
}


/* =========================================
   Main Search Event Handler
========================================= */

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isLicenseValid) {
    const expModal = document.getElementById('expirationModal');
    if (expModal) {
      expModal.classList.add('visible');
    }
    return; // Σταματάει εδώ, δεν φεύγει ποτέ request!
  }

  const formData = new FormData(form);
  const mode = !codeInputs[0]?.disabled ? 'code' : 'vehicle';

  const rawQuery = formData.get('product_code') || formData.get('part');

  if (rawQuery === '!!test!!') {
    runHealthCheck();
    return; // Σταματάμε την κανονική ροή
  }

  if (mode === 'vehicle' && !formData.get('part')) {
    statusEl.textContent = 'Παρακαλώ συμπληρώστε το ανταλλακτικό.';
    statusEl.classList.add('error');
    return;
  }
  if (mode === 'code' && !formData.get('product_code')) {
    statusEl.textContent = 'Παρακαλώ συμπληρώστε τον Κωδικό OEM.';
    statusEl.classList.add('error');
    return;
  }

  statusEl.classList.remove('error');
  statusEl.textContent = '';
  container.innerHTML = '';
  setSearchingState(true);

  try {
    const query = formData.get('product_code')
      ? formData.get('product_code')
      : [formData.get('make'), formData.get('model'), formData.get('part')].filter(Boolean).join(' ');

    const [res, extData] = await Promise.all([
      fetch('/api/search?' + new URLSearchParams(formData).toString()),
      searchViaExtension(query),
    ]);
    const data = await res.json();

    // 2. Δυναμικό μπλοκάρισμα (Αν έληξε / ακυρώθηκε ΟΣΟ το app ήταν ανοιχτό)
    if (res.status === 403) {
      isLicenseValid = false; // Αλλάζουμε τη μεταβλητή για να μην ξαναστείλει request
      setSearchingState(false);
      submitBtn.disabled = true;
      document.getElementById('clearBtn').disabled = true;

      const expModal = document.getElementById('expirationModal');
      const expMsg = document.getElementById('expirationMessage');
      if (expModal && expMsg) {
        expMsg.textContent = data.error || 'Η συνδρομή σας έληξε ή ακυρώθηκε.';
        expModal.classList.add('visible');
      }
      return; // Σταματάμε εδώ, δεν δείχνουμε αποτελέσματα
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    if (data.error) {
      statusEl.textContent = 'Σφάλμα: ' + data.error;
      statusEl.classList.add('error');
      return;
    }

    if (data.error) {
      statusEl.textContent = 'Σφάλμα: ' + data.error;
      statusEl.classList.add('error');
      return;
    }

    // Merge the B2B sites scraped by the extension in with the server's results.
    const extItems = (extData.results || []).flatMap((r) => r.items || []);
    const resultsArray = [...(data.results || []), ...extItems]
  .sort((a, b) => {
    const priceA = (!a.price || a.price === 0) ? Infinity : a.price;
    const priceB = (!b.price || b.price === 0) ? Infinity : b.price;
    return priceA - priceB;
  });
    const groupedResults = {};
    resultsArray.forEach(item => {
      if (!groupedResults[item.site]) groupedResults[item.site] = [];
      groupedResults[item.site].push(item);
    });

    const manualLinks = data.manualLinks || [];
    const totalResults = resultsArray.length + manualLinks.length;

    const resultsWrapper = document.createElement('div');
    resultsWrapper.className = 'results-wrapper';

    resultsWrapper.appendChild(createResultsHeader({
      mode,
      make: formData.get('make'),
      model: formData.get('model'),
      year: formData.get('year'),
      part: formData.get('part'),
      productCode: formData.get('product_code'),
      total: totalResults
    }));

    statusEl.innerHTML = `Βρέθηκαν <strong>${totalResults}</strong> ${totalResults === 1 ? 'αποτέλεσμα' : 'αποτελέσματα'}`;

    if (totalResults === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `<div style="font-size: 28px; margin-bottom: 10px;">🔎</div><strong>Δεν βρέθηκαν αποτελέσματα</strong><div style="margin-top: 5px;">Δοκιμάστε διαφορετική αναζήτηση ή ελέγξτε τα στοιχεία του οχήματος.</div>`;
      resultsWrapper.appendChild(empty);
      container.appendChild(resultsWrapper);
      return;
    }

    const tabsDiv = document.createElement('div');
    tabsDiv.className = 'tabs';
    const contentDiv = document.createElement('div');
    const siteEntries = Object.entries(groupedResults);
    let firstTab = true;

    if (siteEntries.length > 1) {
      const allTab = createAllTab(resultsArray, true);
      allTab.tabBtn.addEventListener('click', () => activateTab(tabsDiv, contentDiv, allTab.tabBtn, allTab.tabContent));
      tabsDiv.appendChild(allTab.tabBtn);
      contentDiv.appendChild(allTab.tabContent);
      firstTab = false;
    }

    siteEntries.forEach(([siteName, items]) => {
      const tab = createSiteTab(siteName, items, firstTab);
      tab.tabBtn.addEventListener('click', () => activateTab(tabsDiv, contentDiv, tab.tabBtn, tab.tabContent));
      tabsDiv.appendChild(tab.tabBtn);
      contentDiv.appendChild(tab.tabContent);
      firstTab = false;
    });

    if (manualLinks.length > 0) {
      const carTab = createCarGrTab(manualLinks, firstTab);
      carTab.tabBtn.addEventListener('click', () => activateTab(tabsDiv, contentDiv, carTab.tabBtn, carTab.tabContent));
      tabsDiv.appendChild(carTab.tabBtn);
      contentDiv.appendChild(carTab.tabContent);
    }

    resultsWrapper.appendChild(tabsDiv);
    resultsWrapper.appendChild(contentDiv);
    container.appendChild(resultsWrapper);

    setTimeout(() => {
      resultsWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

  } catch (err) {
    statusEl.textContent = 'Σφάλμα σύνδεσης: ' + err.message;
    statusEl.classList.add('error');
  } finally {
    setSearchingState(false);
  }
});


/* =========================================
   Utilities & Sticky Tabs
========================================= */

function escapeHTML(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function enableStickyTabs(tabs) {
  if (!tabs) return;
  const observer = new IntersectionObserver(([entry]) => {
    tabs.classList.toggle('is-sticky', !entry.isIntersecting);
  }, { threshold: [1], rootMargin: '-1px 0px 0px 0px' });

  const marker = document.createElement('div');
  marker.className = 'sticky-tabs-marker';
  marker.style.cssText = 'height:1px;width:100%;pointer-events:none;';
  tabs.parentNode.insertBefore(marker, tabs);
  observer.observe(marker);
}

/* =========================================
   Άμεσος έλεγχος άδειας με το άνοιγμα
========================================= */
document.addEventListener('DOMContentLoaded', async () => {
  setSearchingState(true);
  const originalBtnText = submitBtn.innerHTML;
  submitBtn.innerHTML = `<span class="search-btn-loader"></span> Ταυτοποίηση...`;

  try {
    const res = await fetch('/api/check-license');
    const data = await res.json();

    // ΣΕΝΑΡΙΟ 1: Νέος χρήστης (Απαιτείται εγγραφή)
    if (data.requires_registration) {
      const modal = document.getElementById('registrationModal');
      const step1 = document.getElementById('step1');
      const step2 = document.getElementById('step2');
      
      const inputName = document.getElementById('garageNameInput');
      const inputPhone = document.getElementById('garagePhoneInput');
      
      const verifyBtn = document.getElementById('verifyBtn');
      const backBtn = document.getElementById('backBtn');
      const registerBtn = document.getElementById('registerBtn');
      const errorDiv = document.getElementById('modalError');
      
      modal.classList.add('visible');
      inputName.focus();

      verifyBtn.addEventListener('click', () => {
        const name = inputName.value.trim();
        const phone = inputPhone.value.trim();
        
        if (!name || !phone) {
          errorDiv.textContent = 'Παρακαλώ συμπληρώστε και τα δύο πεδία.';
          return;
        }
        if (phone.length < 10) {
          errorDiv.textContent = 'Το τηλέφωνο φαίνεται να είναι ελλιπές.';
          return;
        }
        
        errorDiv.textContent = '';
        document.getElementById('confirmName').textContent = name;
        document.getElementById('confirmPhone').textContent = phone;
        
        step1.style.display = 'none';
        step2.style.display = 'block';
      });

      backBtn.addEventListener('click', () => {
        step2.style.display = 'none';
        step1.style.display = 'block';
        inputPhone.focus();
      });

      registerBtn.addEventListener('click', async () => {
        registerBtn.disabled = true;
        backBtn.disabled = true;
        registerBtn.innerHTML = '<span class="search-btn-loader" style="width:16px;height:16px;border-width:2px;margin-right:8px;vertical-align:middle;"></span>...';
        
        try {
          const regRes = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              garage_name: inputName.value.trim(),
              phone: inputPhone.value.trim() 
            })
          });

          if (!regRes.ok) {
            const regData = await regRes.json();
            errorDiv.textContent = regData.error || 'Αποτυχία εγγραφής.';
            registerBtn.disabled = false;
            backBtn.disabled = false;
            registerBtn.textContent = 'Ενεργοποίηση';
            return;
          }
          
          location.reload();
          
        } catch (err) {
          errorDiv.textContent = 'Σφάλμα επικοινωνίας με τον διακομιστή.';
          registerBtn.disabled = false;
          backBtn.disabled = false;
          registerBtn.textContent = 'Ενεργοποίηση';
        }
      });
      return; 
    } 

    // ΣΕΝΑΡΙΟ 2: Ληγμένη Συνδρομή
    if (data.valid === false) {
      setSearchingState(false);
      submitBtn.innerHTML = originalBtnText;
      submitBtn.disabled = true;
      const clearBtn = document.getElementById('clearBtn');
      if (clearBtn) clearBtn.disabled = true;

      const expModal = document.getElementById('expirationModal');
      const expMsg = document.getElementById('expirationMessage');
      if (expMsg && expModal) {
        expMsg.textContent = data.error || 'Η συνδρομή ή η δοκιμαστική περίοδος έχει λήξει.';
        expModal.classList.add('visible');
      }

      renderHeaderBar({
        garageName: data.garage_name || 'Συνεργείο',
        isExpired: true
      });
      return;
    }

    // ΣΕΝΑΡΙΟ 3: Έγκυρη Άδεια
    isLicenseValid = true;
    setSearchingState(false);
    submitBtn.innerHTML = originalBtnText;

    let diffDays = 0;
    if (data.expires_at) {
      const expiresDate = new Date(data.expires_at);
      diffDays = Math.ceil((expiresDate - new Date()) / (1000 * 60 * 60 * 24));
    }

    renderHeaderBar({
      garageName: data.garage_name || 'Συνεργείο',
      plan: data.plan || 'trial',
      diffDays: diffDays,
      isExpired: false
    });

  } catch (err) {
    console.error('Αποτυχία ελέγχου άδειας:', err);
    alert('Σφάλμα σύνδεσης με τον διακομιστή αδειών.');
  }
});

// Συνάρτηση για την ασφαλή τοποθέτηση του badge κατάστασης συνδρομής στην κορυφή
// (Τα στοιχεία επικοινωνίας/ανανέωσης εμφανίζονται ήδη στο footer — δεν χρειάζεται δεύτερο badge)
function renderHeaderBar({ garageName, plan, diffDays, isExpired }) {
  const bar = document.getElementById('appHeaderBar');
  if (!bar) return;

  let statusBadgeHtml = '';

  if (isExpired) {
    statusBadgeHtml = `
      <div class="header-badge badge-status badge-expired">
        <div class="badge-name">🔒 ${escapeHTML(garageName)}</div>
        <span class="status-text expiring">ΛΗΞΗ ΣΥΝΔΡΟΜΗΣ</span>
      </div>
    `;
  } else {
    const isTrial = plan === 'trial';
    const icon = isTrial ? '⏱️' : '👑';
    const planTitle = isTrial ? 'Δοκιμαστική Χρήση' : 'Premium Συνδρομή';

    let daysText = '';
    if (diffDays > 1) {
      daysText = `Απομένουν ${diffDays} ημέρες`;
    } else if (diffDays === 1) {
      daysText = 'Απομένει 1 ημέρα';
    } else {
      daysText = 'Λήγει σήμερα!';
    }

    const isExpiringSoon = isTrial ? diffDays <= 3 : diffDays <= 7;
    const expiringClass = isExpiringSoon ? 'expiring' : '';

    statusBadgeHtml = `
      <div class="header-badge badge-status ${isTrial ? 'badge-trial' : 'badge-premium'}">
        <div class="badge-name">${icon} ${escapeHTML(garageName)}</div>
        <span class="status-text ${expiringClass}">${planTitle} • ${daysText}</span>
      </div>
    `;
  }

  bar.innerHTML = statusBadgeHtml;
}

async function runHealthCheck() {
  container.innerHTML = `
    <div style="padding: 20px; background: var(--surface); border-radius: 12px; box-shadow: var(--shadow);">
      <h3 style="margin-bottom: 15px; color: var(--text-main);">🔧 Διαγνωστικός Έλεγχος Scrapers...</h3>
      <div id="health-results"><span class="search-btn-loader" style="border-color: var(--primary) transparent transparent transparent; width: 24px; height: 24px;"></span> Ελέγχονται όλα τα sites...</div>
    </div>
  `;
  
  const healthDiv = document.getElementById('health-results');
  const TEST_QUERY = 'vw'; // Ο όρος που ξέρουμε ότι φέρνει πολλά αποτελέσματα
  
  try {
    const params = new URLSearchParams({ product_code: TEST_QUERY });
    
    let backendResults = [];
    let extResults = [];

    // 1. Έλεγχος Backend
    try {
      const res = await fetch('/api/search?' + params.toString());
      const backendData = await res.json();
      
      // Η ΛΥΣΗ: Διαβάζουμε ΜΟΝΟ το perSite (τα 5 sites), ΟΧΙ τα μεμονωμένα results!
      if (backendData.perSite && Array.isArray(backendData.perSite)) {
        backendResults = backendData.perSite;
      } else {
        backendResults = [{ site: 'Backend Scrapers', error: 'Λάθος δομή δεδομένων' }];
      }
    } catch (err) {
      console.warn('Backend health check failed:', err);
    }

    // 2. Έλεγχος Extension
    try {
      const extData = await searchViaExtension(TEST_QUERY);
      extResults = Array.isArray(extData) ? extData : (extData?.results || []);
    } catch (err) {
      console.warn('Extension health check failed:', err);
      extResults = [{ site: 'B2B Extension', error: 'Αποτυχία επικοινωνίας' }];
    }
    
    const allResults = [...backendResults, ...extResults];

    if (allResults.length === 0) {
      healthDiv.innerHTML = `<p style="color: #dc2626; font-weight: 500;">⚠️ Ο έλεγχος ολοκληρώθηκε αλλά δεν βρέθηκε καμία απάντηση.</p>`;
      return;
    }
    
    let html = `
      <table style="width:100%; text-align:left; border-collapse: collapse; margin-top: 15px;">
        <tr style="border-bottom: 2px solid #cbd5e1;">
          <th style="padding: 10px;">Site</th>
          <th style="padding: 10px;">Αποτελέσματα</th>
          <th style="padding: 10px;">Κατάσταση</th>
        </tr>
    `;

    allResults.forEach(siteResult => {
      // Παίρνουμε τον αριθμό. Στο backend έρχεται ως siteResult.count.
      // Στο extension έρχεται ως length του πίνακα items.
      const count = siteResult.count !== undefined 
        ? siteResult.count 
        : (siteResult.items ? siteResult.items.length : 0);
        
      const isBroken = siteResult.error || count === 0;
      
      const statusIcon = isBroken ? '❌' : '✅';
      const statusText = isBroken ? 'ΠΙΘΑΝΟ ΠΡΟΒΛΗΜΑ (0 Αποτελ.)' : 'ΛΕΙΤΟΥΡΓΕΙ ΚΑΝΟΝΙΚΑ';
      const color = isBroken ? '#dc2626' : '#16a34a';
      const bgColor = isBroken ? '#fef2f2' : 'transparent';
      const errorMsg = siteResult.error ? `<br><span style="font-size:0.8rem; color:#991b1b;">${escapeHTML(siteResult.error)}</span>` : '';
      
      html += `
        <tr style="border-bottom: 1px solid #e2e8f0; background: ${bgColor};">
          <td style="padding: 12px; font-weight: 600;">${escapeHTML(siteResult.site || 'Άγνωστο Site')}</td>
          <td style="padding: 12px;">${count}</td>
          <td style="padding: 12px; color: ${color}; font-weight: bold;">
            ${statusIcon} ${statusText} ${errorMsg}
          </td>
        </tr>`;
    });
    
    html += '</table>';
    healthDiv.innerHTML = html;
    
  } catch (err) {
    healthDiv.innerHTML = `<span style="color: #dc2626; font-weight:bold;">Σφάλμα διαγνωστικού: ${escapeHTML(err.message)}</span>`;
  }
}