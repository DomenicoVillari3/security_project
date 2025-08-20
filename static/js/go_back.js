//Recupero il button goback nella pagina e gli metto un eventlistener
document.getElementById("goback").addEventListener("click", function(){
    //recupero la pagina di provenienza con document.referrer
    var paginaProvenienza = document.referrer;

        //controllo pagina di provenienza se è una delle 3 vado comunque nell'index.php
        if (paginaProvenienza.includes('${API_BASE}/login') || paginaProvenienza.includes('${API_BASE}/dashboard') || paginaProvenienza.includes('${API_BASE}/register') ){
            window.location.href = `${API_BASE}/`;
        }
        else{
            window.history.back(); // Altrimenti, comportamento predefinito 
        }

    });



