/* ============================================================
   ULAMEX — Kalkulator ceny cięcia laserowego
   Wiele detali w jednej wycenie + łączna wartość dla klienta.
   ============================================================ */

'use strict';

/* ---------- Formatowanie liczb (po polsku) ---------- */
const zl = new Intl.NumberFormat('pl-PL', {
  style: 'currency', currency: 'PLN',
  minimumFractionDigits: 2, maximumFractionDigits: 2
});
const num2 = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int0 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });

/* ---------- Domyślne ustawienia (nie detal) ---------- */
const DEFAULTS = { korekcja: '1.2', stawka: '500', marza: '20' };

/* ---------- Skróty do elementów ---------- */
const $ = (id) => document.getElementById(id);

const el = {
  // ustawienia wspólne
  korekcja: $('korekcja'),
  korekcjaRange: $('korekcja-range'),
  stawka: $('stawka'),
  marzaRange: $('marza-range'),
  marzaDisplay: $('marza-display'),
  // detal
  nazwa: $('nazwa'),
  czasMin: $('czas-min'),
  czasSek: $('czas-sek'),
  ilosc: $('ilosc'),
  // karta bieżącego detalu
  time: $('result-time'),
  koszt: $('out-koszt'),
  marza: $('out-marza'),
  baza: $('out-baza'),
  rlineRabat: $('rline-rabat'),
  rabatPct: $('out-rabat-pct'),
  rabat: $('out-rabat'),
  sztuka: $('out-sztuka'),
  wartosc: $('out-wartosc'),
  wartoscLabel: $('out-wartosc-label'),
  btnAdd: $('btn-add'),
  addHint: $('add-hint'),
  // karta wyceny łącznej
  pozEmpty: $('poz-empty'),
  pozList: $('poz-list'),
  grandRow: $('grand-row'),
  grandTotal: $('grand-total'),
  btnCopy: $('btn-copy'),
  btnClear: $('btn-clear'),
  copyOk: $('copy-ok'),
  // reszta
  btnReset: $('btn-reset')
};

/* ---------- Pomocnicze ---------- */
function parseNum(value) {
  if (value === null || value === undefined) return NaN;
  return parseFloat(String(value).replace(',', '.'));
}
function showError(inputEl, errId, message) {
  const e = $(errId);
  if (e) { e.textContent = message; e.hidden = false; }
  if (inputEl) inputEl.classList.add('invalid');
}
function clearError(inputEl, errId) {
  const e = $(errId);
  if (e) { e.hidden = true; e.textContent = ''; }
  if (inputEl) inputEl.classList.remove('invalid');
}
function rabatProc(qty) {
  if (qty <= 10) return 0;
  if (qty <= 50) return 5;
  if (qty <= 200) return 10;
  return 15;
}
function updateRangeFill(rangeEl) {
  const min = parseFloat(rangeEl.min);
  const max = parseFloat(rangeEl.max);
  const val = parseFloat(rangeEl.value);
  const pct = ((val - min) / (max - min)) * 100;
  rangeEl.style.background =
    `linear-gradient(90deg, var(--red) 0%, var(--red) ${pct}%, #dfe2e7 ${pct}%, #dfe2e7 100%)`;
}

/* ---------- Stan ---------- */
let biezacy = null;   // snapshot poprawnie wyliczonego detalu lub null
let pozycje = [];     // dodane pozycje wyceny
let licznik = 0;      // do stabilnych id i domyślnych nazw „Detal N"

/* ---------- Przeliczenie bieżącego detalu ---------- */
function przelicz() {
  // --- Ustawienia wspólne ---
  let settingsOk = true;
  const korekcja = parseNum(el.korekcja.value);
  if (isNaN(korekcja) || korekcja <= 0) {
    showError(el.korekcja, 'err-korekcja', 'Współczynnik musi być większy niż 0 (zazwyczaj 1,2).');
    settingsOk = false;
  } else { clearError(el.korekcja, 'err-korekcja'); }

  const stawka = parseNum(el.stawka.value);
  if (isNaN(stawka) || stawka < 0) {
    showError(el.stawka, 'err-stawka', 'Stawka nie może być ujemna. Wpisz stawkę za godzinę cięcia.');
    settingsOk = false;
  } else if (stawka === 0) {
    showError(el.stawka, 'err-stawka', 'Stawka wynosi 0. Sprawdź, czy to prawidłowa wartość.');
  } else { clearError(el.stawka, 'err-stawka'); }

  const marza = parseNum(el.marzaRange.value);

  // --- Detal ---
  const minRaw = el.czasMin.value.trim();
  const sekRaw = el.czasSek.value.trim();
  const iloscRaw = el.ilosc.value.trim();
  const brakCzasu = (minRaw === '' && sekRaw === '');
  const incomplete = brakCzasu || iloscRaw === '';

  if (!settingsOk) {
    biezacy = null;
    pokazBrak('Popraw ustawienia wyceny (współczynnik lub stawka).');
    return;
  }
  if (incomplete) {
    biezacy = null;
    clearError(el.czasMin, 'err-czas');
    el.czasSek.classList.remove('invalid');
    clearError(el.ilosc, 'err-ilosc');
    pokazBrak('Uzupełnij czas i ilość detalu, aby go wycenić.');
    return;
  }

  // walidacja detalu
  const czasMin = minRaw === '' ? 0 : parseNum(minRaw);
  const czasSek = sekRaw === '' ? 0 : parseNum(sekRaw);
  el.czasMin.classList.remove('invalid');
  el.czasSek.classList.remove('invalid');
  let ok = true;
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

  let ilosc = parseNum(iloscRaw);
  if (isNaN(ilosc) || ilosc < 1) {
    showError(el.ilosc, 'err-ilosc', 'Ilość musi być większa niż 0. Wpisz, ile sztuk chce klient.');
    ok = false;
  } else { clearError(el.ilosc, 'err-ilosc'); ilosc = Math.floor(ilosc); }

  if (!ok) { biezacy = null; pokazBrak(null); return; }

  // --- Obliczenia ---
  const czasRzecz = czas * korekcja;
  const kosztCiecia = (czasRzecz / 60) * stawka;
  const kwotaMarzy = kosztCiecia * (marza / 100);
  const bazaSztuka = kosztCiecia + kwotaMarzy;
  const rabat = rabatProc(ilosc);
  const kwotaRabatu = bazaSztuka * (rabat / 100);
  const cenaSztuka = bazaSztuka - kwotaRabatu;
  const wartosc = cenaSztuka * ilosc;

  // --- Render karty bieżącej ---
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
  el.wartosc.textContent = zl.format(wartosc);
  el.wartoscLabel.textContent = `(${int0.format(ilosc)} szt${rabat > 0 ? `, rabat -${rabat}%` : ''})`;

  biezacy = { czasMin, czasSek, korekcja, stawka, marza, czasRzecz,
              kosztCiecia, kwotaMarzy, bazaSztuka, rabat, kwotaRabatu, cenaSztuka, ilosc, wartosc };
  ustawAdd(true);
}

function pokazBrak(msg) {
  const dash = '—';
  el.koszt.textContent = dash;
  el.marza.textContent = dash;
  el.baza.textContent = dash;
  el.rlineRabat.hidden = true;
  el.sztuka.textContent = dash;
  el.wartosc.textContent = dash;
  el.wartoscLabel.textContent = '';
  el.time.textContent = msg ? msg : 'Popraw zaznaczone pole, aby wycenić detal.';
  ustawAdd(false);
}

function ustawAdd(enabled) {
  el.btnAdd.disabled = !enabled;
  el.addHint.hidden = enabled;
}

/* ---------- Wycena łączna ---------- */
function renderPozycje() {
  el.pozList.innerHTML = '';
  if (pozycje.length === 0) {
    el.pozEmpty.hidden = false;
    el.grandRow.hidden = true;
    return;
  }
  el.pozEmpty.hidden = true;
  let suma = 0;
  pozycje.forEach((p, i) => {
    suma += p.wartosc;
    const li = document.createElement('li');
    li.className = 'poz-item';

    const main = document.createElement('div');
    main.className = 'poz-main';
    const name = document.createElement('div');
    name.className = 'poz-name';
    name.textContent = `${i + 1}. ${p.nazwa}`;
    const det = document.createElement('div');
    det.className = 'poz-detail';
    det.textContent = `${int0.format(p.ilosc)} szt × ${zl.format(p.cenaSztuka)}/szt${p.rabat > 0 ? ` · rabat -${p.rabat}%` : ''}`;
    main.appendChild(name);
    main.appendChild(det);

    const val = document.createElement('div');
    val.className = 'poz-val';
    val.textContent = zl.format(p.wartosc);

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'poz-remove';
    rm.setAttribute('aria-label', 'Usuń detal z wyceny');
    rm.dataset.id = p.id;
    rm.textContent = '✕';

    li.appendChild(main);
    li.appendChild(val);
    li.appendChild(rm);
    el.pozList.appendChild(li);
  });
  el.grandRow.hidden = false;
  el.grandTotal.textContent = zl.format(suma);
}

el.btnAdd.addEventListener('click', () => {
  if (!biezacy) return;
  licznik++;
  const nazwa = el.nazwa.value.trim() || ('Detal ' + licznik);
  pozycje.push(Object.assign({ id: licznik, nazwa }, biezacy));
  renderPozycje();
  // miękki reset detalu (ustawienia zostają)
  el.nazwa.value = '';
  el.czasMin.value = '';
  el.czasSek.value = '';
  el.ilosc.value = '';
  przelicz();
  el.czasMin.focus();
});

// usuwanie pojedynczej pozycji (delegacja)
el.pozList.addEventListener('click', (e) => {
  const btn = e.target.closest('.poz-remove');
  if (!btn) return;
  const id = parseInt(btn.dataset.id, 10);
  pozycje = pozycje.filter((p) => p.id !== id);
  renderPozycje();
});

// wyczyść całą wycenę
el.btnClear.addEventListener('click', () => {
  if (pozycje.length === 0) return;
  pozycje = [];
  renderPozycje();
});

/* ---------- Kopiowanie całej wyceny ---------- */
el.btnCopy.addEventListener('click', async () => {
  const lista = pozycje.length
    ? pozycje
    : (biezacy ? [Object.assign({ id: 0, nazwa: (el.nazwa.value.trim() || 'Detal 1') }, biezacy)] : []);
  if (lista.length === 0) { flash('Najpierw dodaj detal do wyceny.'); return; }

  let suma = 0;
  const lines = ['Wycena cięcia laserowego ULAMEX', '================================'];
  lista.forEach((p, i) => {
    suma += p.wartosc;
    lines.push(`${i + 1}. ${p.nazwa}: ${int0.format(p.ilosc)} szt × ${zl.format(p.cenaSztuka)}/szt${p.rabat > 0 ? ` (rabat -${p.rabat}%)` : ''} = ${zl.format(p.wartosc)}`);
  });
  lines.push('--------------------------------');
  lines.push(`RAZEM netto: ${zl.format(suma)}`);
  lines.push('');
  lines.push('Cena netto, bez VAT. Kontakt: quote@ulamex.com, tel. +48 504 424 761');
  const text = lines.join('\n');

  try {
    await navigator.clipboard.writeText(text);
    flash('Skopiowano. Wklej w wiadomości do klienta.');
  } catch (err) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); flash('Skopiowano. Wklej w wiadomości do klienta.'); }
    catch (e2) { alert('Nie udało się skopiować. Zaznacz wynik ręcznie.'); }
    document.body.removeChild(ta);
  }
});

let copyTimer = null;
function flash(msg) {
  el.copyOk.textContent = msg;
  el.copyOk.hidden = false;
  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => { el.copyOk.hidden = true; }, 3000);
}

/* ---------- Suwaki i pola ---------- */
el.korekcjaRange.addEventListener('input', () => {
  el.korekcja.value = el.korekcjaRange.value;
  updateRangeFill(el.korekcjaRange);
  przelicz();
});
el.korekcja.addEventListener('input', () => {
  const v = parseNum(el.korekcja.value);
  if (!isNaN(v)) {
    el.korekcjaRange.value = Math.min(2, Math.max(1, v));
    updateRangeFill(el.korekcjaRange);
  }
  przelicz();
});
el.marzaRange.addEventListener('input', () => {
  el.marzaDisplay.textContent = el.marzaRange.value;
  updateRangeFill(el.marzaRange);
  przelicz();
});
['czasMin', 'czasSek', 'stawka', 'ilosc'].forEach((id) => {
  el[id].addEventListener('input', przelicz);
});

/* ---------- Tooltipy (klik na telefonie, hover na desktopie) ---------- */
const infoButtons = document.querySelectorAll('.info-btn');
infoButtons.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = btn.classList.contains('is-open');
    infoButtons.forEach((b) => { b.classList.remove('is-open'); b.setAttribute('aria-expanded', 'false'); });
    if (!isOpen) { btn.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
  });
});
document.addEventListener('click', () => {
  infoButtons.forEach((b) => { b.classList.remove('is-open'); b.setAttribute('aria-expanded', 'false'); });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    infoButtons.forEach((b) => { b.classList.remove('is-open'); b.setAttribute('aria-expanded', 'false'); });
  }
});

/* ---------- Przywróć domyślne ustawienia ---------- */
el.btnReset.addEventListener('click', () => {
  el.korekcja.value = DEFAULTS.korekcja;
  el.korekcjaRange.value = DEFAULTS.korekcja;
  el.stawka.value = DEFAULTS.stawka;
  el.marzaRange.value = DEFAULTS.marza;
  el.marzaDisplay.textContent = DEFAULTS.marza;
  el.nazwa.value = '';
  el.czasMin.value = '';
  el.czasSek.value = '';
  el.ilosc.value = '';
  updateRangeFill(el.korekcjaRange);
  updateRangeFill(el.marzaRange);
  przelicz();
});

/* ---------- Start ---------- */
updateRangeFill(el.korekcjaRange);
updateRangeFill(el.marzaRange);
renderPozycje();
przelicz();
