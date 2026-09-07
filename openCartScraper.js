const axios = require('axios');
const cheerio = require('cheerio');

// Το Public URL που αντέγραψες από το Supabase Storage
const REMOTE_CONFIG_URL = 'https://qwfewlmfpdmrtrmdpdhk.supabase.co/storage/v1/object/public/config/sites.json';

let cachedConfigs = null;
let lastFetchTime = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 ώρα

async function getSiteConfigs() {
  if (cachedConfigs && (Date.now() - lastFetchTime < CACHE_TTL)) {
    return cachedConfigs;
  }
  try {
    // Κατεβάζουμε το JSON με επιπλέον παράμετρο για να σπάμε τυχόν browser cache
    const { data } = await axios.get(`${REMOTE_CONFIG_URL}?t=${Date.now()}`);
    cachedConfigs = data;
    lastFetchTime = Date.now();
    return cachedConfigs;
  } catch (err) {
    console.error('Αποτυχία λήψης ρυθμίσεων:', err.message);
    return cachedConfigs || {};
  }
}

function parsePrice(text) {
  if (!text) return null;
  const match = text.replace(/\s+/g, ' ').match(/(\d[\d.,]*)\s*€|€\s*(\d[\d.,]*)/);
  if (!match) return null;
  const raw = match[1] || match[2];
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const value = parseFloat(normalized);
  return Number.isNaN(value) ? null : value;
}

async function scrapeSite(siteKey, query, configs) {
  const config = configs[siteKey];
  if (!config) throw new Error(`Unknown site: ${siteKey}`);

  let encodedQuery = encodeURIComponent(query.trim());
  if (config.usePlusForSpaces) {
    encodedQuery = encodedQuery.replace(/%20/g, '+');
  }
  
  const url = config.baseUrl + config.searchPath.replace('{q}', encodedQuery);

  try {
    const { data: html } = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept-Language': 'el-GR,el;q=0.9',
      },
    });

    const $ = cheerio.load(html);
    const items = [];
    const seenLinks = new Set();

    // ΑΛΛΑΓΗ ΕΔΩ: Διαβάζουμε απευθείας τα κλειδιά όπως τα έγραψες στο sites.json
    $(config.cardSelectors).each((_, el) => {
      const $card = $(el);
      
      const titleEl = $card.find(config.titleSelectors).first();
      let title = titleEl.text().trim();
      let link = titleEl.attr('href');

      if (!title || !link || link === '#' || link.startsWith('javascript')) return;

      if (!link.startsWith('http')) {
        link = link.startsWith('/') ? config.baseUrl + link : `${config.baseUrl}/${link}`;
      }

      if (seenLinks.has(link)) return;
      seenLinks.add(link);

      const priceEl = $card.find(config.priceSelectors).first();
      let priceText = priceEl.text().trim();
      let price = parsePrice(priceText);

      let imageUrl = null;
      const imgEl = $card.find(config.imageSelectors).first();
      const src = imgEl.attr('data-src') || imgEl.attr('data-original') || imgEl.attr('src');
      
      if (src && src.length > 10 && !src.startsWith('data:image')) {
        imageUrl = src.startsWith('/') ? config.baseUrl + src : src;
        imageUrl = imageUrl.replace('https:///', 'https://');
      }

      items.push({ title, price, priceText, link, image: imageUrl, site: config.name });
    });

    return { site: config.name, query, url, items };
  } catch (err) {
    return { site: config.name, query, url, items: [], error: err.message };
  }
}

async function scrapeAllSites(query) {
  const configs = await getSiteConfigs();
  const siteKeys = Object.keys(configs);
  // Περνάμε το configs ως τρίτο όρισμα
  const results = await Promise.allSettled(siteKeys.map((key) => scrapeSite(key, query, configs)));
  return results.map(res => res.status === 'fulfilled' ? res.value : { error: res.reason });
}

module.exports = { scrapeSite, scrapeAllSites };