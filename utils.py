from circular_protocol_api import CircularProtocolAPI
from circular_protocol_api import helper
import json

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
    signature = helper.signMessage(hashID, privateKey)
    transactionType = "C_TYPE_CERTIFICATE"


    data = {
    'ID': hashID,
    'From': sender,
    'To': to,
    'Timestamp': timestamp,
    'Type': transactionType,
    'Payload': payload,
    'Nonce': f"{nonce}",
    'Signature': signature,
    'Blockchain': blockchain,
    'Version': circular.getVersion()
    }


    '''C_TYPE_CERTIFICATE
    Descrizione: Una transazione dove il payload è una stringa generica, tipicamente hashata, e non richiede elaborazione aggiuntiva né è rappresentata da un token.

    Uso ideale: Per certificare un evento, uno step o un documento nella filiera senza bisogno di smart contract o asset tokenizzati.

    Funziona così: Invii un payload (tipicamente la hash dei dati in JSON, oppure direttamente la stringa, se molto compatta), indicando i riferimenti parent (ID dei lotti precedenti se serve), timestamp, wallet dell’attore.

    Vantaggi: È leggera, semplice e pensata proprio per le certificazioni nella supply chain, tracciabilità e attestazioni di processo che non hanno un valore token o asset diretto.'''

    return data    