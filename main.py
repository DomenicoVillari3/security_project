from fastapi import FastAPI,HTTPException,Query
from fastapi.responses import HTMLResponse,RedirectResponse,JSONResponse,StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from pydantic import BaseModel, EmailStr
from fastapi import FastAPI, Depends, HTTPException, status,Request
from dotenv import load_dotenv
import mysql.connector
from typing import Optional, List
import re
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from authlib.integrations.starlette_client import OAuth
import httpx
import os
from security import hash_password, verify_password, create_access_token, decode_JWT
from datetime import timedelta,datetime
from circular_protocol_api import CircularProtocolAPI  
from circular_protocol_api import nag_functions
from circular_protocol_api import helper
from fastapi.middleware.cors import CORSMiddleware
from utils import define_transaction,get_db_connection,define_qr_code,decode_from_hex,generate_pdf_bytes

load_dotenv()

#---- --------------------------Inizializzazione dell'applicazione FastAPI ----------------------------------------------------------------
# Crea l'app FastAPI
app = FastAPI()
# Servire file statici (CSS, JS, immagini)
app.mount("/static", StaticFiles(directory="static"), name="static")
# Configurazione template
templates = Jinja2Templates(directory="templates")
app.add_middleware(
    SessionMiddleware, 
    secret_key=os.getenv("SESSION_SECRET")
)
# Abilita tutte le origini durante lo sviluppo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#Middleware per disabilitare la cache
class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Imposta header per disabilitare cache
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response
app.add_middleware(NoCacheMiddleware)



# Configura OAuth
oauth = OAuth()
oauth.register(
    name='google',
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

BLOCKCHAIN = "0x8a20baa40c45dc5055aeb26197c203e576ef389d9acb171bd62da11dc5ad72b2"

#---------------------------------------MODELLI PER API CALLS--------------------------------------------------
# Modello per dati utente Google
class GoogleUser(BaseModel):
    email: str
    name: str
    picture: str = None
    google_id: str

#Dati inviati/ricevuti dal client
class UserCreate(BaseModel):
    nome: str
    email: EmailStr
    password: str
    ruolo: str
    wallet_address: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

#JSON Web Token
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class StepFiliera(BaseModel):
    batch_id: str
    type: str
    product: str
    quantity: int
    unit: str
    location: str
    timestamp: datetime
    parents: List[str] = []
    certification: Optional[str] = ""
    notes: Optional[str] = ""

class Transaction(BaseModel):
    BroadcastFee: float
    DeveloperFee: float
    From: str
    GasLimit: float
    ID: str
    Instructions: int
    NagFee: float
    NodeID: str
    Nonce: int
    OSignature: str
    Payload:StepFiliera 
    ProcessingFee: float
    ProtocolFee: float
    Status: str
    Timestamp: datetime
    To: str
    type_tr:str

#---- Modello per la risposta della transazione ----
class ReturnedTransaction(BaseModel):
    Result: int
    Response: dict
    Node: str

class SignedTx(BaseModel):
    signed_signature: str  # firma messa dall'user in locale
    unsigned_tx: dict  

class UnsignedTx(BaseModel):
    hashid: str
    unsigned_tx: dict

class WalletUpdateRequest(BaseModel):
    wallet_addr: str
    public_key: str




#-------------------------------------- Autenticazione e autorizzazione -------------------------------------------

# Dependency OAuth2: legge il token JWT dall'header Authorization: Bearer <token>
'''OAuth2PasswordBearer è una dependency di FastAPI che dice all’app:
    “Aspettati un token JWT nell’header Authorization: Bearer <token> per le richieste protette”.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")'''

# Funzione per ottenere l'utente corrente dal token JWT 
def get_current_user(request:Request):
    """Ottiene utente corrente da JWT token (header Authorization o cookie)
    -Args:
        request (Request): La richiesta HTTP corrente contenente il token JWT.
            
    -Returns:
        dict: Dati dell'utente corrente se il token è valido.
    """
    token = None
    
    # Prova prima dall'header Authorization
    authorization = request.headers.get("authorization")
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    # Se non trovato, prova dai cookie
    if not token:
        token = request.cookies.get("token")
    
    if not token:
        raise HTTPException(status_code=401, detail="Token non trovato")
    
    # Decodifica il token JWT
    payload = decode_JWT(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Token non valido o scaduto")
    
    email: str = payload.get("sub")
    if email is None:
        raise HTTPException(status_code=401, detail="Token non valido")
    
    # Connessione al DB e verifica utente
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT id, nome, ruolo, email, wallet_addr,public_key, data_creazione_wallet, google_id, profile_picture
        FROM user WHERE email=%s
    """, (email,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if not user:
        raise HTTPException(status_code=401, detail="Utente non trovato")
    
    return user



#-----------------------------------------------GET PAGINE-----------------------------------------------------
#INDEX
@app.get("/", response_class=HTMLResponse)
async def get_index(request: Request):
    """Index con controllo autenticazione. Se utente autenticato, reindirizza a /dashboard
    altrimenti a /login
    
    -Args:
        request (Request): La richiesta HTTP corrente.
            
    -Returns:
        RedirectResponse: Reindirizza a /dashboard se autenticato, altrimenti a /login.
    """
    try:
        # Prova a ottenere l'utente corrente
        user = get_current_user(request)
        if user:
            return RedirectResponse(url="/dashboard", status_code=302)
    except:
        # Se non autenticato o errore, vai al login
        pass
    
    return RedirectResponse(url="/login", status_code=302)
   

#PAGINA LOGIN, REGISTRAZIONE, DASHBOARD, FILIERA, STEP, PK MANAGER    
@app.get("/login", response_class=HTMLResponse)
def get_login():
    with open("templates/login.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/register", response_class=HTMLResponse)
def get_register():
    with open("templates/register.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/dashboard", response_class=HTMLResponse)
def get_dashboard():
    with open("templates/dashboard.html", "r", encoding="utf-8") as f:
        html_content = f.read()
        return HTMLResponse(content=html_content)

@app.get("/filiera", response_class=HTMLResponse)
def get_filiera():
    with open("templates/filiera.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())
    
@app.get("/step", response_class=HTMLResponse)
def get_step():
    with open("templates/step.html","r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())
    
@app.get("/insert_private_key",response_class=HTMLResponse)
def get_pk_manager():
    with open("templates/insert_private_key.html","r",encoding="utf-8") as f:
        return HTMLResponse(content=f.read())
    

#--------------------------------------API CALLS----------------------------------------------

@app.get("/auth/validate_token")
def validate_token(current_user: dict = Depends(get_current_user)):
    """
    Endpoint per validare se il token JWT è valido
    Returns:
        dict: {"valid": True} se il token è valido
    Raises:
        HTTPException: 401 se il token non è valido o scaduto
    """
    return {"valid": True, "user": current_user["email"]}


# Login con Google
@app.get("/auth/google/login")
async def google_login(request: Request):
    """Reindirizza a Google per l'autenticazione
    -Args:
        request (Request): La richiesta HTTP corrente.
            
    -Returns:
        RedirectResponse: Reindirizza a Google per l'autenticazione.
    """
    redirect_uri = request.url_for('google_callback')
    return await oauth.google.authorize_redirect(request, redirect_uri)

# Callback Google
@app.get("/auth/google/callback")
async def google_callback(request: Request,response_class=Token):
    '''Gestisce il callback da Google e crea/autentica l'utente.
    -Args:
        request (Request): La richiesta HTTP corrente contenente il token di accesso.
            
    -Returns:
        RedirectResponse: Reindirizza alla dashboard con il token JWT impostato come cookie.
        
    -Raises:
        HTTPException: Se non riesce a ottenere le informazioni utente da Google o se si verifica un errore durante l'autenticazione.'''
    

    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get('userinfo')
        
        if not user_info:
            raise HTTPException(status_code=400, detail="Impossibile ottenere informazioni utente da Google")
        
        # Cerca o crea utente nel database
        google_user = GoogleUser(
            email=user_info.get('email'),
            name=user_info.get('name'),
            picture=user_info.get('picture'),
            google_id=user_info.get('sub')
        )
        
        # Controlla se l'utente esiste già nel database
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("SELECT * FROM user WHERE email=%s", (google_user.email,))
        existing_user = cursor.fetchone()
        
        if not existing_user:
            # Crea nuovo utente
            cursor.execute("""
                INSERT INTO user (nome, email, ruolo, wallet_addr, google_id, profile_picture)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                google_user.name, 
                google_user.email, 
                "produttore",  # ruolo default
                "",  # wallet_addr vuoto per ora
                google_user.google_id,
                google_user.picture
            ))
            conn.commit()
            user_id = cursor.lastrowid
        else:
            user_id = existing_user['id']
            # Aggiorna informazioni Google se necessario
            cursor.execute("""
                UPDATE user SET google_id=%s, profile_picture=%s WHERE id=%s
            """, (google_user.google_id, google_user.picture, user_id))
            conn.commit()
        
        cursor.close()
        conn.close()
        
        # Crea JWT token per la sessione
        token_data = {"sub": google_user.email}
        token = create_access_token(token_data)
        
        html_content = f"""
        <html>
        <head>
        <script>
            localStorage.setItem("token", "{token}");
            window.location.href = "/dashboard";
        </script>
        </head>
        <body>
            Accesso eseguito, reindirizzamento...
        </body>
        </html>
        """
        return HTMLResponse(content=html_content)

        

        
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore durante l'autenticazione Google: {str(e)}")


#LOGOUT
@app.post("/auth/logout")
async def logout():
    """Logout dell'utente"""
    response = JSONResponse({"message": "Logout effettuato con successo"})
    response.delete_cookie(key="token")  # Solo se usi i cookie
    return response

# Registrazione
@app.post("/auth/register", response_model=Token)
def register(user: UserCreate):
    '''Registra un nuovo utente nel database e restituisce un token JWT.
    -Args:
        user (UserCreate): Dati dell'utente da registrare.
            
    -Returns:
        dict: Contiene il token di accesso e il tipo di token.
        
    -Raises:
        HTTPException: Se l'email è già registrata o se si verifica un errore durante l'inserimento nel database.'''
    
    #connessione al DB
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    #Controllo se l'email è già registrata
    cursor.execute("SELECT * FROM user WHERE email=%s", (user.email,))
    if cursor.fetchone():
        raise HTTPException(status_code=400, detail="Email già registrata")
    
    #Hash della password
    hashed_pw = hash_password(user.password)
    print(user.nome, user.email, hashed_pw, user.ruolo, user.wallet_address)
    #Inserimento nel database
    cursor.execute("""
        INSERT INTO user (nome, email, psswd, ruolo, wallet_addr)
        VALUES (%s, %s, %s, %s, %s)
    """, (user.nome, user.email, hashed_pw, user.ruolo, user.wallet_address))

    # Commit e chiusura della connessione
    db.commit()
    cursor.close()
    db.close()
    
    # Crea il token di accesso
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}



# Login
@app.post("/auth/login", response_model=Token)
def login(user: UserLogin):
    try:
        # Connessione al database
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT * FROM user WHERE email=%s", (user.email,))
        utente = cursor.fetchone()
        cursor.close()
        conn.close()

        if not utente or not verify_password(user.password, utente["psswd"]):
            raise HTTPException(status_code=400, detail="Credenziali non valide")
    except mysql.connector.Error as e:
        raise HTTPException(status_code=500, detail=f"Errore di database: {e}")

    token = create_access_token({"sub": utente["email"]})
    return {"access_token": token, "token_type": "bearer"}

# PAGINA "PROTETTA generica (TEST)"
@app.get("/profilo")
def profilo_corrente(current_user: dict = Depends(get_current_user)):
    '''Restituisce i dati dell'utente corrente.
    -Args:
        current_user (dict): Dati dell'utente corrente ottenuti dalla funzione get_current_user.
            
    -Returns:
        dict: Dati dell'utente corrente.
        
    -Raises:
        HTTPException: Se l'utente non è autenticato o se si verifica un errore durante il recupero dei dati.'''
    return {"utente": current_user}



#inserimento di un passo della filiera (PROTETTA) build
@app.post("/tx/build", response_model=UnsignedTx)
def build_step_filiera(payload: StepFiliera,blockchain: str = Query(...),current_user: dict = Depends(get_current_user)):
    ''' Costruisce la transazione per un passo della filiera, non firmata (verrà firmata in locale dall'utente che possiede la sua pk). 
    -Args:
        payload (StepFiliera): Dati del passo della filiera da inserire.
        blockchain (str): Identificatore della blockchain (es. "0x8a20baa40c45dc5055aeb26197c203e576ef389d9acb171bd62da11dc5ad72b2").
        current_user (dict): Dati dell'utente corrente ottenuti dalla funzione get_current_user.
            
    -Returns:
        dict: Contiene la transazione non firmata e l'hash ID.
        
    -Raises:
        HTTPException: Se l'utente non ha un wallet associato o se si verifica un errore durante la definizione della transazione.
    '''

   
    # Verifica se l'utente ha un wallet associato
    if not current_user.get("wallet_addr"):
        raise HTTPException(status_code=400, detail="Utente non ha un wallet associato")
    
    
    # Prepara i dati per la transazione
    sender =current_user.get("wallet_addr") 
    to = sender # If the particular transaction doesn't necessitate a recipient address, this field can be the same as the sender's address.

    payload_dict = payload.model_dump(mode="json") #Generate a dictionary representation of the model
    
    print("Payload:", payload_dict)
    
    #Returns the data not signed
    data,hashid=define_transaction(blockchain=BLOCKCHAIN,payload=payload_dict,sender=sender,to=to,privateKey=None)
    print(data)

    return {
        "unsigned_tx": data,
        "hashid":  hashid
    }


#inserimento di un passo della filiera (PROTETTA) firmata dall'utente
@app.post("/tx/submit",response_model=ReturnedTransaction)
def inserisci_step_filiera(signedTx: SignedTx, current_user: dict = Depends(get_current_user)):
    '''Inserisce un passo della filiera firmato dall'utente.
    -Args:
        signedTx (SignedTx): Transazione firmata dall'utente.
        current_user (dict): Dati dell'utente corrente ottenuti dalla funzione get_current_user.
            
    -Returns:
        dict: Risultato della transazione inviata.
        
    -Raises:
        HTTPException: Se l'indirizzo del mittente non corrisponde all'utente corrente o se si verifica un errore durante l'invio della transazione.'''
    
    circular=CircularProtocolAPI()
    
    data=signedTx.unsigned_tx
    data["Signature"]=signedTx.signed_signature
    #signature = helper.signMessage(data['ID'], privateKey)
    print(data)
    
    #check sender == to actual user 
    print(current_user.get("wallet_addr"),type(current_user.get("wallet_addr")))
    print("0x"+data["From"],type(data["From"]))
    if current_user.get("wallet_addr") != "0x"+data["From"]:
        raise HTTPException(status_code=403, detail="Address non autorizzato")
    # Invio della transazione
    result = helper.sendRequest(data, nag_functions._SEND_TRANSACTION, circular.getNAGURL())
    print(result)
    
    tx_id=result["Response"]["TxID"]
    #node_id=result["Node"]
    
    if not tx_id:
        raise HTTPException(status_code=500, detail="Errore durante l'invio della transazione")
    
    url = f"filiera/tx/{tx_id}"
    # Definisci il QR code associato alla transazione e slava nel DB
    img_base64 = define_qr_code(url, tx_id)
    
    return result

#Recupero di un passo della filiera (PUBBLICA)
@app.get("/filiera/view/{tx_id}", response_class=HTMLResponse)
def view_supply_chain_page(tx_id: str):
    """
    Restituisce la pagina HTML per visualizzare la filiera
    Questo è l'endpoint a cui punta il QR code
    -Args:
        tx_id (str): ID della transazione da visualizzare.
            
    -Returns:
        HTMLResponse: Contenuto HTML della pagina di visualizzazione della filiera.
        
    -Raises:
        HTTPException: Se il tx_id non è valido o se si verifica un errore durante la lettura del template.
    """
    try:
        #Lettura del template HTML
        with open("templates/filiera.html", "r", encoding="utf-8") as f:
            html_content = f.read()
        
        # Sostituisci il placeholder con l'ID della transazione
        html_content = html_content.replace("{{TX_ID}}", tx_id)
        html_content = html_content.replace("{{BLOCKCHAIN}}", BLOCKCHAIN)
    
        return HTMLResponse(content=html_content, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore durante la lettura del template: {str(e)}")

# Recupero di un passo della filiera tramite Txid
@app.get("/filiera/tx/{blockchain}/{tx_id}", response_model=ReturnedTransaction)
def get_step_filiera(tx_id: str, blockchain: str):
    """
    API per recuperare i dati di una singola transazione
    -Args:
        tx_id (str): ID della transazione da recuperare.
        blockchain (str): Identificatore della blockchain (es. "0x8a20baa40c45dc5055aeb26197c203e576ef389d9acb171bd62da11dc5ad72b2").
            
    -Returns:
        dict: Dati della transazione recuperata.
        
    -Raises:
        HTTPException: Se il tx_id o la blockchain non sono validi, o se la transazione non viene trovata.
    """
    print("TX",tx_id)
    print("BK",blockchain)

    # Pulisci i parametri
    blockchain_clean = blockchain.replace("0x", "")
    tx_id_clean = tx_id.replace("0x", "")


    circular = CircularProtocolAPI()
    try:
        # getTransactionOutcome fa già il polling automaticamente
        outcome = circular.getTransactionOutcome(
            blockchain, 
            tx_id, 
            180,
            intervalSec=20  # Controlla ogni 20 secondi
        )
        
        if outcome["Result"] == 200:
            status = outcome["Response"]["Status"]
            
            if status == "Executed":
                print(f"✅ Transazione {tx_id} completata con successo!")
                print(outcome)
                return outcome
            elif status == "Failed":
                raise Exception(f"❌ Transazione {tx_id} fallita")
            else:
                print(f"⏳ Transazione {tx_id} in stato: {status}")
                return outcome
        else:
            raise Exception(f"❌ Errore API: {outcome}")
            
    except Exception as e:
        print(f"❌ Errore nel polling: {e}")
        raise

#ritorno l'intera catena di transazioni collegata a un tx_id
@app.get("/api/filiera/chain/{tx_id}")
def get_complete_chain(tx_id: str, blockchain: str = Query(default=BLOCKCHAIN)):
    """
    Recupera l'intera catena di transazioni collegata a un tx_id
    -Args:
        tx_id (str): ID della transazione principale da cui partire.        
        blockchain (str): Identificatore della blockchain (es. "0x8a20baa40c45dc5055aeb26197c203e576ef389d9acb171bd62da11dc5ad72b2").   

    -Returns:
        dict: Dati della catena di transazioni, inclusa la transazione principale, i genitori e i figli.
        
    -Raises:
        HTTPException: Se il tx_id non è valido, se la transazione principale non viene trovata o se si verifica un errore durante la decodifica del payload.   
    """
    circular = CircularProtocolAPI()
    
    # Recupera la transazione principale
    main_tx = circular.getTransactionByID(blockchain, tx_id, "0", "2")
    if not main_tx:
        raise HTTPException(status_code=404, detail="Transazione non trovata")
    
    chain_data = {
        "current_transaction": main_tx,
        "parents": [],
        "children": [],
        "supply_chain_timeline": []
    }
    
    # Decodifica il payload per ottenere i dati strutturati
    try:
        if "Payload" in main_tx.get("Response", {}):
            payload_hex = main_tx["Response"]["Payload"]
            
            payload_json=decode_from_hex(parent_payload_hex)
            
            chain_data["current_transaction"]["Response"]["DecodedPayload"] = payload_json
            
            # Recupera transazioni parent se specificate
            if "parents" in payload_json and payload_json["parents"]:
                
                for parent_id in payload_json["parents"]:
                    #recupoero transazione
                    parent_tx = circular.getTransactionByID(blockchain, parent_id, "0", "2")
                    if parent_tx:
                        # Decodifica anche il payload del parent
                        try:
                            parent_payload_hex = parent_tx["Response"]["Payload"]
                            parent_payload_json=decode_from_hex(parent_payload_hex)
                            parent_tx["Response"]["DecodedPayload"] = parent_payload_json
                        except:
                            pass
                        chain_data["parents"].append(parent_tx)
    
    except Exception as e:
        print(f"Errore nella decodifica del payload: {e}")
    
    # Crea timeline ordinata per timestamp
    all_transactions = [main_tx] + chain_data["parents"]
    timeline = []
    
    for tx in all_transactions:
        try:
            decoded_payload = tx["Response"].get("DecodedPayload", {})
            timeline_item = {
                "tx_id": tx["Response"]["ID"],
                "timestamp": decoded_payload.get("timestamp", tx["Response"].get("Timestamp", "")),
                "type": decoded_payload.get("type", "Unknown"),
                "product": decoded_payload.get("product", "Unknown"),
                "location": decoded_payload.get("location", "Unknown"),
                "quantity": decoded_payload.get("quantity", 0),
                "unit": decoded_payload.get("unit", ""),
                "certification": decoded_payload.get("certification", ""),
                "notes": decoded_payload.get("notes", "")
            }
            timeline.append(timeline_item)
        except:
            continue
    
    # Ordina per timestamp
    timeline.sort(key=lambda x: x["timestamp"])
    chain_data["supply_chain_timeline"] = timeline
    
    return chain_data


# Recupera il QR code associato a una transazione
@app.get("/api/qrcode/{tx_id}")
def get_qr_code(tx_id: str):
    """
    Recupera il QR code salvato per una transazione
    -Args:  
        tx_id (str): ID della transazione per cui recuperare il QR code.    
    -Returns:
        dict: Contiene l'immagine del QR code in formato Base64 e l'URL associato.  
    """
    if not tx_id.startswith("0x"):
        tx_id="0x"+tx_id

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("SELECT * FROM transaction_qrcode WHERE tx_id=%s", (tx_id,))
    result = cursor.fetchone()
    print(result)
    
    cursor.close()
    conn.close()
    
    if not result:
        print("ERRORE QRCODE---> SELECT * FROM transaction_qrcode WHERE tx_id=%s", (tx_id,))
        raise HTTPException(status_code=404, detail="QR Code non trovato")
    
    return {
        "qr_code": result["qrcode_img"],
        "qr_url": result.get("qr_url", "")
    }

#Update del wallet address dell'utente
@app.post("/user/update_wallet")
def update_wallet_address(
    data: WalletUpdateRequest,
    current_user: dict = Depends(get_current_user)):    
    """
    Aggiorna l'indirizzo del wallet dell'utente corrente
    -Args:
        data (WalletUpdateRequest): Dati del wallet da aggiornare.
        current_user (dict): Dati dell'utente corrente ottenuti dalla funzione get_current_user.
        
    -Returns:
        dict: Messaggio di successo con il nuovo indirizzo del wallet.
        
    -Raises:
        HTTPException: Se l'indirizzo del wallet non è valido o se si verifica un errore durante l'aggiornamento nel database.
    """
    
    
    wallet_address = str(data.wallet_addr)
    public_key = str(data.public_key)
    print("Wallet address:", wallet_address, "Public Key:", public_key,str(current_user["email"]),type(wallet_address))
    print(len(wallet_address),len(public_key))

   
    # Aggiornamento DB come prima
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            UPDATE user SET wallet_addr=%s, public_key=%s WHERE email=%s
        """, (wallet_address, public_key, current_user["email"]))
        conn.commit()
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"Errore durante l'aggiornamento del wallet: {err}")
    finally:
        cursor.close()
        conn.close()
    
    # Aggiorna dati utente
    current_user["wallet_addr"] = wallet_address
    current_user["public_key"] = public_key
    
    return {"wallet_addr": wallet_address, "public_key": public_key}


@app.get("/debug_cookies")
async def debug_cookies(request: Request):
    print("Cookies ricevuti dal client:", request.cookies)
    return {"cookies": dict(request.cookies)}


@app.get("/certificate/{blockchain}/{tx_id}")
def download_pdf_endpoint(blockchain:str,tx_id: str):
   
   
        if not tx_id.startswith("0x"):
            tx_id="0x"+tx_id
        if not blockchain.startswith("0x"):
            blockchain="0x"+blockchain

        print("GET STEPS FILIERA")
        # Recupera i dati della transazione dalla blockchain
        step=get_step_filiera(tx_id,blockchain)
        
        if not step:
            raise HTTPException(status_code=404, detail="Transazione non trovata")
        
        # Estrai solo i campi necessari
        data = {
            "ID": step["Response"]["ID"],
            "BlockID":step["Response"]["BlockID"],
            "From": step["Response"]["From"],
            "To": step["Response"]["To"],
            "NodeID": step["Response"]["NodeID"],
            "Timestamp": step["Response"]["Timestamp"],
            "Type": step["Response"]["Type"],
            "Status": step["Response"]["Status"],
            "Payload":step["Response"]["Payload"],
            "OSignature":step["Response"]["OSignature"]
        }
        print("DATA ", data)
        print("data['ID']",data["ID"])

        qr_code=get_qr_code(data["ID"])
        qr_code_img = qr_code["qr_code"]
        qr_code_url = qr_code["qr_url"]
    

        pdf_file = generate_pdf_bytes(data,qr=qr_code_img, filename=f"certificate_{data['ID']}.pdf")
       
        headers = {
            'Content-Disposition': f'attachment; filename="certificate_{tx_id}.pdf"'
        }
        
        return StreamingResponse(pdf_file, media_type="application/pdf", headers=headers)
    
    
