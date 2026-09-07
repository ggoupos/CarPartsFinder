// Βάλε εδώ το ακριβές public URL από το Supabase Storage bucket σου
const REMOTE_CONFIG_URL = 'https://qwfewlmfpdmrtrmdpdhk.supabase.co/storage/v1/object/public/config/extension_sites.json';

let cachedConfigs = null;
let lastFetchTime = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 ώρα

async function getConfigs() {
  if (cachedConfigs && (Date.now() - lastFetchTime < CACHE_TTL)) {
    return cachedConfigs;
  }
  try {
    const res = await fetch(`${REMOTE_CONFIG_URL}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    cachedConfigs = await res.json();
    lastFetchTime = Date.now();
    return cachedConfigs;
  } catch (err) {
    console.warn('Failed to fetch remote configs for extension:', err);
    return cachedConfigs || {};
  }
}

// Η συνάρτηση παραμένει ίδια, χρησιμοποιώντας τις παραμέτρους της δυναμικής ρύθμισης[cite: 6]
function extractItemsFromPage(cfg) {
  const items = [];
  const seen = new Set();
  
  document.querySelectorAll(cfg.cardSelectors).forEach((card) => {
    // 1. Βρίσκουμε τον τίτλο
    const titleEl = card.querySelector(cfg.titleSelectors);
    if (!titleEl) return;
    
    let title = titleEl.getAttribute('data-clk-listing-standard-item-name') || titleEl.textContent.trim();
    const manufacturer = titleEl.getAttribute('data-clk-listing-standard-item-manufacturer');
    if (manufacturer) {
      title = `${manufacturer} - ${title}`;
    }

    // 2. ΕΞΥΠΝΗ ΑΝΑΖΗΤΗΣΗ LINK: Ψάχνουμε 4 διαφορετικά σημεία
    let link = 
      titleEl.getAttribute('href') || // Αν ο τίτλος είναι a tag
      card.getAttribute('href') || // Αν όλη η κάρτα είναι a tag
      (card.querySelector('a.wd-product-img-link') && card.querySelector('a.wd-product-img-link').getAttribute('href')) || // Ειδικό για Hatziligos (link εικόνας)
      (card.querySelector('form.cart') && card.querySelector('form.cart').getAttribute('action')) || // Αν είναι Single Page (από τη φόρμα καλαθιού)
      window.location.href; // Τελευταία λύση: Το URL του παραθύρου

    if (!title || !link || link === '#' || link.startsWith('javascript')) return;
    if (!link.startsWith('http')) link = new URL(link, cfg.baseUrl).toString();
    if (seen.has(link)) return;
    seen.add(link);

    // 3. Βρίσκουμε την τιμή
    let price = null;
    let priceText = null;
    const priceEl = card.querySelector(cfg.priceSelectors);
    if (priceEl) {
      const dataPrice = priceEl.getAttribute('data-clk-listing-item-wholesale-price');
      if (dataPrice) {
        price = parseFloat(dataPrice);
        priceText = price.toFixed(2) + ' €';
      } else {
        const txt = priceEl.textContent.replace(/\s+/g, ' ').trim();
        const m = txt.match(/(\d[\d.,]*)\s*(?:€|EUR)|(?:€|EUR)\s*(\d[\d.,]*)/i);
        if (m) {
          priceText = txt;
          const rawPrice = m[1] || m[2];
          price = parseFloat(rawPrice.replace(/\./g, '').replace(',', '.'));
        }
      }
    }

    // 4. Βρίσκουμε την εικόνα
    let image = null;
    const imgEl = card.querySelector('img');
    if (imgEl) {
      image = imgEl.getAttribute('data-src') || imgEl.getAttribute('src') || null;
      if (image && !image.startsWith('http')) image = new URL(image, cfg.baseUrl).toString();
    }

    const cardText = card.textContent || '';
    const loginWall = /μόνο για πελάτες χονδρικής|wholesale customers only|συνδεθείτε|log ?in to view price/i.test(cardText);

    items.push({ title, price, priceText, link, image, loginWall });
  });
  return items;
}

function waitForTabComplete(tabId, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Timed out waiting for page to load'));
    }, timeoutMs);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function scrapeSite(siteKey, query) {
  const configs = await getConfigs();
  const config = configs[siteKey];
  
  if (!config) return { site: siteKey, error: `Unknown site config: ${siteKey}` };

  // Αντικατάσταση του {q} με το URL encoded query
  const encodedQuery = encodeURIComponent(query);
  const url = config.baseUrl + config.searchPath.replace('{q}', encodedQuery);
  
  let tab;
  try {
    tab = await chrome.tabs.create({ url, active: false });
    await waitForTabComplete(tab.id);
    const waitTime = config.delay || 1000;
    await new Promise((r) => setTimeout(r, waitTime));
    
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractItemsFromPage,
      args: [config],
    });

    const anyLoginWall = (result || []).some((i) => i.loginWall);
    const items = (result || []).map(({ loginWall, ...rest }) => ({ ...rest, site: config.name }));

    return {
      site: config.name,
      query,
      url,
      items,
      warning: anyLoginWall
        ? `Prices may be hidden — you don't look logged in to ${config.name}.`
        : undefined,
    };
  } catch (err) {
    return { site: config.name, query, url, items: [], error: err.message };
  } finally {
    if (tab) chrome.tabs.remove(tab.id).catch(() => {});
  }
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'searchSites') return false;

  const allowedOrigins = ['http://localhost:3000'];
  if (!sender.origin || !allowedOrigins.includes(sender.origin)) {
    sendResponse({ error: 'Origin not allowed' });
    return false;
  }

  // Αρχικά φορτώνουμε τα configs για να ξέρουμε ποια κλειδιά υπάρχουν
  getConfigs().then(configs => {
    const availableKeys = Object.keys(configs);
    const siteKeys = Array.isArray(message.siteKeys) && message.siteKeys.length
      ? message.siteKeys
      : availableKeys;

    Promise.all(siteKeys.map((key) => scrapeSite(key, message.query)))
      .then((results) => sendResponse({ results }))
      .catch((err) => sendResponse({ error: err.message }));
  });

  return true; 
});