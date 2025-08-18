const input = document.getElementById("location");
const suggestions = document.getElementById("suggestions");



input.addEventListener("input", async () => {
  const query = input.value;
  if (query.length < 3) return; // aspetta almeno 3 lettere

    // Chiamata a Nominatim per ottenere suggerimenti
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&countrycodes=it`;

  const res = await fetch(url, { headers: { "User-Agent": "demo-app" } });
  const data = await res.json();

  // Pulisce lista suggerimenti
  suggestions.innerHTML = "";

  data.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item.display_name;
    li.onclick = () => {
      input.value = item.display_name;
      suggestions.innerHTML = "";
      console.log("Coordinate:", item.lat, item.lon);
    };
    suggestions.appendChild(li);
  });
});


//AUTOCOMPLETE TIMESTAMP
// Prende l'elemento
const input_time = document.getElementById("timestamp");

// Ottiene l'ora attuale in formato ISO e la taglia a "YYYY-MM-DDTHH:MM"
const now = new Date();
const localISOTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
.toISOString()
.slice(0, 16);

// Imposta il valore di default
input_time.value = localISOTime;