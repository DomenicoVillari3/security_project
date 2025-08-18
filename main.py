from fastapi import FastAPI,HTTPException,Query
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from pydantic import BaseModel, EmailStr
from fastapi import FastAPI, Depends, HTTPException, status
from dotenv import load_dotenv
import os
import mysql.connector
from typing import Optional, List
import re
import json


from security import hash_password, verify_password, create_access_token, decode_JWT
from datetime import timedelta,datetime

from circular_protocol_api import CircularProtocolAPI  
from circular_protocol_api import nag_functions
from circular_protocol_api import helper

from fastapi.middleware.cors import CORSMiddleware

from utils import define_transaction,get_db_connection,define_qr_code,decode_from_hex




BLOCKCHAIN = "0x8a20baa40c45dc5055aeb26197c203e576ef389d9acb171bd62da11dc5ad72b2"


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



#-- Autenticazione e autorizzazione ----
# Dependency OAuth2: legge il token JWT dall'header Authorization: Bearer <token>
'''OAuth2PasswordBearer è una dependency di FastAPI che dice all’app:
    “Aspettati un token JWT nell’header Authorization: Bearer <token> per le richieste protette”.'''
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
def get_current_user(token: str = Depends(oauth2_scheme)):
    
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
    cursor.execute("SELECT id, nome, ruolo, email, wallet_addr, data_creazione_wallet " \
                    "FROM user WHERE email=%s", (email,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if not user or not user.get("attivo", True):
        raise HTTPException(status_code=401, detail="Utente non trovato o inattivo")

    return user  # Restituisce il dizionario con i dati utente




#---- Inizializzazione dell'applicazione FastAPI ----
app = FastAPI()

# Servire file statici (CSS, JS, immagini)
app.mount("/static", StaticFiles(directory="static"), name="static")
# Configurazione template
templates = Jinja2Templates(directory="templates")


# Abilita tutte le origini durante lo sviluppo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Usa "*" per sviluppo locale, restringi in produzione!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
#------GET PAGINE------
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
    

#------API CALLS------

# Registrazione
@app.post("/auth/register", response_model=Token)
def register(user: UserCreate):
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
    return {"utente": current_user}
'''curl -X 'GET' \
  'http://127.0.0.1:8000/profilo' \
  -H 'accept: application/json'\
   -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtaW1tbzJAZ21haWwuY29tIiwiZXhwIjoxNzU1MDAxNjMzfQ.XtaY76b8ahKqbP36ZUlkFoxKLTnIZ7tD4XWPaXeyZzo" 
   >{"utente":{"id":3,"nome":"string","ruolo":"produttore","email":"mimmo2@gmail.com","wallet_addr":"string","data_creazione_wallet":"2025-08-12T11:30:50"}}'''



#inserimento di un passo della filiera (PROTETTA)
@app.post("/filiera/add_step", response_model=ReturnedTransaction)
def inserisci_step_filiera(payload: StepFiliera,blockchain: str = Query(...),current_user: dict = Depends(get_current_user)):
    circular = CircularProtocolAPI()

    # Verifica se l'utente ha un wallet associato
    if not current_user.get("wallet_addr"):
        raise HTTPException(status_code=400, detail="Utente non ha un wallet associato")
    
    
    # Prepara i dati per la transazione
    sender =current_user.get("wallet_addr") 

    #sender='0xa6c39da22421e9a08f08f8030dc6c40221df0cf815cd844ec217f56980a532f5'
    to = sender # If the particular transaction doesn't necessitate a recipient address, this field can be the same as the sender's address.
    privateKey = "0x136ddea8d5b1b5ee3ba3cc013831b71a7dc20ca1b11f3635795f07603ff611a6" #DA SQL 

    payload_dict = payload.model_dump(mode="json") #Generate a dictionary representation of the model
    data=define_transaction(blockchain=BLOCKCHAIN,payload=payload_dict,sender=sender,to=to,privateKey=privateKey)
    print(data)


    result = helper.sendRequest(data, nag_functions._SEND_TRANSACTION, circular.getNAGURL())

    tx_id=result["Response"]["TxID"]
    if not tx_id:
        raise HTTPException(status_code=500, detail="Errore durante l'invio della transazione")
    
    url = f"filiera/tx/{tx_id}"
    img_base64 = define_qr_code(url, tx_id)
    
    

    return result

#---- Recupero di un passo della filiera (PUBBLICA) ----

# ====== NUOVI ENDPOINTS PER LA VISUALIZZAZIONE ======

#RITORNA PAGINA HTML CON TRANSAZIONE
@app.get("/filiera/view/{tx_id}", response_class=HTMLResponse)
def view_supply_chain_page(tx_id: str):
    """
    Restituisce la pagina HTML per visualizzare la filiera
    Questo è l'endpoint a cui punta il QR code
    """
    with open("templates/filiera.html", "r", encoding="utf-8") as f:
        html_content = f.read()
    
    # Sostituisci il placeholder con l'ID della transazione
    html_content = html_content.replace("{{TX_ID}}", tx_id)
    html_content = html_content.replace("{{BLOCKCHAIN}}", BLOCKCHAIN)
    
    return HTMLResponse(content=html_content, status_code=200)

#RITORNA TRANSAZIONE BY ID 
@app.get("/api/filiera/tx/{blockchain}/{tx_id}", response_model=ReturnedTransaction)
def get_step_filiera(tx_id: str, blockchain: str):
    """
    API per recuperare i dati di una singola transazione
    """
    # Validazione input
    if not re.match(r'^[a-fA-F0-9]+$', tx_id):
        raise HTTPException(status_code=400, detail="Transaction ID non valido")
    
    if not re.match(r'^0x[a-fA-F0-9]+$', blockchain):
        raise HTTPException(status_code=400, detail="Blockchain ID non valido")
    
    circular = CircularProtocolAPI()
    res = circular.getTransactionByID(blockchain, tx_id, "0", "2")
    
    if not res:
        raise HTTPException(status_code=404, detail="Transazione non trovata")
    
    return res

#RITORNA LA CHAIN COMPLETA 
@app.get("/api/filiera/chain/{tx_id}")
def get_complete_chain(tx_id: str, blockchain: str = Query(default=BLOCKCHAIN)):
    """
    Recupera l'intera catena di transazioni collegata a un tx_id
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

@app.get("/api/qrcode/{tx_id}")
def get_qr_code(tx_id: str):
    """
    Recupera il QR code salvato per una transazione
    """
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("SELECT qrcode_img, qr_url FROM transaction_qrcode WHERE tx_id=%s", (tx_id,))
    result = cursor.fetchone()
    
    cursor.close()
    conn.close()
    
    if not result:
        raise HTTPException(status_code=404, detail="QR Code non trovato")
    
    return {
        "qr_code": result["qrcode_img"],
        "qr_url": result.get("qr_url", "")
    }