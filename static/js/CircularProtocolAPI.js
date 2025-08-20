/******************************************************************************* 

        CIRCULAR LAYER 1 BLOCKCHAIN PROTOCOL INTERFACE LIBRARY
        License : Open Source for private and commercial use
                     
        CIRCULAR GLOBAL LEDGERS, INC. - USA
        
                     
        Version : 1.0.8
                     
        Creation: 7/12/2022
        Update  : 28/01/2025
        
        Originator: Gianluca De Novi, PhD
        Contributors: Danny De Novi           
        
*******************************************************************************/

/*
 *   Circular Class 
 */
var CircularProtocolAPI = (function(){
 

// Support Node Software Version 
const Version = '1.0.8';

// Library Errors Variable  
var LastError;

/*
 *  Retrieves the Library Error
 */
function GetError(){  return LastError; }



/* HELPER FUNCTIONS ***********************************************************/


/* 
 * Function to add a leading zero to numbers less than 10
 * num : number to pad
 * 
 */

function padNumber(num) {
    return num.toString().padStart(2, '0');
}




/* 
 *  Generate Timestamp formated
 *  YYYY:MM:DD-hh:mm:ss
 */
function getFormattedTimestamp() {
    let date = new Date(); 
    return `${date.getUTCFullYear()}:${padNumber(date.getUTCMonth() + 1)}:${padNumber(date.getUTCDate())}-${padNumber(date.getUTCHours())}:${padNumber(date.getUTCMinutes())}:${padNumber(date.getUTCSeconds())}`;
}


    
/* 
 *  Sign a message using secp256k1
 *  message: Message to sign
 *  provateKey: Private key in hex format (minus '0x')
 */      
function signMessage(message, privateKey) {
    const EC = elliptic.ec;
    const ec = new EC('secp256k1');
    const key = ec.keyFromPrivate(hexFix(privateKey), 'hex');
    const msgHash = sha256(message);

    // The signature is a DER-encoded hex string
    const signature = key.sign(msgHash).toDER('hex');
    return signature;
}    





/*
 *   Verify Message Signature
 */
function verifySignature(publicKey, message, signature) {
    const EC = elliptic.ec;
    const ec = new EC('secp256k1');
    const key = ec.keyFromPublic(publicKey, 'hex');
    const msgHash = sha256(message);

    return key.verify(msgHash, signature, 'hex');
}



 

/*
 *   Returns a public key from a private key
 */
function getPublicKey(privateKey) {
    const EC = elliptic.ec;
    const ec = new EC('secp256k1');
    const key = ec.keyFromPrivate(privateKey, 'hex');
    const publicKey = key.getPublic('hex');
  
    return publicKey;
}




/*
 *  Convert a string in its hexadecimal representation without '0x'
 */
function stringToHex(str) {
    let hexString = '';
    for (let i = 0; i < str.length; i++) {
        const hex = str.charCodeAt(i).toString(16);
        hexString += ('00' + hex).slice(-2);
    }
    return hexString;
}



/*
 *  Converts a hexadecimal string in a regulare string 
 */
function hexToString(hex) {
    let str = '';
    hex = hexFix(hex);
    for (let i = 0; i < hex.length; i += 2) {
        const code = parseInt(hex.substr(i, 2), 16);
        if (!isNaN(code) && code !== 0) {
            str += String.fromCharCode(code);
        }
    }
    return str;
}




/*
 *
 *  removes '0x' from hexadecimal numbers if the have it
 * 
 */
function hexFix(word) {
    if (typeof word === 'string') {
        if (word.startsWith('0x')) { 
            return word.slice(2); 
        }
        return word;
    }
    return '';
}
 
 




 
 
/* NAG FUNCTIONS **************************************************************/


// Application NAG Key
var NAG_KEY='';

// Default NAG Link 
var NAG_URL='https://nag.circularlabs.io/NAG.php?cep=';

var NETWORK_NODE='';

/*
 *  Sets the Application NAG Key
 */
function setNAGKey(NAGKey) {
    NAG_KEY = NAGKey;
}

function getNAGKey() {
    return NAG_KEY;
}

/*
 *  Sets the Network Access Gateway (NAG) URL 
 *  If not used, the default URL is selected 
 */
function setNAGURL(NURL) {
    NAG_URL = NURL;
}

function getNAGURL() {
    return NAG_URL;
}

function getVersion() {
    return Version;
}

/*
 *  Sets the Network Access Gateway (NAG) URL 
 *  If not used, the default URL is selected 
 */
function setNode(address) {
    if(address!='')  NETWORK_NODE = 'node=' + address;
    else             NETWORK_NODE=''; 
}




/* Smart Contracts ************************************************************/

/*
 *   Test the execution of a smart contract project
 *   
 *   Blockchain: Blockchain where the smart contract will be tested
 *   From: Developer's wallet address
 *   Project: Hyper Code Lighe Smart Contract Project
 */
async function testContract(blockchain, from, project) {
    const data = {
        "Blockchain": hexFix(blockchain),
        "From": hexFix(from),
        "Timestamp": getFormattedTimestamp(),
        "Project": stringToHex(project),
        "Version": Version
    };

    try {
        const response = await fetch(NAG_URL + 'Circular_TestContract_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error({"Result": 500, "Response": "Error: " + error.message});
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}



/*
 *  Local Smart Contract Call
 *  
 *  Blockchain: Blockchain where the Smart Contract is deployed
 *  From: Caller wallet Address
 *  Address: Smart Contract Address
 *  Request: Smart Contract Local endpoint
 */
async function callContract(blockchain, from, address, request) {
    let data = {
        "Blockchain": hexFix(blockchain),
        "From": hexFix(from),
        "Address": hexFix(address), 
        "Request": stringToHex(request), 
        "Timestamp": getFormattedTimestamp(),
        "Version": Version
    };
    
    try {
        const response = await fetch(NAG_URL + 'Circular_CallContract_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error({"Result": 500, "Response": "Error: " + error.message});
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}



/* WALLET FUNCTIONS  **********************************************************/

/* 
 *  Checks if a Wallet is registered on the chain 
 *  
 *  Blockchain: Blockchain where the wallet is registered
 *  Address: Wallet Address
 */
async function checkWallet(blockchain, address) {
    let data = {
        "Blockchain": hexFix(blockchain),
        "Address": hexFix(address),
        "Version": Version
    };

    try {
        const response = await fetch(NAG_URL + 'Circular_CheckWallet_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error({"Result": 500, "Response": "Error: " + error.message});
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}


/* 
 *  Retrieves a Wallet 
 *  
 *  Blockchain: Blockchain where the wallet is registered
 *  Address: Wallet Address
 */
async function getWallet(blockchain, address) {
    let data = {
        "Blockchain": hexFix(blockchain),
        "Address": hexFix(address),
        "Version": Version
    };

    try {
        const response = await fetch(NAG_URL + 'Circular_GetWallet_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error({"Result": 500, "Response": "Error: " + error.message});
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}


/* 
 *  Retrieves a Wallet 
 *  
 *  Blockchain: Blockchain where the wallet is registered
 *  Address: Wallet Address
 */
async function getLatestTransactions(blockchain, address) {
    let data = {
        "Blockchain": hexFix(blockchain),
        "Address": hexFix(address),
        "Version": Version
    };

    try {
        const response = await fetch(NAG_URL + 'Circular_GetLatestTransactions_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error({"Result": 500, "Response": "Error: " + error.message});
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}



/* 
 *   Retrieves the balance of a specified asset in a Wallet
 *   Blockchain: Blockchain where the wallet is registered
 *   Address: Wallet address
 *   Asset: Asset Name (example 'CIRX')
 */
async function getWalletBalance(blockchain, address, asset) {
    let data = {
        "Blockchain": hexFix(blockchain),
        "Address": hexFix(address),
        "Asset": asset,
        "Version": Version
    };

    try {
        const response = await fetch(NAG_URL + 'Circular_GetWalletBalance_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error({"Result": 500, "Response": "Error: " + error.message});
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}


/* 
 *   Retrieves the Nonce of a Wallet
 *   Blockchain: Blockchain where the wallet is registered
 *   Address: Wallet address
 */
async function getWalletNonce(blockchain, address) {
    let data = {
        "Blockchain": hexFix(blockchain),
        "Address": hexFix(address),
        "Version": Version
    };

    try {
        const response = await fetch(NAG_URL + 'Circular_GetWalletNonce_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error({"Result": 500, "Response": "Error: " + error.message});
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}



/* 
 *   Register a wallet on a desired blockchain.
 *   The same wallet can be registered on multiple blockchains
 *   Blockchain: Blockchain where the wallet will be registered
 *   PublicKey: Wallet PublicKey
 *   
 *   Without registration on the blockchain the wallet will not be reachable
 */
async function registerWallet(blockchain, publicKey) {
    let From = sha256(publicKey);
    let To = From;
    let Nonce = '0';
    let Type = 'C_TYPE_REGISTERWALLET';
    
    let PayloadObj = { "Action": "CP_REGISTERWALLET", "PublicKey": publicKey };
    let jsonstr = JSON.stringify(PayloadObj);
    let Payload = stringToHex(jsonstr);
    let Timestamp = getFormattedTimestamp();
    let ID = sha256(blockchain + From + To + Payload + Nonce + Timestamp);
    let Signature = "";
    
    try {
        return await sendTransaction(ID, From, To, Timestamp, Type, Payload, Nonce, Signature, blockchain);
    }
    catch (error) {
        console.error('Error:', error);
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}


/* DOMAINS MANAGEMENT *********************************************************/


/* 
 *  Resolves the domain name returning the wallet address associated to the domain name
 *  A single wallet can have multiple domains associations
 *  Blockchain : Blockchain where the domain and wallet are registered
 *  Name: Domain Name
 */
async function getDomain(blockchain, name) {
    let data = {
        "Blockchain": hexFix(blockchain),
        "Domain": name,
        "Version": Version
    };

    try {
        const response = await fetch(NAG_URL + 'Circular_GetDomain_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error({"Result": 500, "Response": "Error: " + error.message});
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}



/// PARAMETRIC ASSETS MANAGEMENT ///////////////////////////////////////////////////////////////////////////////////////


/* 
 *  Retrieves the list of all assets minted on a specific blockchain
 *  Blockchain: Blockchin where to request the list
 */
async function getAssetList(blockchain) {
    let data = {
        "Blockchain": hexFix(blockchain),
        "Version": Version
    };

    try {
        const response = await fetch(NAG_URL + 'Circular_GetAssetList_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error({"Result": 500, "Response": "Error: " + error.message});
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}



/* 
 *  Retrieves an Asset Descriptor
 *  Blockchain: Blockchain where the asset is minted
 *  Name: Asset Name (example 'CIRX')
 */
async function getAsset(blockchain, name) {
    let data = {
        "Blockchain": hexFix(blockchain),
        "AssetName": name,
        "Version": Version
    };

    try {
        const response = await fetch(NAG_URL + 'Circular_GetAsset_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error({"Result": 500, "Response": "Error: " + error.message});
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}



/* 
 *  Retrieve The total, circulating and residual supply of a specified asset
 *  Blockchain: Blockchain where the asset is minted
 *  Name: Asset Name (example 'CIRX')
 */
async function getAssetSupply(blockchain, name) {
    let data = {
        "Blockchain": hexFix(blockchain),
        "AssetName": name,
        "Version": Version
    };

    try {
        const response = await fetch(NAG_URL + 'Circular_GetAssetSupply_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error({"Result": 500, "Response": "Error: " + error.message});
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}



// VOUCHERS MANAGEMENT//////////////////////////////////////////////////////////

/* 
 *  Retrieves an existing Voucher
 *  Blockchain: blockchain where the voucher was minted
 *  Code: voucher code
 */
async function getVoucher(blockchain, code) {

    code = String(code);
    if (code.startsWith('0x')) { code = code.slice(2); }

    let data = {
        "Blockchain": hexFix(blockchain),
        "Code": code,
        "Version": Version
    };



    try {
        const response = await fetch(NAG_URL + 'Circular_GetVoucher_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error({"Result": 500, "Response": "Error: " + error.message});
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}



// BLOCKS MANAGEMENT //////////////////////////////////////////////////////////////////////////////////

/* 
 *  Retrieve All blocks in a specified range
 *  Blockchain: blockchain where to search the blocks
 *  Start: Initial block
 *  End: End block
 *  
 *  If End = 0, then Start is the number of blocks from the last one minted going backward.
 */
async function getBlockRange(blockchain, start, end) {
    let data = {
        "Blockchain": hexFix(blockchain),
        "Start": String(start),
        "End": String(end),
        "Version": Version
    };

    try {
        const response = await fetch(NAG_URL + 'Circular_GetBlockRange_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error:', error);
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}


/* 
 *  Retrieve a desired block
 *  Blockchain: blockchain where to search the block
 *  Num: Block number 
 */
async function getBlock(blockchain, num) {
    let data = {
        "Blockchain": hexFix(blockchain),
        "BlockNumber": String(num),
        "Version": Version
    };

    try {
        const response = await fetch(NAG_URL + 'Circular_GetBlock_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error:', error);
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}


/* 
 *   Retrieves the blockchain block height
 *   
 *   Blockchain: blockchain where to count the blocks
 */
async function getBlockCount(blockchain) {
    let data = {
        "Blockchain": hexFix(blockchain),
        "Version": Version
    };

    try {
        const response = await fetch(NAG_URL + 'Circular_GetBlockCount_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error:', error);
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}



// ANALYTICS ////////////////////////////////////////////////////////////////////////////////////////////////

/* 
 *   Retrieves the Blockchain  Amalytics
 *   
 *   Blockchain: selected blockchain
 */
async function getAnalytics(blockchain) {
    let data = {
        "Blockchain": hexFix(blockchain),
        "Version": Version
    };

    try {
        const response = await fetch(NAG_URL + 'Circular_GetAnalytics_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error:', error);
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}


/* 
 *   Get The list of blockchains available in the network
 *   
 */
async function getBlockchains() {
    let data = {};

    try {
        const response = await fetch(NAG_URL + 'Circular_GetBlockchains_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error:', error);
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}



/// TRANSACTIONS ////////////////////////////////////////////////////////////////////////////////////////////


/* 
 * 
 *  Searches a transaction by ID between the pending transactions
 *  
 *  Blockchain: Blockchain where to search the transaction
 *  TxID: Transaction ID
 *  
 */
async function getPendingTransaction(blockchain, TxID) {
    let data = {
        "Blockchain": hexFix(blockchain),
        "ID": hexFix(TxID),
        "Version": Version
    };

    try {
        const response = await fetch(NAG_URL + 'Circular_GetPendingTransaction_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        return response.json();
    } catch (error) {
        console.error('Error:', error);
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}


/*
 *   Searches a Transaction by its ID
 *   The transaction will be searched initially between the pending transactions and then in the blockchain
 *   
 *   Blockchain: blockchain where to search the transaction
 *   TxID: transaction ID
 *   Start: Starting block
 *   End: End block
 *   
 *   if End = 0 Start indicates the number of blocks starting from the last block minted 
 */
async function getTransactionbyID(blockchain, TxID, start, end) {
    
    let data = {
        "Blockchain": hexFix(blockchain),
        "ID": hexFix(TxID),
        "Start": String(start),
        "End": String(end),
        "Version": Version
    };

    try {
        const response = await fetch(NAG_URL + 'Circular_GetTransactionbyID_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        return response.json();
    } catch (error) {
        console.error('Error:', error);
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}


/*
 *  Searches all transactions broadcasted by a specified node
 * 
 *  Blockchain: blockchain where to search the transaction
 *  NodeID: ID of the node that has broadcasted the transaction
 *  Start: Starting block
 *  End: End block
 *   
 * if End = 0 Start indicates the number of blocks starting from the last block minted 
 */
async function getTransactionbyNode(blockchain, nodeID, start, end) {

    let data = {
        "Blockchain": hexFix(blockchain),
        "NodeID": hexFix(nodeID),
        "Start": String(start),
        "End": String(end),
        "Version": Version
    };

    try {
        const response = await fetch(NAG_URL + 'Circular_GetTransactionbyNode_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        return response.json();
    } catch (error) {
        console.error('Error:', error);
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}

/*
 *  Searches all transactions Involving a specified address
 * 
 *  Blockchain: blockchain where to search the transaction
 *  Address: Can be the sender or the recipient of the transaction
 *  Start: Starting block
 *  End: End block
 *   
 * if End = 0 Start indicates the number of blocks starting from the last block minted 
 */
async function getTransactionbyAddress(blockchain, address, start, end) {

    let data = {
        "Blockchain": hexFix(blockchain),
        "Address": hexFix(address),
        "Start": String(start),
        "End": String(end),
        "Version": Version
    };

    try {
        const response = await fetch(NAG_URL + 'Circular_GetTransactionbyAddress_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        return response.json();
    } catch (error) {
        console.error('Error:', error);
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}

/*
 *  Searches all transactions Involving a specified address in a specified timeframe
 * 
 *  Blockchain: blockchain where to search the transaction
 *  Address: Can be the sender or the recipient of the transaction
 *  StartDate: Starting date
 *  endDate: End date
 *   
 */
async function getTransactionbyDate(Blockchain, Address, StartDate, EndDate) {
    let data = {
        "Blockchain": hexFix(Blockchain),
        "Address": hexFix(Address),
        "StartDate": StartDate,
        "EndDate": EndDate,
        "Version": Version
    };

    try {
        const response = await fetch(NAG_URL + 'Circular_GetTransactionbyDate_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        return response.json();
    } catch (error) {
        console.error('Error:', error);
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}
      
/*
 *  Submits a transaction to a desired blockchain
 * 
 *  ID: Transaction ID
 *  From: Transaction Sender
 *  To: Transaction recipient
 *  Timestamp: Formatted Timestamo YYYY:MM:DD-hh:mm:ss
 *  Type: Transaction Type Refer to Documentation
 *  Payload: Transaction payload
 *  Nonce: Wallet nonce
 *  Signature: transaction Signature
 *  Blockchain: Blockchain where the transaction will be submitted
 */
async function sendTransaction(id, from, to, timestamp, type, payload, nonce, signature, blockchain) {
    let data = {
        "ID": hexFix(id),
        "From": hexFix(from),
        "To": hexFix(to),
        "Timestamp": timestamp,
        "Payload": hexFix(payload),
        "Nonce": String(nonce),
        "Signature": hexFix(signature),
        "Blockchain": hexFix(blockchain),
        "Type": type,
        "Version": Version
    };

    console.log(data);

    try {
        const response = await fetch(NAG_URL + 'Circular_AddTransaction_' + NETWORK_NODE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        return response.json();
    } catch (error) {
        console.error('Error:', error);
        return { "Result": 500, "Response": "Error: " + error.message }; // Return the JSON on error
    }
}



// Send a transaction to the blockchain


var intervalSec = 15;
/*
 *    Recursive transaction finality polling
 *    will search a transaction every  intervalSec seconds with a desired timeout. 
 *    
 *    Blockchain: blockchain where the transaction was submitted
 *    TxID: Transaction ID
 *    timeoutSec: Waiting timeout
 *    
 */
function getTransactionOutcome(blockchain, TxID, timeoutSec) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const interval = intervalSec * 1000;  // Convert seconds to milliseconds
        const timeout = timeoutSec * 1000;    // Convert seconds to milliseconds

        const checkTransaction = () => {
            const elapsedTime = Date.now() - startTime;

            if (elapsedTime > timeout) {
                return reject(new Error('Timeout exceeded'));
            }

            getTransactionByID(blockchain, TxID, 0, 10)
                .then(data => {
                    if (data.Result === 200 && data.Response !== 'Transaction Not Found' && data.Response.Status !== 'Pending') {
                        resolve(data.Response);  // Transaction found and not pending
                    } else {
                        setTimeout(checkTransaction, interval);  // Continue polling after interval
                    }
                })
                .catch(error => reject(error));  // Reject on fetch error
        };

        checkTransaction();  // Start polling immediately
    });
}

            
  // Public API
  return {
              checkWallet : checkWallet,
                getWallet : getWallet,
           getWalletNonce : getWalletNonce,
    getLatestTransactions : getLatestTransactions,
         getWalletBalance : getWalletBalance,
             testContract : testContract,
             callContract : callContract,
                setNAGKey : setNAGKey,
                setNAGURL : setNAGURL,
                getVersion : getVersion,
                getNAGKey : getNAGKey,
                getNAGURL : getNAGURL,
                  setNode : setNode,
                   hexFix : hexFix,
              stringToHex : stringToHex,
              hexToString : hexToString,
           registerWallet : registerWallet,
                getDomain : getDomain,
             getAssetList : getAssetList,
                 getAsset : getAsset,
               getVoucher : getVoucher,
           getAssetSupply : getAssetSupply,
              signMessage : signMessage, 
             getPublicKey : getPublicKey,
    getFormattedTimestamp : getFormattedTimestamp,
          verifySignature : verifySignature,
                 getBlock : getBlock,
            getBlockRange : getBlockRange,
            getBlockCount : getBlockCount,
             getAnalytics : getAnalytics,
           getBlockchains : getBlockchains,
    getPendingTransaction : getPendingTransaction,
       getTransactionbyID : getTransactionbyID,
     getTransactionbyNode : getTransactionbyNode,
  getTransactionbyAddress : getTransactionbyAddress,
     getTransactionbyDate : getTransactionbyDate,
          sendTransaction : sendTransaction,
    getTransactionOutcome : getTransactionOutcome
                
  };  
})();
