# MKK Hygiene-Monitor

Installierbare Progressive Web App (PWA) für Veröffentlichungen nach § 40 Abs. 1a LFGB im Zuständigkeitsbereich Main-Kinzig-Kreis.

## Funktionen
- Volltextsuche und Ortsfilter
- Beobachtung einzelner Orte
- Browser-/PWA-Benachrichtigungen über neue Einträge
- direkte Links zur amtlichen Detailansicht
- automatische Aktualisierung der amtlichen Liste alle 6 Stunden via GitHub Actions
- GitHub-Pages-Deployment

## Datenquelle
https://verbraucherfenster.hessen.de/ernaehrung/sichere-lebensmittel/veroeffentlichung-maengel-lfgb

## Installation im Repository
Den gesamten Inhalt dieses Ordners in die Wurzel des Repositorys `mkk-hygiene-app` übernehmen. Danach unter GitHub → Settings → Pages als Quelle **GitHub Actions** aktivieren. Die Workflows können anschließend manuell gestartet werden; danach laufen die Datenupdates automatisch.

## Benachrichtigungen
Die App prüft bei jedem Öffnen auf neue Einträge. Auf unterstützten Android-/Chrome-Installationen wird zusätzlich Periodic Background Sync registriert. Der Browser entscheidet letztlich, wie häufig Hintergrundprüfungen tatsächlich ausgeführt werden; für garantierte Push-Nachrichten wäre ein eigener Push-Backend-Dienst erforderlich.

## Hinweis
Dies ist keine amtliche App des Main-Kinzig-Kreises oder des Landes Hessen. Maßgeblich sind ausschließlich die amtlichen Originalveröffentlichungen.
