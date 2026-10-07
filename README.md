# ULAMEX — Kalkulator ceny cięcia laserowego

Proste narzędzie webowe dla handlowca. Liczy cenę cięcia laserowego na podstawie czasu z CypCut, stałej stawki maszynowej (600 zł/h) i marży. Pod każdym polem jest objaśnienie: co to jest, gdzie to znaleźć i co wpisać.

Bez logowania, bez backendu. Jeden plik HTML + CSS + JS. Działa też offline (otwierasz `index.html` w przeglądarce).

## Co potrafi

- Wiele detali w jednej wycenie: dodajesz je po kolei, a narzędzie sumuje łączną wartość netto dla klienta
- Ustawienia wspólne (korekcja, stawka, marża) ustawiasz raz, dane detalu (nazwa, czas, ilość) wpisujesz osobno dla każdej pozycji
- Każde pole ma tooltip (?), poradę dla handlowca i przykład
- Czas z CypCut wpisujesz w dwa pola (minuty i sekundy), bez przeliczania na ułamki minut
- Czas możesz podać dla jednej sztuki albo dla całego programu (nestu); w drugim przypadku narzędzie dzieli go przez liczbę sztuk w programie
- Stała stawka maszynowa 600 zł/h (nie do edycji); rabatowanie przez marżę i rabat za ilość
- Dopłaty za prototyp: „Prototyp" +50 zł lub „Prototyp + Michał" +100 zł (jednorazowo do wartości detalu)
- Przeliczanie na żywo (wynik zmienia się podczas pisania)
- Automatyczny rabat za ilość liczony osobno dla każdego detalu (11-50 szt: -5%, 51-200 szt: -10%, powyżej 200 szt: -15%)
- Usuwanie pojedynczych pozycji i czyszczenie całej wyceny
- Walidacja z prostymi komunikatami (np. „Czas musi być większy niż 0")
- Przycisk „Kopiuj całą wycenę" (gotowy tekst dla klienta, z listą pozycji i sumą)
- Raport blachy: wgrywasz DXF detalu, narzędzie pokazuje kształt, liczy ile sztuk wchodzi na arkusz (1500×3000, 1250×2500, 1000×2000 lub własny) i rysuje poglądowy układ; rozpiskę kopiujesz dla klienta
- Sekcja FAQ „Co powiedzieć klientowi"
- Działa na telefonie i na komputerze

## Jak liczy cenę

```
czas na 1 szt       = czas z CypCut ÷ liczba sztuk w programie (gdy czas dotyczy całego nestu)
rzeczywisty czas    = czas na 1 szt × współczynnik korekcji
koszt cięcia        = (rzeczywisty czas ÷ 60) × 600 zł/h (stawka stała)
marża               = koszt cięcia × (marża% ÷ 100)
cena za szt (baza)  = koszt cięcia + marża
rabat za ilość      = baza × (rabat% ÷ 100)
cena za sztukę      = baza − rabat
dopłata             = prototyp (0 / 50 / 100 zł, jednorazowo)
wartość detalu      = cena za sztukę × ilość + dopłata
wycena łączna       = suma wartości wszystkich dodanych detali
```

Wszystkie kwoty są netto (bez VAT).

## Uruchomienie lokalne

Najprościej: kliknij dwa razy w `index.html`.

Albo przez lokalny serwer (Python 3):

```bash
python -m http.server 5599
# otwórz http://localhost:5599
```

## Publikacja na Render

### Opcja A: panel Render (najprościej)

1. Wrzuć ten folder do repozytorium Git (GitHub / GitLab).
2. W Render kliknij **New +** > **Static Site**.
3. Wskaż repozytorium.
4. Ustaw:
   - **Build Command:** zostaw puste
   - **Publish Directory:** `.` (kropka)
5. **Create Static Site**. Po chwili dostaniesz link `https://...onrender.com`.

### Opcja B: Blueprint (`render.yaml`)

W repo jest już plik `render.yaml`. W Render kliknij **New +** > **Blueprint**, wskaż repo, zatwierdź. Reszta ustawi się sama.

## Zmiana koloru marki

Kolor ULAMEX jest zapisany jako zmienna CSS na górze `styles.css`:

```css
:root { --red: #E2001A; }
```

Domyślnie użyto oficjalnej czerwieni z logo i ofert (`#E2001A`). Jeśli wolisz `#F4373D`, zmień tylko tę jedną linię.

## Zmiana stałej stawki

Stawka maszynowa jest zaszyta na stałe w `script.js`:

```js
const STAWKA = 600;
```

Chcesz inną stawkę? Zmień tylko tę jedną liczbę.

## Struktura plików

```
kalkulator-laser-ulamex/
├── index.html          # struktura strony i wszystkie objaśnienia
├── styles.css          # wygląd, brand ULAMEX, responsywność, wydruk
├── script.js           # przeliczanie, walidacja, rabaty, tooltipy, kopiowanie
├── nesting.js          # raport blachy: parser DXF, układ na arkuszu, podgląd SVG
├── assets/
│   └── logo-ulamex.png # logo
├── render.yaml         # konfiguracja Render (Blueprint)
├── .gitignore
└── README.md
```

## Kontakt (na ofercie)

ULAMEX, Zawada 144, Tomaszów Mazowiecki · tel. +48 504 424 761 · quote@ulamex.com
