# SmartFood — Tracciabilità della filiera con Circular Protocol

Applicazione web sperimentale per registrare e consultare gli eventi di una filiera agroalimentare tramite **Circular Protocol**.

Il progetto combina un backend **FastAPI**, un database **MySQL** e un frontend HTML/JavaScript. Gli utenti possono autenticarsi, associare un wallet al proprio profilo, firmare transazioni nel browser e consultare la storia dei lotti attraverso QR code e certificati PDF.

> Il repository contiene un prototipo con configurazione orientata allo sviluppo locale. Il Compose avvia MySQL e phpMyAdmin; il backend Python viene avviato separatamente.

## Funzionalità

- Registrazione e login con password, hashing bcrypt e autenticazione JWT.
- Login Google tramite OAuth/OpenID Connect.
- Associazione di indirizzo wallet e chiave pubblica al profilo.
- Importazione della chiave privata nel browser e conservazione cifrata in IndexedDB.
- Preparazione delle transazioni sul backend e firma locale.
- Invio di transazioni di tipo `C_TYPE_CERTIFICATE`.
- Collegamento degli eventi tramite riferimenti `parents`.
- Consultazione pubblica della filiera e timeline degli eventi recuperati.
- QR code associati alle transazioni.
- Download di certificati PDF con dati della transazione e QR code.
- Visualizzazione delle transazioni del wallet autenticato.

## Architettura e flusso

Il database memorizza profili utente e QR code. Gli eventi della filiera vengono serializzati in JSON, codificati in esadecimale e inviati a Circular Protocol: il payload contiene i dati dell'evento, non soltanto il loro hash.

Il flusso di inserimento è:

1. L'utente compila un evento della filiera.
2. `POST /tx/build` prepara la transazione non firmata e restituisce `hashid` e `unsigned_tx`.
3. Il browser recupera la chiave cifrata da IndexedDB e la decifra usando la passphrase.
4. La firma viene generata localmente con le utility Circular.
5. `POST /tx/submit` riceve transazione e firma, controlla il mittente rispetto al wallet dell'utente e invia la richiesta al Network Access Gateway.
6. Il backend registra il QR code; il frontend richiede il certificato PDF e la consultazione dell'esito.

Il flusso web non invia la chiave privata al backend. Nel browser la chiave è cifrata con **AES-GCM a 256 bit**, derivando la chiave di cifratura dalla passphrase tramite **PBKDF2/SHA-256 con 200.000 iterazioni**. Salt e IV sono generati con `crypto.getRandomValues()`.

## Stack

| Componente | Tecnologia |
| --- | --- |
| Backend | FastAPI, Uvicorn, Pydantic |
| Autenticazione | python-jose, Passlib/bcrypt, Authlib |
| Database | MySQL, mysql-connector-python |
| Blockchain | SDK Python `circular_protocol_api` e SDK JavaScript incluso |
| Interfaccia | HTML, JavaScript, Bootstrap, jQuery |
| Storage delle chiavi | IndexedDB e Web Crypto API |
| QR code | qrcode |
| PDF | FPDF; PDF.js per leggere i certificati nel frontend |

Le dipendenze Python sono elencate in `requirements.txt`. Il file contiene alcune righe duplicate; l'ambiente completo va verificato prima dell'uso.

## Requisiti

- Git e un interprete Python compatibile con le versioni in `requirements.txt`.
- Docker e Docker Compose, oppure un'istanza MySQL configurata separatamente.
- Un browser con supporto a IndexedDB e Web Crypto.
- Accesso Internet per Circular Protocol, le risorse CDN del frontend e, se usato, Google OAuth.
- Un wallet valido sulla rete Circular selezionata, con disponibilità sufficiente a eseguire le operazioni richieste dalla rete.

La versione Python originale non è dichiarata nel repository. Per preparare un ambiente puoi partire da Python 3.12 e verificare l'installazione delle dipendenze; questa scelta non costituisce una certificazione di compatibilità.

## Installazione locale

### 1. Clona il repository e prepara Python

```bash
git clone https://github.com/DomenicoVillari3/security_project.git
cd security_project
python -m venv .venv
```

Su Linux/macOS:

```bash
source .venv/bin/activate
```

Su Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Installa le dipendenze:

```bash
python -m pip install -r requirements.txt
```

### 2. Configura i servizi database

Il `docker-compose.yaml` incluso espone:

| Servizio | Container | Porta host |
| --- | --- | ---: |
| MySQL | `mysql01` | 3306 |
| phpMyAdmin | `myadmin` | 8123 |

Prima dell'avvio, imposta una password root per il tuo ambiente nel campo `MYSQL_ROOT_PASSWORD` del Compose. Il valore presente nel file è una credenziale di sviluppo fissa.

```bash
docker compose up -d
docker compose logs -f mysql
```

Il Compose non crea automaticamente il database `smartfood` e non importa il dump SQL. Attendi che MySQL sia pronto, poi apri una sessione amministrativa:

```bash
docker compose exec mysql mysql -uroot -p
```

Inserisci la password configurata e prepara il database e l'utente locale:

```sql
CREATE DATABASE smartfood
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE USER 'smartfood_app'@'%'
  IDENTIFIED BY 'sostituisci_con_password_database';

GRANT ALL PRIVILEGES ON smartfood.* TO 'smartfood_app'@'%';
```

Questi privilegi sono pensati per la preparazione dell'ambiente locale; limita quelli dell'utente applicativo nell'ambiente di distribuzione.

Il dump `smartfood.sql` è stato esportato da MySQL **8.0.32** e usa la collation `utf8mb4_0900_ai_ci`. Comprende **schema e dati**, inclusi record utente e QR code: per un ambiente nuovo prepara una copia con i soli elementi che intendi importare.

Per ripristinare il dump in un database appena creato, su una shell che supporta la redirezione:

```bash
docker compose exec -T mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" smartfood' < smartfood.sql
```

In alternativa importa il file con phpMyAdmin, disponibile su http://localhost:8123, selezionando il database `smartfood` e un utente autorizzato.

Le tabelle applicative sono:

| Tabella | Contenuto |
| --- | --- |
| `user` | Profilo, password hash, wallet, chiave pubblica e dati Google |
| `transaction_qrcode` | ID transazione, QR PNG in Base64 e URL di consultazione |

**Compatibilità dello schema:** nel dump `user.public_key` è `NOT NULL` senza default, mentre gli INSERT di registrazione e Google login non valorizzano il campo. In un server con modalità strict questo può bloccare la creazione degli utenti. Allinea lo schema e gli INSERT prima di usare la registrazione. Inoltre il vincolo univoco su `wallet_addr` può impedire di creare più utenti Google con indirizzo iniziale vuoto.

### 3. Crea `.env`

Nella radice del progetto:

```dotenv
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=smartfood_app
MYSQL_PASSWORD=sostituisci_con_password_database
MYSQL_DATABASE=smartfood

JWT_SECRET=sostituisci_con_un_segreto_casuale
JWT_ALGORITHM=HS256
SESSION_SECRET=sostituisci_con_un_altro_segreto_casuale

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

I segreti JWT e sessione devono essere distinti. Puoi generare un valore casuale per ciascuno con:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

| Variabile | Uso |
| --- | --- |
| `MYSQL_HOST` / `MYSQL_PORT` | Indirizzo del database; la porta ha default 3306 |
| `MYSQL_USER` / `MYSQL_PASSWORD` | Credenziali dell'utente applicativo |
| `MYSQL_DATABASE` | Database selezionato |
| `JWT_SECRET` | Segreto per firma e verifica dei JWT |
| `JWT_ALGORITHM` | Algoritmo JWT; default HS256 |
| `SESSION_SECRET` | Segreto del middleware di sessione OAuth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Credenziali del client Google OAuth |

L'expiry JWT predefinita è di **30 minuti**, impostata in `security.py`.

Nel `.gitignore` corrente la riga `.env` è commentata: aggiungila come regola attiva prima di versionare configurazioni locali. Gli esempi del README sono segnaposto e non vanno usati come segreti reali.

### 4. Configura rete e indirizzi del frontend

La blockchain è definita dalla costante `BLOCKCHAIN` in `main.py`. Il form `templates/step.html` include una rete etichettata **Circular Testnet SandBox**.

Mantieni coerenti la costante backend, il valore del form e la rete del wallet. Attualmente `/tx/build` richiede il parametro query `blockchain`, ma costruisce la transazione usando la costante globale: cambiare soltanto il parametro non cambia la rete.

Il frontend contiene URL fissi sia per `localhost:8000` sia per `127.0.0.1:8000`. Per la demo apri l'applicazione da **http://localhost:8000**, che è l'origine di destinazione dei redirect.

Per usare un host o una porta diversi, aggiorna gli URL nei template, in `static/js/login.js`, `static/js/register.js`, `static/js/protected.js` e il base URL dei QR in `utils.py`. Token e chiavi locali sono legati all'origine del browser: cambiare origine cambia anche lo storage accessibile.

### 5. Avvia FastAPI

Esegui dalla radice del repository:

```bash
uvicorn main:app --reload --env-file .env --host 127.0.0.1 --port 8000
```

L'opzione `--env-file .env` carica le variabili prima dell'import dell'app. Questo è rilevante perché `security.py` legge il segreto JWT all'import, prima del `load_dotenv()` eseguito successivamente da altri moduli.

| Risorsa | URL |
| --- | --- |
| Applicazione | http://localhost:8000 |
| Login | http://localhost:8000/login |
| Registrazione | http://localhost:8000/register |
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| phpMyAdmin | http://localhost:8123 |

Per fermare i servizi database:

```bash
docker compose down
```

Il Compose non definisce un volume dati esplicito né una procedura di backup: configura persistenza e ripristino prima di affidargli dati da conservare.

## Login Google

Per abilitare Google login, configura un client OAuth e valorizza `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.

Il callback applicativo è:

```text
http://localhost:8000/auth/google/callback
```

Registralo tra gli URI di redirect del client. Se usi un'origine diversa, registra il callback corrispondente e avvia il flusso da quell'origine.

`GET /auth/google/login` avvia il redirect; il callback crea o aggiorna l'utente e salva il JWT in `localStorage` prima di aprire la dashboard. Un nuovo utente Google riceve ruolo `produttore` e wallet inizialmente vuoto, da associare successivamente.

## Utilizzo dell'applicazione

1. Registra un account o effettua il login.
2. Associa indirizzo wallet e chiave pubblica al profilo.
3. Apri `/insert_private_key` e importa la chiave del wallet di prova con una passphrase.
4. Apri `/step` e inserisci lotto, tipo di evento, prodotto, quantità, unità, luogo e timestamp.
5. Se l'evento deriva da transazioni precedenti, inserisci i riferimenti `parents`. Il frontend può estrarli dal testo dei certificati PDF caricati.
6. Inserisci la passphrase per firmare e inviare la transazione.
7. Consulta l'esito, il PDF e la filiera dal QR code o dalla timeline.

La chiave cifrata è conservata nel database IndexedDB `wallet-db`, store `encrypted_keys`, associata al wallet. Non è sincronizzata dal backend: conserva un backup separato della chiave e non affidarti alla sola persistenza del browser.

Il codice di firma azzera alcuni buffer di byte dopo l'uso, ma mantiene anche rappresentazioni stringa in memoria e log di debug: non va interpretato come garanzia di cancellazione completa del materiale sensibile.

## API principali

Gli endpoint indicati come protetti usano `get_current_user`, che accetta il JWT nell'header `Authorization: Bearer <token>` o, come fallback, nel cookie `token`.

| Metodo | Percorso | Autenticazione | Uso |
| --- | --- | --- | --- |
| POST | `/auth/register` | Pubblico | Registrazione e restituzione JWT |
| POST | `/auth/login` | Pubblico | Login e restituzione JWT |
| GET | `/auth/google/login` | Pubblico | Avvio OAuth |
| GET | `/auth/google/callback` | Flusso OAuth | Callback |
| POST | `/auth/logout` | Non imposta una dependency JWT | Rimozione del cookie token |
| GET | `/auth/validate_token` | JWT | Verifica del token |
| GET | `/profilo` | JWT | Profilo corrente |
| POST | `/user/update_wallet` | JWT | Aggiornamento wallet e chiave pubblica |
| POST | `/tx/build?blockchain=...` | JWT | Preparazione transazione |
| POST | `/tx/submit` | JWT | Invio della transazione firmata |
| GET | `/filiera/view/{tx_id}` | Pubblico | Pagina di consultazione |
| GET | `/filiera/tx/{blockchain}/{tx_id}` | Pubblico | Esito e dati della transazione |
| GET | `/api/filiera/chain/{tx_id}?blockchain=...` | Pubblico | Evento, antecedenti e timeline |
| GET | `/api/qrcode/{tx_id}` | Pubblico | QR Base64 e URL |
| GET | `/certificate/{blockchain}/{tx_id}` | Pubblico | Download PDF |
| GET | `/api/wallet/transactions` | JWT | Transazioni del wallet |

Le pagine HTML `/dashboard`, `/step`, `/timeline` e `/insert_private_key` sono servite senza una dependency JWT server-side; il frontend applica controlli di sessione. Le operazioni protette restano negli endpoint API.

L'esempio `add_step.txt` usa un vecchio endpoint `/filiera/add_step`, assente nel codice attuale: usa il flusso `/tx/build` → firma → `/tx/submit`.

### Esempio: login e profilo

Con un account di prova già creato:

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"utente@example.com","password":"password_del_tuo_account_di_prova"}'
```

Copia `access_token` dalla risposta:

```bash
TOKEN="inserisci_il_token_restituito"
curl http://localhost:8000/profilo \
  -H "Authorization: Bearer $TOKEN"
```

### Esempio: preparazione di un evento

L'account deve avere un wallet associato. Copia la rete configurata in `main.py`:

```bash
BLOCKCHAIN_ID="inserisci_il_valore_BLOCKCHAIN_di_main_py"
curl -X POST "http://localhost:8000/tx/build?blockchain=$BLOCKCHAIN_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "LOTTO-DEMO-001",
    "type": "raccolta",
    "product": "Olive",
    "quantity": 100,
    "unit": "kg",
    "location": "Sicilia",
    "timestamp": "2026-10-08T10:00:00Z",
    "parents": [],
    "certification": "",
    "notes": "Evento dimostrativo"
  }'
```

Questa richiesta prepara la transazione e interroga la rete per il nonce, ma non invia un evento firmato. La risposta contiene `hashid` e `unsigned_tx`.

Per l'invio, il client firma `hashid` e manda a `/tx/submit` un JSON nella forma:

```json
{
  "signed_signature": "<firma_generata_localmente>",
  "unsigned_tx": {
    "...": "oggetto completo restituito da /tx/build"
  }
}
```

L'esempio illustra la struttura: conserva l'oggetto restituito e non ricostruirlo da questo segnaposto. La chiave privata non fa parte del payload di submit.

## QR code e certificati

I QR sono generati come PNG Base64 e salvati in `transaction_qrcode`. L'URL predefinito è `http://localhost:8000/filiera/view/{tx_id}`: da un altro dispositivo `localhost` identifica quel dispositivo, quindi modifica il base URL se vuoi condividere i QR.

I PDF includono dati della transazione, QR, un campo `File Hash` e l'algoritmo SHA256. In `generate_pdf_bytes()` l'hash è calcolato sul JSON ordinato dei dati, **non sui byte del PDF**. L'estrazione degli ID dai certificati nel frontend non equivale a una verifica crittografica del documento.

Il recupero del certificato richiede sia una transazione consultabile sulla rete sia il QR registrato nel database locale.

## Struttura del progetto

| Percorso | Responsabilità |
| --- | --- |
| `main.py` | App FastAPI, pagine, autenticazione e endpoint filiera |
| `security.py` | Hash password e utility JWT |
| `utils.py` | Connessione MySQL, transazioni, QR, decodifica payload e PDF |
| `templates/` | Interfaccia HTML |
| `static/js/` | Login, wallet, firma, timeline e visualizzazione filiera |
| `static/js/CircularProtocolAPI.js` | SDK JavaScript incluso |
| `static/css/`, `static/vendor/` | Stili, immagini e librerie frontend |
| `docker-compose.yaml` | MySQL e phpMyAdmin |
| `smartfood.sql` | Dump dello schema e dei dati |
| `requirements.txt` | Dipendenze Python |
| `send_transaction.py` | Script standalone dimostrativo |
| `test.ipynb` | Notebook sperimentale |
| `relazione/` | Relazione PDF e figure |
| `certificate_*.pdf` | Esempi di certificati |

## Limiti dell'implementazione corrente

- **Configurazione:** rete, URL del frontend e URL dei QR sono fissati nel codice; la selezione della blockchain in `/tx/build` non viene applicata.
- **Database:** lo schema e gli INSERT di registrazione vanno allineati; gli indirizzi wallet vuoti sono soggetti al vincolo di unicità.
- **Consultazione:** il recupero della filiera segue gli antecedenti senza un insieme di ID già visitati o un limite esplicito. Il campo `children` viene inizializzato ma non popolato.
- **Timeline wallet:** il parametro `end` dell'API non viene rispettato dalla chiamata SDK, che usa `end=100`; non considerare la lista una cronologia completa.
- **Conferma transazioni:** invio alla rete e conferma sono fasi distinte. Il recupero dell'esito può attendere fino a 180 secondi e la generazione del PDF dipende dall'esito disponibile.
- **Logout:** il frontend rimuove il token locale; il backend cancella il cookie, senza implementare revoca dei JWT già emessi.
- **Script standalone:** `send_transaction.py` contiene una chiave privata incorporata e un refuso `hehlper.hexFix`. Non usare quella chiave; correggi il refuso e sostituisci la configurazione con credenziali di prova esterne prima di eseguire lo script.

## Distribuzione e sicurezza

Il progetto non è accompagnato da una verifica completa per la produzione. Prima di esporlo:

- Configura HTTPS, un'origine coerente, callback OAuth e URL dei QR raggiungibili.
- Usa segreti propri e rimuovi credenziali e token dagli esempi. Se la chiave privata inclusa è attiva, sostituiscila e considerala compromessa.
- Rimuovi i log che mostrano frammenti della chiave privata, token/cookie, hash password e altri dati sensibili; disabilita `/debug_cookies`.
- Limita CORS: la configurazione attuale usa tutte le origini con `allow_credentials=True`.
- Definisci i controlli di autorizzazione per i ruoli e la validazione di wallet, quantità, riferimenti e transazioni ricevute.
- Proteggi la gestione delle chiavi da codice frontend non fidato e rivedi le risorse CDN, la gestione JWT in `localStorage` e la protezione XSS/CSRF.
- Aggiungi persistenza MySQL, backup, health check, gestione degli errori e verifiche del flusso completo.
- Avvia Uvicorn senza `--reload` nell'ambiente di distribuzione.

## Risoluzione dei problemi

| Problema | Verifica |
| --- | --- |
| Connessione MySQL fallita | Stato del container, porta, utente autorizzato e variabili MYSQL |
| Tabelle mancanti | Database creato e dump/schema importato |
| Registrazione fallita | Vincoli di `public_key`, email e wallet nello schema |
| JWT non valido | Avvio con `--env-file .env`, segreto coerente e scadenza del token |
| Login perso dopo un redirect | Origine del browser: `localhost` e `127.0.0.1` hanno storage distinti |
| Chiave locale non trovata | Stesso browser/origine e indirizzo wallet normalizzato |
| Errore nella decifratura | Passphrase corretta e dati IndexedDB presenti |
| Transazione rifiutata | Rete, wallet, firma, nonce e risposta del gateway |
| QR non raggiungibile da telefono | Sostituisci il base URL localhost |
| PDF non disponibile | Transazione consultabile e record QR locale presente |

## Documentazione esterna

- [Circular SDK — API Python](https://circular-protocol.gitbook.io/circular-sdk/api-docs/python)
- [SDK Python Circular](https://github.com/circular-protocol/circular-py)

## Licenza e autore

Nel repository non è presente una licenza del progetto nella radice. Le librerie incluse mantengono le proprie licenze; chiarisci con l'autore le condizioni di riutilizzo del codice applicativo.

Autore: [Domenico Villari](https://github.com/DomenicoVillari3)

Repository: [DomenicoVillari3/security_project](https://github.com/DomenicoVillari3/security_project)

