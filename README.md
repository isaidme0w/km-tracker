# KM Tracker

Aplikacja do śledzenia przebiegu (kilometrów) współdzielonego pojazdu. Umożliwia rejestrowanie odczytów licznika, tankowań oraz automatyczne rozliczanie kosztów paliwa proporcjonalnie do przejechanych kilometrów przez poszczególnych kierowców.

## Funkcje

- **Uwierzytelnianie JWT** — logowanie, zmiana hasła, token przechowywany lokalnie.
- **Role użytkowników** — `admin` (pełny dostęp) oraz `user` (kierowca).
- **Cykle przejazdów** — cykl otwiera się od tankowania/startu i zamyka przy kolejnym tankowaniu.
- **Odczyt licznika** — rejestrowanie przebiegu z automatycznym wyliczaniem dystansu.
- **Rozliczenie kosztów** — proporcjonalny podział kosztów tankowania między kierowców.
- **Historia** — podgląd zamkniętych cykli i ich rozliczeń.
- **Panel administracyjny** — zarządzanie użytkownikami (dodawanie, edycja, usuwanie).
- **Motyw jasny/ciemny**.

## Stos technologiczny

| Warstwa | Technologia |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, React Router |
| Backend | Node.js, Express 5, TypeScript |
| Baza danych | SQLite (`better-sqlite3`) |
| Walidacja | Zod |
| Hasła / tokeny | bcrypt / jsonwebtoken |

Projekt jest zorganizowany jako **monorepo** z użyciem [npm workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces):

```
km-tracker/
├── client/   # frontend (React + Vite)
├── server/   # backend (Express + SQLite)
└── package.json  # workspace root
```

## Wymagania

- Node.js **>= 20** (zalecane 22 LTS)
- npm **>= 10**

## Instalacja

```bash
# 1. Zainstaluj zależności wszystkich workspace'ów
npm install

# 2. Utwórz plik .env dla serwera na podstawie szablonu
cp server/.env.example server/.env
```

> **Ważne:** zmień `JWT_SECRET` w `server/.env` przed uruchomieniem w środowisku produkcyjnym.

## Konfiguracja (zmienne środowiskowe)

Backend konfiguruje się wyłącznie przez `server/.env`. Dostępne zmienne:

| Zmienna | Domyślnie | Opis |
| --- | --- | --- |
| `NODE_ENV` | `development` | Środowisko (`development`, `test`, `production`) |
| `PORT` | `3001` | Port serwera HTTP |
| `DB_PATH` | `./data/km-tracker.sqlite` | Ścieżka do pliku bazy SQLite (względem `server/`) |
| `JWT_SECRET` | `change-me-in-production` | Sekret podpisywania tokenów JWT — **zmień w produkcji** |
| `JWT_EXPIRES_IN` | `7d` | Czas życia tokenu (np. `1h`, `1d`, `7d`) |
| `CORS_ORIGIN` | `http://localhost:5173` | Dozwolony origin CORS |

## Baza danych

Baza SQLite jest tworzona automatycznie, a migracje i seed uruchamiają się przy starcie serwera (patrz [`server/src/db.ts`](server/src/db.ts)). Do ręcznego zarządzania bazą dostępne są skrypty:

```bash
npm run db:migrate   # zastosuj oczekujące migracje (server/src/db migrate)
npm run db:seed      # utwórz domyślne konto admina
npm run db:setup     # migracje + seed
```

Przy pierwszym starcie tworzone jest **domyślne chronione konto administratora**:

- login: `admin`
- hasło: `admin`

> Zmień hasło administratora zaraz po pierwszym logowaniu.

## Uruchamianie lokalne (development)

```bash
npm run dev
```

Uruchamia jednocześnie dwa procesy (przez `concurrently`):

- **Backend** — `http://localhost:3001` (tsx watch)
- **Frontend** — `http://localhost:5173` (Vite z proxy `/api` → `3001`)

Aby uruchomić każdy z osobna:

```bash
npm run dev --workspace server
npm run dev --workspace client
```

---

## Uruchamianie na produkcji

### 1. Zbuduj aplikację

```bash
# Frontend — zbuduj statyczne pliki do client/dist
npm run build --workspace client

# Backend — skompiluj TypeScript do server/dist
npm run build --workspace server
```

### 2. Skonfiguruj środowisko produkcyjne

Utwórz `server/.env` z odpowiednimi wartościami:

```env
NODE_ENV=production
PORT=3001
DB_PATH=./data/km-tracker.sqlite
JWT_SECRET=<DŁUGI_LOSOWY_CIĄG>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://twoja-domena.pl
```

Wygeneruj bezpieczny sekret np. przez Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

albo przez OpenSSL:

```bash
openssl rand -hex 48
```

### 3. Uruchom serwer

```bash
# Z katalogu root
npm start

# …lub równoważnie, tylko workspace serwera
npm run start --workspace server
```

Backend uruchomi się z [`server/dist/index.js`](server/dist/index.js), ponownie zastosuje migracje i seed.

### 4. Serwowanie frontendu

W produkcji (`NODE_ENV=production`) backend sam serwuje zbudowany frontend z `client/dist` pod tą samą domeną i portem — dzięki czemu `npm start` wystarcza, aby pod `http://localhost:3001` (lub pod domeną) działała cała aplikacja. Routing SPA (np. `/history`, `/profile`) obsługuje fallback na `index.html` (patrz [`server/src/app.ts`](server/src/app.ts)).

Klient używa względnego `baseURL: '/api'` (patrz [`client/src/api.ts`](client/src/api.ts)), więc frontend i API muszą być dostępne pod tą samą domeną. Domyślne serwowanie przez backend to realizuje bez dodatkowej konfiguracji.

#### Opcjonalnie: reverse proxy (Nginx/Caddy)

Jeśli wolisz serwować statykę i HTTPS na zewnętrznym reverse proxy, możesz przekierować cały ruch na backend:

```nginx
server {
    listen 80;
    server_name twoja-domena.pl;

    # Cały ruch (statyka + API) -> backend Express
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> W tym wariancie backend nadal obsługuje statykę, a Nginx (lub Caddy) pełni rolę terminatora HTTPS / load balancera. Po zmianie `CORS_ORIGIN` na właściwą domenę, żądania z tej samej domeny nie będą blokowane przez CORS.

### 5. Uruchamianie jako usługa (systemd)

Przykładowy plik jednostki `/etc/systemd/system/km-tracker.service`:

```ini
[Unit]
Description=KM Tracker backend
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/km-tracker/server
EnvironmentFile=/srv/km-tracker/server/.env
ExecStart=/usr/bin/npm run start --workspace server
Restart=always
RestartSec=5
User=kmtracker

[Install]
WantedBy=multi-user.target
```

> Dopasuj ścieżki i nazwę użytkownika systemowego do własnego środowiska.

## Skrypty (package.json root)

| Skrypt | Opis |
| --- | --- |
| `npm run dev` | Uruchom backend + frontend w trybie deweloperskim |
| `npm run build` | Zbuduj frontend i backend |
| `npm run start` | Uruchom backend produkcyjnie (`dist`) |
| `npm run db:migrate` | Zastosuj migracje bazy |
| `npm run db:seed` | Utwórz domyślne konto admina |
| `npm run db:setup` | Migracje + seed |

## Testy

```bash
npm test --workspace server
```

## Struktura projektu

```
client/
  src/
    api.ts          # klient axios (baseURL /api)
    pages/          # Login, Dashboard, History, Profile, Admin
    components/     # komponenty współdzielone (np. Pagination)
server/
  src/
    index.ts        # punkt wejścia (start serwera + graceful shutdown)
    app.ts          # montowanie routerów i middleware
    db.ts           # połączenie SQLite, migracje, seed
    config/env.ts   # walidacja zmiennych środowiskowych (Zod)
    routes/         # auth, users, odometer, cycles
    middleware/     # auth, error-handler, not-found
  migrations/
    001_init.sql    # schemat bazy