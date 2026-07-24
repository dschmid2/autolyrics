# Autolyrics

Web-App zur zeilenweisen Projektion von Songtexten (Englisch + deutsche Übersetzung)
während eines Konzerts. Eine Ansicht dient als Steuerung (Handy/iPad), eine als
Vollbild-Projektion (Beamer-Gerät). Beide synchronisieren sich in Echtzeit über
den mitgelieferten Server.

## Wo werden die Daten gespeichert?

Alle Songs und der aktuelle Wiedergabestatus liegen in einer einzigen Datei:

```
/data/state.json   (im Container)
./data/state.json  (auf dem NAS, durch das Volume-Mapping in docker-compose.yml)
```

Diese Datei bleibt bei Neustarts, Updates oder Neubauten des Containers erhalten,
solange der Ordner `./data` neben der `docker-compose.yml` bestehen bleibt.
Ein Backup der Songs ist einfach: die Datei kopieren, oder in der App unter
"Songs verwalten" → "Alle Songs als JSON kopieren" verwenden.

## Start auf dem NAS (Docker Compose)

Funktioniert auf Synology (Container Manager → "Projekt" mit Compose-Datei),
QNAP (Container Station), oder jedem NAS mit Docker/Docker Compose.

```bash
docker compose up -d --build
```

Danach ist die App erreichbar unter:

```
http://<NAS-IP>:8080
```

- Auf dem Handy/iPad im gleichen WLAN öffnen → Ansicht "Steuerung".
- Auf dem Rechner, der am Beamer hängt, öffnen → "Projektion öffnen" → Vollbild-Button
  (oder F11 im Browser) → Beamer-Ausgang aktivieren.

Kein Internet nötig — alles läuft im lokalen Netzwerk. Am Konzertort reicht ein
Router/Access Point, der NAS, Steuergerät und Beamer-Rechner ins selbe WLAN bringt
(z. B. ein mitgebrachter Reise-Router, falls die Location kein zuverlässiges WLAN hat).

### Synology konkret
1. Diesen Ordner auf die Synology kopieren (z. B. via File Station nach `/docker/autolyrics`).
2. Container Manager → Projekt → Erstellen → Pfad auf den Ordner zeigen lassen
   (dort liegt die `docker-compose.yml`) → Erstellen & Starten.

### QNAP konkret
1. Ordner auf die QNAP kopieren.
2. Container Station → Anwendungen → Erstellen → Compose-Datei auswählen.

## Start ohne Docker (z. B. zum Testen auf einem normalen Rechner)

```bash
npm install
npm run build
DATA_DIR=./data PORT=8080 node server/index.js
```

## Port ändern

In `docker-compose.yml` den linken Wert bei `ports` anpassen, z. B. `"9000:8080"`
für Zugriff über Port 9000.

## Entwicklung / Songs vorbereiten

Die App läuft komplett im Browser, es gibt keinen separaten Admin-Bereich —
"Songs verwalten" ist einfach eine dritte Ansicht in derselben App.
Zeilen können mit Sekunden-Zeitstempel oder mit Taktschlag-Nummer (wird über
das hinterlegte Tempo/BPM automatisch in Sekunden umgerechnet) versehen werden.
