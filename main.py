from fastapi import FastAPI,HTTPException,Query
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from pydantic import BaseModel, EmailStr
from fastapi import FastAPI, Depends, HTTPException, status
from dotenv import load_dotenv
import os
import mysql.connector
from typing import Optional, List


from security import hash_password, verify_password, create_access_token, decode_JWT
from datetime import timedelta,datetime

from circular_protocol_api import CircularProtocolAPI  
from circular_protocol_api import nag_functions
from circular_protocol_api import helper

from fastapi.middleware.cors import CORSMiddleware

from utils import define_transaction




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



#----Database----
load_dotenv()

def get_db_connection():
    connection = mysql.connector.connect(
        host=os.getenv("MYSQL_HOST"),
        port=int(os.getenv("MYSQL_PORT", 3306)),
        user=os.getenv("MYSQL_USER"),
        password=os.getenv("MYSQL_PASSWORD"),
        database=os.getenv("MYSQL_DATABASE")
    )
    return connection

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

# Abilita tutte le origini durante lo sviluppo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Usa "*" per sviluppo locale, restringi in produzione!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
@app.post("/filiera/add_step", response_model=ReturnedTransaction,)
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
    return result
    








        