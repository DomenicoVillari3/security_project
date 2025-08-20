from circular_protocol_api import CircularProtocolAPI
from circular_protocol_api import helper
import json
import qrcode
from dotenv import load_dotenv
import os
import mysql.connector
from io import BytesIO 
import base64

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

def define_transaction(blockchain,payload,sender,to,privateKey):
    circular=CircularProtocolAPI()

    # --- 1. Dati del lotto (JSON) ---
    

    timestamp = helper.getFormattedTimestamp()
    blockchain = helper.hexFix(blockchain)
    nonce = int(circular.getWalletNonce(blockchain, sender)["Response"]["Nonce"]) + 1
    payload = helper.hexFix(json.dumps(payload).encode().hex())
    privateKey = helper.hexFix(privateKey)
    sender = helper.hexFix(sender)
    to = helper.hexFix(to)
    ID = str(blockchain + sender + to + payload + str(nonce) + timestamp)

    hashID = helper.sha256(ID)
    #signature = helper.signMessage(hashID, privateKey)
    transactionType = "C_TYPE_CERTIFICATE"


    data = {
    'ID': hashID,
    'From': sender,
    'To': to,
    'Timestamp': timestamp,
    'Type': transactionType,
    'Payload': payload,
    'Nonce': f"{nonce}",
    'Signature': None,
    'Blockchain': blockchain,
    'Version': circular.getVersion()
    }


    '''C_TYPE_CERTIFICATE
    Descrizione: Una transazione dove il payload è una stringa generica, tipicamente hashata, e non richiede elaborazione aggiuntiva né è rappresentata da un token.

    Uso ideale: Per certificare un evento, uno step o un documento nella filiera senza bisogno di smart contract o asset tokenizzati.

    Funziona così: Invii un payload (tipicamente la hash dei dati in JSON, oppure direttamente la stringa, se molto compatta), indicando i riferimenti parent (ID dei lotti precedenti se serve), timestamp, wallet dell’attore.

    Vantaggi: È leggera, semplice e pensata proprio per le certificazioni nella supply chain, tracciabilità e attestazioni di processo che non hanno un valore token o asset diretto.'''

    return data,hashID    

def define_qr_code(url, tx_id,base_url="https://localhost:8000",save=True):
    '''Funzione per generare un QR code da un URL e salvarlo in base64 su db e su file system.(opzionale)
    Args:
        url (str): L'URL da codificare nel QR code.
        tx_id (str): L'ID della transazione, usato per il nome del file.
        save (bool): Se True, salva l'immagine in una cartella specifica.
    
    Returns:
        str: Il QR code in formato base64.
    '''
    url = f"{base_url}/filiera/view/{tx_id}"

    # Crea il QR code
    img = qrcode.make(url)

    # Convert the QR code image to a byte array
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    img_bytes = buffer.getvalue()
    # Code in base64
    img_base64 = base64.b64encode(img_bytes).decode("utf-8")

    if save:
        # Salva l'immagine in una cartella specifica
        qr_dir = "qrcodes"
        os.makedirs(qr_dir, exist_ok=True)  # crea la cartella se non esiste
        file_path = os.path.join(qr_dir, f"{tx_id}.png")

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute("""
            INSERT INTO transaction_qrcode (tx_id, qrcode_img)
            VALUES (%s, %s)
        """, (tx_id, img_base64))
        db.commit()
        cursor.close()
        db.close()
    except mysql.connector.Error as err:
        print(f"Errore durante l'inserimento del QR code: {err}")
        cursor.close()
        db.close()
        return None
    
    
    return img_base64 

def decode_from_hex(hex_data):
    # Rimuovi prefisso 0x se presente
        if hex_data.startswith("0x"):
            hex_data =hex_data[2:]
        
        # Decodifica da hex
        bytes_data= bytes.fromhex(hex_data)
        json_data = json.loads(bytes_data.decode('utf-8'))

        return json_data

