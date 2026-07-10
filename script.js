/* ============================================================
   ULAMEX — Kalkulator ceny cięcia laserowego
   Logika przeliczania, walidacja, rabaty, tooltipy.
   ============================================================ */

'use strict';

/* ---------- Formatowanie liczb (po polsku) ---------- */
const zl = new Intl.NumberFormat('pl-PL', {
  style: 'currency', currency: 'PLN',
  minimumFractionDigits: 2, maximumFractionDigits: 2
});
const num2 = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int0 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });

/* ---------- Wartości domyślne ---------- */
const DEFAULTS = { czasMin: '2', czasSek: '0', korekcja: '1.2', stawka: '500', marza: '20', ilosc: '1' };

/* ---------- Skróty do elementów ---------- */
const $ = (id) => document.getElementById(id);

const el = {
  czasMin: $('czas-min'),
  czasSek: $('czas-sek'),
  korekcja: $('korekcja'),
  korekcjaRange: $('korekcja-range'),
  stawka: $('stawka'),
  marzaRange: $('marza-range'),
  marzaDisplay: $('marza-display'),
  ilosc: $('ilosc'),
  // wyniki
  time: $('result-time'),
  koszt: $('out-koszt'),
  marza: $('out-marza'),
  baza: $('out-baza'),
  rlineRabat: $('rline-rabat'),
  rabatPct: $('out-rabat-pct'),
  rabat: $('out-rabat'),
  sztuka: $('out-sztuka'),
  total: $('out-total'),
  iloscLabel: $('out-ilosc-label'),
  // akcje
  btnReset: $('btn-reset'),
  btnCopy: $('btn-copy'),
  copyOk: $('copy-ok')
};

/* ---------- Pomocnicze ---------- */
// Zamienia przecinek na kropkę i parsuje liczbę.
function parseNum(value) {
  if (value === null || value === undefined) return NaN;
  return parseFloat(String(value).replace(',', '.'));
}

function showError(inputEl, errId, message) {
  const errEl = $(errId);
  if (errEl) { errEl.textContent = message; errEl.hidden = false; }
  if (inputEl) inputEl.classList.add('invalid');
}
function clearError(inputEl, errId) {
  const errEl = $(errId);
  if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
  if (inputEl) inputEl.classList.remove('invalid');
}

// Rabat za ilość (progi z pola „Ile sztuk").
function rabatProc(qty) {
  if (qty <= 10) return 0;
  if (qty <= 50) return 5;
  if (qty <= 200) return 10;
  return 15;
}

// Kolorowe wypełnienie suwaka do aktualnej wartości.
function updateRangeFill(rangeEl) {
  const min = parseFloat(rangeEl.min);
  const max = parseFloat(rangeEl.max);
  const val = parseFloat(rangeEl.value);
  const pct = ((val - min) / (max - min)) * 100;
  rangeEl.style.background =
    `linear-gradient(90deg, var(--red) 0%, var(--red) ${pct}%, #dfe2e7 ${pct}%, #dfe2e7 100%)`;
}

/* ---------- Główne przeliczenie ---------- */
function calculate() {
  let ok = true;

  // Pole 1: czas z CypCut (minuty + sekundy)
  const czasMin = parseNum(el.czasMin.value);
  const czasSek = parseNum(el.czasSek.value);
  el.czasMin.classList.remove('invalid');
  el.czasSek.classList.remove('invalid');
  let czas;
  if (isNaN(czasMin) || czasMin < 0) {
    showError(el.czasMin, 'err-czas', 'Minuty wpisz jako liczbę 0 lub większą.');
    ok = false;
  } else if (isNaN(czasSek) || czasSek < 0 || czasSek > 59) {
    showError(el.czasSek, 'err-czas', 'Sekundy wpisz od 0 do 59.');
    ok = false;
  } else if (czasMin + czasSek / 60 <= 0) {
    showError(el.czasMin, 'err-czas', 'Czas musi być większy niż 0. Wpisz minuty i sekundy z CypCut.');
    el.czasSek.classList.add('invalid');
    ok = false;
  } else {
    clearError(el.czasMin, 'err-czas');
    czas = czasMin + czasSek / 60;
  }

  // Pole 2: współczynnik korekcji
  const korekcja = parseNum(el.korekcja.value);
  if (isNaN(korekcja) || korekcja <= 0) {
    showError(el.korekcja, 'err-korekcja', 'Współczynnik musi być większy niż 0 (zazwyczaj 1,2).');
    ok = false;
  } else { clearError(el.korekcja, 'err-korekcja'); }

  // Pole 3: stawka za godzinę
  const stawka = parseNum(el.stawka.value);
  if (isNaN(stawka) || stawka < 0) {
    showError(el.stawka, 'err-stawka', 'Stawka nie może być ujemna. Wpisz stawkę za godzinę cięcia.');
    ok = false;
  } else if (stawka === 0) {
    showError(el.stawka, 'err-stawka', 'Stawka wynosi 0. Sprawdź, czy to na pewno prawidłowa wartość.');
    // 0 dopuszczamy do obliczeń, ale ostrzegamy
  } else { clearError(el.stawka, 'err-stawka'); }

  // Pole 4: marża (suwak, zawsze w zakresie 0-50)
  const marza = parseNum(el.marzaRange.value);

  // Pole 5: ilość sztuk
  let ilosc = parseNum(el.ilosc.value);
  if (isNaN(ilosc) || ilosc < 1) {
    showError(el.ilosc, 'err-ilosc', 'Ilość musi być większa niż 0. Wpisz, ile sztuk chce klient.');
    ok = false;
  } else { clearError(el.ilosc, 'err-ilosc'); ilosc = Math.floor(ilosc); }

  if (!ok) { blankResults(); return; }

  /* --- Obliczenia --- */
  const czasRzecz = czas * korekcja;                 // rzeczywisty czas [min]
  const kosztCiecia = (czasRzecz / 60) * stawka;      // Wynik 1
  const kwotaMarzy = kosztCiecia * (marza / 100);     // Wynik 2
  const bazaSztuka = kosztCiecia + kwotaMarzy;        // cena za szt. bez rabatu

  const rabat = rabatProc(ilosc);                     // %
  const kwotaRabatu = bazaSztuka * (rabat / 100);
  const cenaSztuka = bazaSztuka - kwotaRabatu;        // Wynik 3 (do klienta)
  const cenaCalkowita = cenaSztuka * ilosc;           // Wynik 4

  /* --- Wyświetlenie --- */
  el.time.innerHTML = `Rzeczywisty czas cięcia: <b>${num2.format(czasRzecz)} min</b> <span>(CypCut × korekcja)</span>`;
  el.koszt.textContent = zl.format(kosztCiecia);
  el.marza.textContent = '+ ' + zl.format(kwotaMarzy);
  el.baza.textContent = zl.format(bazaSztuka);

  if (rabat > 0) {
    el.rlineRabat.hidden = false;
    el.rabatPct.textContent = `(-${rabat}%)`;
    el.rabat.textContent = '− ' + zl.format(kwotaRabatu);
  } else {
    el.rlineRabat.hidden = true;
  }

  el.sztuka.textContent = zl.format(cenaSztuka);
  el.total.textContent = zl.format(cenaCalkowita);
  el.iloscLabel.textContent = `(${int0.format(ilosc)} szt${rabat > 0 ? `, rabat -${rabat}%` : ''})`;

  // zapamiętaj do kopiowania
  lastResult = { czas, czasMin, czasSek, korekcja, czasRzecz, stawka, kosztCiecia, marza, kwotaMarzy,
                 bazaSztuka, rabat, kwotaRabatu, cenaSztuka, ilosc, cenaCalkowita };
}

function blankResults() {
  lastResult = null;
  const dash = '—';
  el.koszt.textContent = dash;
  el.marza.textContent = dash;
  el.baza.textContent = dash;
  el.rlineRabat.hidden = true;
  el.sztuka.textContent = dash;
  el.total.textContent = dash;
  el.time.innerHTML = 'Popraw zaznaczone pole, aby zobaczyć wynik.';
}

let lastResult = null;

/* ---------- Synchronizacja suwaków ---------- */
// Współczynnik korekcji: suwak <-> pole liczbowe
el.korekcjaRange.addEventListener('input', () => {
  el.korekcja.value = el.korekcjaRange.value;
  updateRangeFill(el.korekcjaRange);
  calculate();
});
el.korekcja.addEventListener('input', () => {
  const v = parseNum(el.korekcja.value);
  if (!isNaN(v)) {
    const clamped = Math.min(2, Math.max(1, v));
    el.korekcjaRange.value = clamped;
    updateRangeFill(el.korekcjaRange);
  }
  calculate();
});

// Marża: suwak -> wyświetlacz
el.marzaRange.addEventListener('input', () => {
  el.marzaDisplay.textContent = el.marzaRange.value;
  updateRangeFill(el.marzaRange);
  calculate();
});

/* ---------- Pozostałe pola ---------- */
['czasMin', 'czasSek', 'stawka', 'ilosc'].forEach((id) => {
  el[id].addEventListener('input', calculate);
});

/* ---------- Tooltipy (klik na telefonie, hover na desktopie) ---------- */
const infoButtons = document.querySelectorAll('.info-btn');
infoButtons.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = btn.classList.contains('is-open');
    // zamknij wszystkie inne
    infoButtons.forEach((b) => { b.classList.remove('is-open'); b.setAttribute('aria-expanded', 'false'); });
    if (!isOpen) { btn.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
  });
});
// klik poza tooltipem zamyka
document.addEventListener('click', () => {
  infoButtons.forEach((b) => { b.classList.remove('is-open'); b.setAttribute('aria-expanded', 'false'); });
});
// Esc zamyka
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    infoButtons.forEach((b) => { b.classList.remove('is-open'); b.setAttribute('aria-expanded', 'false'); });
  }
});

/* ---------- Reset ---------- */
el.btnReset.addEventListener('click', () => {
  el.czasMin.value = DEFAULTS.czasMin;
  el.czasSek.value = DEFAULTS.czasSek;
  el.korekcja.value = DEFAULTS.korekcja;
  el.korekcjaRange.value = DEFAULTS.korekcja;
  el.stawka.value = DEFAULTS.stawka;
  el.marzaRange.value = DEFAULTS.marza;
  el.marzaDisplay.textContent = DEFAULTS.marza;
  el.ilosc.value = DEFAULTS.ilosc;
  updateRangeFill(el.korekcjaRange);
  updateRangeFill(el.marzaRange);
  calculate();
});

/* ---------- Kopiowanie wyceny ---------- */
el.btnCopy.addEventListener('click', async () => {
  if (!lastResult) { return; }
  const r = lastResult;
  const lines = [
    'Wycena cięcia laserowego ULAMEX',
    '--------------------------------',
    `Czas CypCut: ${r.czasMin} min ${r.czasSek} sek × korekcja ${num2.format(r.korekcja)} = ${num2.format(r.czasRzecz)} min`,
    `Koszt cięcia (netto): ${zl.format(r.kosztCiecia)}`,
    `Marża ${r.marza}%: + ${zl.format(r.kwotaMarzy)}`,
    `Cena za sztukę (bez rabatu): ${zl.format(r.bazaSztuka)}`,
    r.rabat > 0 ? `Rabat za ilość -${r.rabat}%: − ${zl.format(r.kwotaRabatu)}` : 'Rabat za ilość: brak',
    `CENA ZA 1 SZTUKĘ: ${zl.format(r.cenaSztuka)}`,
    `Ilość: ${int0.format(r.ilosc)} szt`,
    `CENA CAŁKOWITA (netto): ${zl.format(r.cenaCalkowita)}`,
    '',
    'Cena netto, bez VAT. Kontakt: quote@ulamex.com, tel. +48 504 424 761'
  ];
  const text = lines.join('\n');

  try {
    await navigator.clipboard.writeText(text);
    flashCopyOk();
  } catch (err) {
    // awaryjnie, gdy schowek jest zablokowany (np. http)
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); flashCopyOk(); } catch (e2) { alert('Nie udało się skopiować. Zaznacz wynik ręcznie.'); }
    document.body.removeChild(ta);
  }
});

let copyTimer = null;
function flashCopyOk() {
  el.copyOk.hidden = false;
  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => { el.copyOk.hidden = true; }, 2500);
}

/* ---------- Start ---------- */
updateRangeFill(el.korekcjaRange);
updateRangeFill(el.marzaRange);
calculate();
