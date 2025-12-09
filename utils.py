from circular_protocol_api import CircularProtocolAPI
from circular_protocol_api import helper
import json
import qrcode
from dotenv import load_dotenv
import os
import mysql.connector
from io import BytesIO 
import base64
import fpdf 
import tempfile
import hashlib

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
    
    print("sender:", sender)
    print("blockchain:", blockchain)
    timestamp = helper.getFormattedTimestamp()
    blockchain = helper.hexFix(blockchain)
    print(circular.getWalletNonce(blockchain, sender))
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

def define_qr_code(url, tx_id,base_url="http://localhost:8000",save=True):
    '''Funzione per generare un QR code da un URL e salvarlo in base64 su db e su file system.(opzionale)
    Args:
        url (str): L'URL da codificare nel QR code.
        tx_id (str): L'ID della transazione, usato per il nome del file.
        save (bool): Se True, salva l'immagine in una cartella specifica.
    
    Returns:
        str: Il QR code in formato base64.
    '''
    if not tx_id.startswith("0x"):
        tx_id="0x"+tx_id

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
            INSERT INTO transaction_qrcode (tx_id, qrcode_img,qr_url)
            VALUES (%s, %s,%s)
        """, (tx_id, img_base64,url))
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


#-- PDF generation----

class PDFCertificate(fpdf.FPDF):
    def header(self):
        # Header con titolo centrato
        self.set_font("Arial", 'B', 16)
        self.cell(0, 15, "Certificate Details", border=0, ln=True, align="C")
        self.ln(20)

    def footer(self):
        # Footer con numero pagina centrato
        self.set_y(-15)
        self.set_font("Arial", 'I', 8)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")

def generate_pdf_bytes(data,qr=None, filename="certificate.pdf"):
    pdf = PDFCertificate()
    pdf.add_page()
    pdf.set_font("Arial", size=11)

    # Inserisci QR code se presente, allineato a destra
    if qr:
        # Crea un file temporaneo per il QR code
        with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as tmp:
            tmp.write(base64.b64decode(qr))
            tmp_path = tmp.name
        
        try:
            pdf.image(tmp_path, x=90, y=25, w=30)
        finally:
            # Rimuovi il file temporaneo
            os.unlink(tmp_path)
    
    # Spazio iniziale
    pdf.ln(20)

    data_str = json.dumps(data, sort_keys=True)
    file_hash = hashlib.sha256(data_str.encode('utf-8')).hexdigest()
    data['File Hash'] = file_hash
    data['Hash Algorithm'] = 'SHA256'

    # Mostra i dati in formato tabellare - due colonne (Chiave e Valore)
    line_height = pdf.font_size * 2
    col_width_key = 50
    col_width_val = 130



    for key, value in data.items():
        pdf.set_font(family='Arial', style='B')  # Corretto: family è obbligatorio
        pdf.cell(col_width_key, line_height, f"{key}:", border=0)
        pdf.set_font(family='Arial', style='')   # Corretto: family è obbligatorio
        pdf.multi_cell(col_width_val, line_height, str(value))
        pdf.ln(1)
   
    
    # Salva in memoria senza creare file su disco
    pdf_output = pdf.output(dest='S').encode('latin1')
    pdf_bytes = BytesIO(pdf_output)
    pdf_bytes.seek(0)
    return pdf_bytes


def extract_specific_fields(text):
    """
    Usa regex specifici per ogni campo
    """
    fields = {}
    
    # Pattern per ogni campo
    patterns = {
        'ID': r'ID:\s*([a-f0-9\s]+?)(?=\s*BlockID:|$)',
        'BlockID': r'BlockID:\s*(\d+)',
        'From': r'From:\s*([a-f0-9\s]+?)(?=\s*To:|$)',
        'To': r'To:\s*([a-f0-9\s]+?)(?=\s*NodeID:|$)',
        'NodeID': r'NodeID:\s*([a-f0-9\s]+?)(?=\s*Timestamp:|$)',
        'Timestamp': r'Timestamp:\s*([\d:\-]+)',
        'Type': r'Type:\s*([A-Z_]+)',
        'Status': r'Status:\s*(\w+)',
        'Payload': r'Payload:\s*([a-f0-9\s]+?)(?=\s*OSignature:|$)',
        'OSignature': r'OSignature:\s*([a-f0-9\s]+?)(?=\s*Page|$)'
    }
    
    # Rimuovi \n per semplificare il matching
    clean_text = text.replace('\n', ' ')
    
    for field, pattern in patterns.items():
        match = re.search(pattern, clean_text, re.IGNORECASE)
        if match:
            # Rimuovi spazi extra
            value = re.sub(r'\s+', '', match.group(1)) if field != 'Timestamp' else match.group(1)
            fields[field] = value
    
    return fields
