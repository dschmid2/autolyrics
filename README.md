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

## Start & Automatische Updates mit Portainer

Da das Docker-Image dieser Anwendung automatisch via GitHub Actions gebaut und im GitHub Container Registry (GHCR) abgelegt wird, kannst du die Anwendung direkt in Portainer deployen und bei jedem neuen Image-Build automatisch aktualisieren lassen.

### 1. Image in Portainer herunterladen und starten

Es gibt zwei Wege, dies in Portainer zu tun (wir empfehlen den **Stack-Weg**, da er Volumes und Konfigurationen übersichtlich hält):

#### Weg A: Über Portainer "Stacks" (Empfohlen, Docker Compose)
1. Gehe in Portainer auf **Stacks** -> **Add stack**.
2. Gib dem Stack einen Namen (z. B. `autolyrics`).
3. Wähle **Web editor** und füge folgende Compose-Konfiguration ein:
   ```yaml
   version: "3.8"
   services:
     autolyrics:
       image: ghcr.io/username/autolyrics:latest # Ersetze "username" mit deinem GitHub-Nutzernamen/Repository-Pfad
       container_name: autolyrics
       restart: unless-stopped
       ports:
         - "8080:8080"
       volumes:
         - autolyrics-data:/data

   volumes:
     autolyrics-data:
   ```
4. Klicke unten auf **Deploy the stack**.

#### Weg B: Direkt über Portainer "Containers"
1. Gehe auf **Containers** -> **Add container**.
2. Name: `autolyrics`
3. Registry: **GitHub Container Registry (GHCR)** (falls eingerichtet) oder wähle **Advanced mode** und trage direkt das Image `ghcr.io/username/autolyrics:latest` ein.
4. Port-Mapping hinzufügen: `Host 8080` -> `Container 8080`.
5. Unter **Volumes** ein Volume oder einen Bind-Mount hinzufügen:
   - Container-Pfad: `/data`
   - Typ: Volume (z.B. ein neu erstelltes `autolyrics-data` Volume) oder Bind-Mount auf dein NAS-Verzeichnis.
6. Klicke auf **Deploy the container**.

---

### 2. Webhook für automatischen Neustart einrichten

Um Portainer anzuweisen, das neueste Image herunterzuladen und den Container neu zu starten, sobald GitHub Actions ein neues Image pusht:

#### Bei Verwendung eines Stacks (Weg A):
1. Öffne deinen erstellten Stack `autolyrics` in Portainer.
2. Scrolle nach unten zu den Einstellungen und aktiviere den Schalter **Prune services** (optional, falls sich Services ändern) und vor allem **Automatic updates**.
3. Wähle als Mechanism **Webhook** aus.
4. Portainer generiert nun eine Webhook-URL, z. B.:
   `http://<PORTAINER-IP>:<PORT>/api/stacks/webhooks/<TOKEN>`
5. Kopiere diese Webhook-URL.

#### Bei Verwendung eines Containers (Weg B):
1. Öffne den Container `autolyrics` in Portainer.
2. Scrolle nach unten und aktiviere **Recreate Webhook**.
3. Portainer generiert eine Webhook-URL, z. B.:
   `http://<PORTAINER-IP>:<PORT>/api/webhooks/recreate/<TOKEN>`
4. Kopiere diese Webhook-URL.

---

### 3. GitHub Actions konfigurieren (Automatische Auslösung)

Damit der Webhook nach dem erfolgreichen Docker-Build automatisch aufgerufen wird:

1. Gehe in deinem GitHub-Repository auf **Settings** -> **Secrets and variables** -> **Actions**.
2. Klicke auf **New repository secret**.
3. Name: `PORTAINER_WEBHOOK_URL`
4. Value: Die kopierte Webhook-URL aus Portainer (stelle sicher, dass deine Portainer-Instanz vom Internet oder dem GitHub-Runner aus über diese URL erreichbar ist, z. B. via DynDNS, Tunnel oder VPN/Reverse Proxy).
5. Klicke auf **Add secret**.

Sobald nun ein Push auf `main` stattfindet, baut GitHub Actions das Image, pusht es zu GHCR, und triggert anschließend über die konfigurierte URL Portainer. Portainer zieht das frische Image und startet den Container neu.

## Entwicklung / Songs vorbereiten

Die App läuft komplett im Browser, es gibt keinen separaten Admin-Bereich —
"Songs verwalten" ist einfach eine dritte Ansicht in derselben App.
Zeilen können mit Sekunden-Zeitstempel oder mit Taktschlag-Nummer (wird über
das hinterlegte Tempo/BPM automatisch in Sekunden umgerechnet) versehen werden.
