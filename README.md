# Restaurant Reservations Web Application

Dieses Projekt ist eine Webanwendung, die es einem Restaurant ermöglicht, eingehende Reservierungen zu verwalten. Die Anwendung besteht aus einem **Frontend**, das in **React** entwickelt wurde, und einem **Backend**, das in **JavaScript** implementiert ist. Die Datenbank verwendet **PostgreSQL**.

## Features

- Anzeige eingehender Reservierungen mit folgenden Informationen:
  - Anzahl der Personen
  - Datum der Reservierung
  - Name des Kunden
- Möglichkeit, Reservierungen anzunehmen oder abzulehnen
- Lesestatus für jede Reservierung (gelesen/ungelesen)

## Architektur

- **Frontend:** React
- **Backend:** JavaScript (Node.js)
- **Datenbank:** PostgreSQL

## Installation

### Voraussetzungen

- Node.js und npm installiert
- PostgreSQL-Datenbank installiert und konfiguriert

### Schritte zur Installation

1. **Repository klonen**
   ```bash
   git clone https://github.com/74benet/Kirschenwiese-Reservierungen.git
   cd restaurant-reservations

2. **Frontend-Abhängigkeiten installieren**
   ```bash
   npm install

3. **Backend-Abhängigkeiten installieren**
   ```bash
   cd server
   npm install

4. **Docker Compose starten**
   ```bash
   docker-compose up --build

## Nutzung
   
Das Frontend wird standardmäßig unter http://localhost:3000 laufen und das Backend unter http://localhost:8080.
Die Webanwendung zeigt eingehende Reservierungen an, und der Benutzer kann diese annehmen oder ablehnen. Der Lesestatus gibt an, ob eine Reservierung bereits betrachtet wurde.

### Einschränkungen
- Das Backend funktioniert derzeit nur lokal.
- Die Daten sind nicht universell zugänglich und können nur mit den richtigen Zugangsdaten
  abgerufen werden.

### To Do
-  Deployment und Integration der Datenbank auf Google Cloud
-  Verbesserung der Sicherheit und Implementierung eines Authentifizierungssystems.
-  Integration mit Github Secrets (Momentan nur eine .env datei)
