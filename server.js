const express = require('express');
const path = require('path');
const axios = require('axios');
const { machineIdSync } = require('node-machine-id');
const { scrapeAllSites } = require('./openCartScraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const SUPABASE_URL = 'https://qwfewlmfpdmrtrmdpdhk.supabase.co/rest/v1/licences';
const SUPABASE_KEY = 'sb_publishable_8Q_Kw4lWlaeRynyTmZzfvA_gS5UZ9nv';


const hwid = machineIdSync();

app.post('/api/register', async (req, res) => {
  const { garage_name, phone } = req.body; // Διαβάζουμε και το phone
  
  if (!garage_name || !phone) {
    return res.status(400).json({ error: 'Όλα τα πεδία είναι υποχρεωτικά' });
  }

  try {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 14);

    await axios.post(SUPABASE_URL, {
      machine_id: hwid,
      garage_name: garage_name.trim(),
      phone: phone.trim(), // Προσθήκη τηλεφώνου στο Supabase
      expires_at: expirationDate.toISOString(),
      is_active: true,
      created_at: new Date().toISOString()
    }, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Σφάλμα κατά την εγγραφή.' });
  }
});

app.get('/api/check-license', async (req, res) => {
  try {
    const { data } = await axios.get(`${SUPABASE_URL}?machine_id=eq.${hwid}`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });

    const license = data[0];


    // Αν δεν βρέθηκε εγγραφή, ζητάμε όνομα συνεργείου
    if (!license) {
      return res.json({ requires_registration: true });
    }

    const now = new Date();
    const expiresAt = new Date(license.expires_at);

    // Αν η άδεια έληξε ή απενεργοποιήθηκε
    if (!license.is_active || now > expiresAt) {
      return res.json({ valid: false, error: 'Η δοκιμαστική περίοδος ή η συνδρομή σας έχει λήξει.' });
    }

    // Όλα καλά
    res.json({ valid: true, expires_at: license.expires_at, garage_name: license.garage_name, plan: license.plan });  } catch (err) {
    
    console.error('License check on load failed:', err.message);
    res.status(500).json({ error: 'Αδυναμία επικοινωνίας με τον διακομιστή αδειών.' });
  }
});

async function checkLicense(req, res, next) {
  try {
    const { data } = await axios.get(`${SUPABASE_URL}?machine_id=eq.${hwid}`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });

    const license = data[0];

    if (!license) {
      return res.status(403).json({ requires_registration: true });
    }

    const now = new Date();
    const expiresAt = new Date(license.expires_at);

    if (!license.is_active || now > expiresAt) {
      return res.status(403).json({ 
        error: 'Η δοκιμαστική περίοδος ή η συνδρομή σας έχει λήξει. Επικοινωνήστε για ανανέωση.' 
      });
    }

    next(); // Όλα καλά, προχωράει στην αναζήτηση
  } catch (err) {
    console.error('License check failed:', err.message);
    console.error('STATUS:', err.response?.status);
    console.error('DATA:', err.response?.data);
    console.error('HEADERS:', err.response?.headers);

    return res.status(500).json({
      error: 'Αδυναμία ελέγχου άδειας χρήσης.'
    });    return res.status(500).json({ error: 'Αδυναμία ελέγχου άδειας χρήσης.' });
    }
}

function buildQuery({ make, model, part }) {
  return [make, model, part].filter(Boolean).join(' ').trim();
}

app.get('/api/search', checkLicense, async (req, res) => {
  const { make, model, year, part, product_code } = req.query;

  const is_oem = Boolean(product_code);
  const today = new Date().toISOString().split('T')[0];
  const rpcUrl = SUPABASE_URL.replace('/licences', '/rpc/log_search');

  // Fire-and-forget: Do not await this so it doesn't slow down the scraper
  axios.post(rpcUrl, {
    p_machine_id: hwid,
    p_date: today,
    p_is_oem: is_oem
  }, {
    headers: { 
      'apikey': SUPABASE_KEY, 
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  }).catch(err => console.error('Failed to log search stats:', err.message));

  const testQuery = product_code ? product_code.trim() : buildQuery({ make, model, part });

  // --- ΔΙΑΓΝΩΣΤΙΚΟΣ ΕΛΕΓΧΟΣ (HEALTH CHECK) ---
  if (testQuery === '!!test!!') {
    const scraped = await scrapeAllSites('vw'); // Βάζουμε 'vw' που ξέρουμε ότι φέρνει πολλά
    return res.json({
      results: [],
      perSite: scraped.map(({ site, siteKey, url, items, error, warning }) => ({
        site,
        siteKey,
        url,
        // Στέλνουμε ΜΟΝΟ το count, δεν στέλνουμε το ογκώδες array items
        count: items ? items.length : 0, 
        error,
        warning,
      }))
    });
  }

  if (part === '!!test!!') {
    const results = await scrapeAllSites('vw');
    return res.json(results); // Επιστρέφει απευθείας τη λίστα με τα sites και τα items τους
  }

  // Πλέον επιτρέπουμε να λείπει το part, αρκεί να έχει βάλει product_code!
  if (!part && !product_code) {
    return res.status(400).json({ error: 'Συμπληρώστε Ανταλλακτικό ή Κωδικό Προϊόντος (OEM)' });
  }

  // Η "Έξυπνη" επιλογή: Αν έδωσε κωδικό, το query είναι ο κωδικός. 
  // Αν όχι, χτίζουμε το query από τη Μάρκα, Μοντέλο, Ανταλλακτικό.
  const query = product_code ? product_code.trim() : buildQuery({ make, model, part });

  try {
    const scraped = await scrapeAllSites(query);

      const merged = scraped
        .flatMap((r) => r.items || [])
        .sort((a, b) => {
      // Αν η τιμή είναι 0, null ή undefined, την αντιμετωπίζουμε ως Infinity για να πάει στο τέλος
      const priceA = (!a.price || a.price === 0) ? Infinity : a.price;
      const priceB = (!b.price || b.price === 0) ? Infinity : b.price;
      return priceA - priceB;
    });

    const yearParam = year ? `&registration=${encodeURIComponent(year)}` : '';
    const exactSearchQ = encodeURIComponent(query); 
    const exactUrl = `https://www.car.gr/parts/search.html/?category=30&category=77${yearParam}&q=${exactSearchQ}`;
    
    const wholeCarSearchQ = encodeURIComponent(`${make || ''} ${model || ''}`.trim());
    const wholeCarUrl = `https://www.car.gr/parts/1694/complete_car.html/?category=30&category=77&category=1694${yearParam}&q=${wholeCarSearchQ}`;

    const manualLinks = [
      {
        site: 'car.gr (Ακριβές ανταλλακτικό)',
        url: exactUrl,
        reason: 'Απαιτεί μη αυτοματοποιημένη αναζήτηση.',
      },
      {
        site: 'car.gr (Ολόκληρο αυτοκίνητο για ανταλλακτικά)',
        url: wholeCarUrl,
        reason: 'Αναζήτηση σε τρακαρισμένα/ολόκληρα οχήματα για το ίδιο μοντέλο.',
      }
    ];

    res.json({
      query,
      results: merged,
      perSite: scraped.map(({ site, siteKey, url, items, error, warning }) => ({
        site,
        siteKey,
        url,
        count: items ? items.length : 0,
        error,
        warning,
      })),
      manualLinks,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Parts search running at http://localhost:${PORT}`);
});

