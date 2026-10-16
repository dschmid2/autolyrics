# Autolyrics

**Autolyrics** ist eine webbasierte Anwendung zur Echtzeit-Projektion und Anzeige von Songtexten und Übersetzungen für Live-Events, Chöre, Bands und Gottesdienste. Die Anwendung ermöglicht eine synchrone Steuerung von Songtexten über WebSockets auf mehrere Bildschirme (Projektionen, Bühnen-Monitore/Teleprompter und mobile Endgeräte).

---

## Funktionalität und Ansichten

Autolyrics bietet verschiedene spezialisierte Ansichten, die über das Netzwerk synchronisiert werden:

### 1. Steuerung (`/`)
* **Song-Auswahl & Wiedergabesteuerung**: Start, Pause, Stopp sowie Vor-/Zurückspringen um 5 Sekunden.
* **Live-Vorschau**: Anzeige des aktuellen Songtexts und der verbleibenden Zeit.
* **Direktsprung**: Klick auf eine Songzeile springt sofort zu dieser Position.
* **Player-Verwaltung**: Übersicht aller verbundenen Geräte (Player) mit der Möglichkeit, ihnen dynamisch Rollen zuzuordnen (`Live`, `Stage` oder Unassigned).
* **QR-Codes**: Automatische Generierung von QR-Codes für den schnellen Zugriff von mobilen Geräten aus auf `/player`, `/live` und `/stage`.

### 2. Projektion / Live-View (`/live`)
* **Haupt-Projektionsansicht**: Zeigt die aktuelle Songzeile in großer Schrift sowie die deutsche Übersetzung darunter an.
* **Takt-Pulse (Heartbeat)**: Visueller Indikator (pulsierender Punkt) im Takt der Musik (BPM) für Musiker und Sänger.
* **Automatischer Blackout**: Wenn keine Wiedergabe läuft, der Song zu Ende ist oder die Verbindung zum Server länger als 30 Sekunden unterbrochen wird, schaltet die Anzeige auf Schwarz.
* **Vollbildmodus**: Über Klick oder Button in den Vollbildmodus schaltbar.

### 3. Stage-View / Bühnenanzeige (`/stage`)
* **Teleprompter-Modus für Sänger & Chöre**: Zeigt ausschließlich den Originaltext ohne Übersetzungen an.
* **Dynamischer Kontext**: Zeigt konfigurierbar vergangene und zukünftige Zeilen an (z. B. 2 vergangene, 1 aktuelle, 2 zukünftige Zeilen).
* **Bühnenvorlauf**: Konfigurierbarer Zeitversatz in Sekunden, damit Sänger die nächsten Zeilen vorzeitig sehen.
* **Optische Hervorhebung**: Die aktuelle Zeile wird größer und hervorgehoben dargestellt.

### 4. Player-View (`/player`)
* **Universelle Mobilgeräte-Ansicht**: Jedes Gerät generiert eine eindeutige ID (GUID in `localStorage`).
* **Dynamische Rollenzuweisung**: Unverknüpfte Player zeigen einen Registrierungs-Bildschirm mit ihrer ID. Sobald in der Steuerung eine Rolle zugewiesen wird (`Live` oder `Stage`), wechselt die Anzeige automatisch auf die entsprechende Ansicht.

### 5. Song- & Wellenform-Editor (`/editor`)
* **MP3-Upload & Audio-Verknüpfung**: Hochladen von Audiodateien zur visuellen Ausrichtung der Songzeilen.
* **Interaktiver Wellenform-Editor**:
  * Visuelle Darstellung der MP3-Wellenform mit Takt- und Schlagraster basierend auf der Song-BPM und Taktart.
  * Platzieren und Verschieben von Songzeilen-Markern per Drag & Drop direkt auf der Wellenform.
  * **Verschiebe-Modi**: Verschieben eines einzelnen Markers oder synchrones Verschieben des ausgewählten und aller nachfolgenden Marker.
  * **Audio-Offset**: Anpassung des Audio-Startzeitpunkts (Verschieben der Tonspur relativ zum Songstart).
  * Zoom- und Playback-Steuerung.
* **Flexibles Timing-System**: Zeilen können in verschiedenen Timing-Modi angegeben werden:
  * Absolut in Sekunden
  * Relativ zur vorherigen Zeile (in Sekunden oder Takten/Schlägen)
  * Absolut in Takten und Schlägen (Bar/Beat)
* **JSON Import & Export**: Sichern und Wiederherstellen der gesamten Songbibliothek.

### 6. Anzeige-Optionen (`/options`)
* Anpassung von Schriftgrößen (Haupttext & Übersetzung).
* Positionierung des Textes (X- und Y-Achse auf dem Bildschirm).
* Aktivierung/Deaktivierung des Heartbeat-Punkts.
* Konfiguration der Stage-View (Anzahl vergangener/zukünftiger Zeilen, Bühnenvorlauf in Sekunden).

---

## Architektur und Tech-Stack

Die Anwendung ist als Lightweight-Fullstack-Webanwendung aufgebaut:

* **Backend**:
  * **Node.js & Express**: HTTP-Server für statische Dateien, API-Routen (`/api/upload`) und Ansichts-Routing (`/live`, `/stage`, `/player`).
  * **WebSocket (`ws`)**: Bidirektionale Echtzeit-Synchronisation des Wiedergabestatus, der Songdaten und der verbundenen Player.
  * **Datenpersistenz**: Speicherung aller Songs, Einstellungen und Player-Zustände in einer lokalen JSON-Datei (`data/state.json`).
  * **Multer**: Handhabung von Audio-Uploads in das Verzeichnis `data/uploads/`.
* **Frontend**:
  * **React 18**: UI-Komponentenbibliothek.
  * **Tailwind CSS**: Utility-First Styling.
  * **Lucide React**: Icon-Set.
  * **HTML5 Canvas & Web Audio API**: Dekodierung von MP3-Dateien und Rendering der Wellenform-Visualisierung.
  * **esbuild**: Schnelles Bündeln des JavaScript-Codes.

---

## Projektstruktur

```text
autolyrics/
├── data/                  # Persistente Daten (wird zur Laufzeit erstellt)
│   ├── state.json         # Gespeicherter Zustand (Songs, Wiedergabe, Player)
│   └── uploads/           # Hochgeladene MP3-Dateien
├── public/                # Statische Web-Assets & gebündelter Output
│   ├── bundle.js          # Gebündeltes Frontend-JavaScript
│   ├── index.html         # HTML-Einstiegspunkt
│   └── styles.css         # Gebündeltes Tailwind CSS
├── scripts/
│   └── generate-version.js # Generiert src/version.json anhand der Git-Commits
├── server/
│   └── index.js           # Express- und WebSocket-Server
├── src/
│   ├── app.jsx            # Haupt-React-Anwendung mit allen Views & Logik
│   ├── index.jsx          # React DOM Rendering Einstiegspunkt
│   ├── styles.css         # Tailwind-Quelldatei
│   └── version.json       # Generierte Versionsdatei
├── Dockerfile             # Container-Build-Anweisung
├── docker-compose.yml     # Docker Compose Konfiguration
├── package.json           # Dependencies und NPM Scripts
└── tailwind.config.js     # Tailwind CSS Konfiguration
```

---

## Installation & Lokaler Start

### Voraussetzungen
* Node.js (v18 oder neuer)
* npm

### Schritte

1. **Repository klonen & Abhängigkeiten installieren**:
   ```bash
   git clone <repository-url>
   cd autolyrics
   npm install
   ```

2. **Anwendung bauen**:
   Erzeugt die Versionsdatei, kompiliert das CSS mit Tailwind und bündelt die React-Anwendung mit esbuild:
   ```bash
   npm run build
   ```

3. **Server starten**:
   ```bash
   npm start
   ```
   Die Anwendung läuft standardmäßig unter `http://localhost:8080`.

---

## Docker Deployment

Ein betriebsbereites Dockerfile und `docker-compose.yml` sind enthalten.

### Start mit Docker Compose

```bash
docker-compose up -d --build
```

Die Daten (Songs und hochgeladene MP3s) werden über ein Volume im Verzeichnis `./data` auf dem Host persistiert.

---

## Lizenz

Private / Proprietary. Alle Rechte vorbehalten.
