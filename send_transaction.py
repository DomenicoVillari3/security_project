from circular_protocol_api import CircularProtocolAPI
from circular_protocol_api import helper
from circular_protocol_api import nag_functions
import json

circular = CircularProtocolAPI()

blockchain = "0x8a20baa40c45dc5055aeb26197c203e576ef389d9acb171bd62da11dc5ad72b2"
sender ="0xa6c39da22421e9a08f08f8030dc6c40221df0cf815cd844ec217f56980a532f5" 
to = sender # If the particular transaction doesn't necessitate a recipient address, this field can be the same as the sender's address.
privateKey = "0x136ddea8d5b1b5ee3ba3cc013831b71a7dc20ca1b11f3635795f07603ff611a6"

# --- 1. Dati del lotto (JSON) ---
payload = {
    "batch_id": "LOTTO-2025-08-001",
    "type": "raccolta",
    "product": "Latte crudo DOP",
    "quantity": 480,
    "unit": "litri",
    "location": "Parma",
    "timestamp": "2025-08-11T10:05:00Z",
    "parents": ["PARENT-LOTT12", "PARENT-LOTT34"],  # IDs lotti predecessori
    "certification": "DOP",
    "notes": "Raccolta mattutina, temperatura 4°C"
}

timestamp = helper.getFormattedTimestamp()
blockchain = helper.hexFix(blockchain)
nonce = int(circular.getWalletNonce(blockchain, sender)["Response"]["Nonce"]) + 1
payload = helper.hexFix(json.dumps(payload).encode().hex())
privateKey = hehlper.hexFix(privateKey)
sender = helper.hexFix(sender)
to = helper.hexFix(to)
ID = str(blockchain + sender + to + payload + str(nonce) + timestamp)

hashID = helper.sha256(ID)
signature = helper.signMessage(hashID, privateKey)
transactionType = "C_TYPE_CERTIFICATE"

'''C_TYPE_CERTIFICATE
Descrizione: Una transazione dove il payload è una stringa generica, tipicamente hashata, e non richiede elaborazione aggiuntiva né è rappresentata da un token.

Uso ideale: Per certificare un evento, uno step o un documento nella filiera senza bisogno di smart contract o asset tokenizzati.

Funziona così: Invii un payload (tipicamente la hash dei dati in JSON, oppure direttamente la stringa, se molto compatta), indicando i riferimenti parent (ID dei lotti precedenti se serve), timestamp, wallet dell’attore.

Vantaggi: È leggera, semplice e pensata proprio per le certificazioni nella supply chain, tracciabilità e attestazioni di processo che non hanno un valore token o asset diretto.'''

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
print(data)

result = helper.sendRequest(data, nag_functions._SEND_TRANSACTION, circular.getNAGURL())