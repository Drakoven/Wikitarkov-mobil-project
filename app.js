const API_URL = "https://api.tarkov.dev/graphql";

const content = document.getElementById("content");
const searchInput = document.getElementById("searchInput");

let allTasks = [];
let allItems = [];
let allHideoutStations = [];

let currentSection = "home";
let hideCompletedItems = false;

let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
let completedTasks = JSON.parse(localStorage.getItem("completedTasks")) || [];
let hideoutItemProgress = JSON.parse(localStorage.getItem("hideoutItemProgress")) || {};

const mapsData = [
  {
    name: "Customs",
    image: "assets/maps/customs.jpg",
    difficulty: "Débutant / Intermédiaire",
    boss: "Reshala",
    use: "Très utilisée pour les quêtes early wipe.",
    extracts: ["Crossroads", "ZB-1011", "Trailer Park", "RUAF Roadblock"]
  },
  {
    name: "Factory",
    image: "assets/maps/facto.jpg",
    difficulty: "Difficile",
    boss: "Tagilla",
    use: "Petite map PvP, rapide et dangereuse.",
    extracts: ["Gate 3", "Cellars", "Med Tent Gate"]
  },
  {
    name: "Woods",
    image: "assets/maps/woods.jpg",
    difficulty: "Intermédiaire",
    boss: "Shturman",
    use: "Grande map ouverte, utile pour quêtes et sniping.",
    extracts: ["Outskirts", "UN Roadblock", "ZB-014", "RUAF Gate"]
  },
  {
    name: "Interchange",
    image: "assets/maps/interchange.jpg",
    difficulty: "Intermédiaire",
    boss: "Killa",
    use: "Bon loot technique et électronique.",
    extracts: ["Emercom Checkpoint", "Railway Exfil", "Power Station"]
  },
  {
    name: "Reserve",
    image: "assets/maps/reserve.jpg",
    difficulty: "Difficile",
    boss: "Glukhar",
    use: "Très bon loot militaire et raiders.",
    extracts: ["D-2", "Hermetic Door", "Cliff Descent", "Armored Train"]
  },
  {
    name: "Shoreline",
    image: "assets/maps/shoreline.jpg",
    difficulty: "Intermédiaire",
    boss: "Sanitar",
    use: "Grande map orientée quêtes et resort.",
    extracts: ["Tunnel", "Road to Customs", "Pier Boat", "Path to Lighthouse"]
  },
  {
    name: "Lighthouse",
    image: "assets/maps/lighthouse.jpg",
    difficulty: "Difficile",
    boss: "Zryachiy / Rogues",
    use: "Très bon loot et présence des Rogues.",
    extracts: ["Southern Road", "Path to Shoreline", "Mountain Pass"]
  },
  {
    name: "Labs",
    image: "assets/maps/labs.jpg",
    difficulty: "Très difficile",
    boss: "Raiders",
    use: "PvP intense et loot haut niveau.",
    extracts: ["Cargo Elevator", "Medical Elevator", "Parking Gate"]
  },
  {
    name: "Streets",
    image: "assets/maps/streets.jpg",
    difficulty: "Très difficile",
    boss: "Kaban / Kollontay",
    use: "Très dense avec énormément de loot.",
    extracts: ["Collapsed Crane", "Courtyard", "Damaged House", "Klimov Street"]
  },
  {
    name: "Ground Zero",
    image: "assets/maps/groundzero.jpg",
    difficulty: "Débutant",
    boss: "Aucun",
    use: "Map d'introduction pour nouveaux joueurs.",
    extracts: ["Emercom Checkpoint", "Police Checkpoint", "Nakatani Basement"]
  }
];

function saveToCache(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function loadFromCache(key) {
  return JSON.parse(localStorage.getItem(key)) || null;
}

async function getQuests() {
  currentSection = "quests";
  searchInput.style.display = "block";
  searchInput.value = "";
  content.innerHTML = "<p>Chargement des quêtes...</p>";

  const cachedTasks = loadFromCache("cachedTasks");

  if (cachedTasks) {
    allTasks = cachedTasks;
    displayQuests(allTasks);
    return;
  }

  const query = `
    {
      tasks {
        id
        name
        kappaRequired
        experience
        minPlayerLevel
        trader { name }
        map { name }
        objectives { description }
        taskRequirements {
          task {
            id
            name
          }
        }
        finishRewards {
          items {
            item {
              name
              iconLink
            }
            count
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });

    const result = await response.json();

    if (result.errors) {
      console.error(result.errors);
      content.innerHTML = "<p>Erreur API quêtes.</p>";
      return;
    }

    allTasks = result.data.tasks;
    saveToCache("cachedTasks", allTasks);
    displayQuests(allTasks);
  } catch (error) {
    console.error(error);
    content.innerHTML = "<p>Impossible de charger les quêtes.</p>";
  }
}

function displayQuests(tasks) {
  content.innerHTML = "<h2>Quêtes</h2>";

  tasks.forEach(task => {
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => displayQuestDetails(task);

    card.innerHTML = `
      <h3>
        ${isTaskComplete(task.id) ? "✔ " : ""}
        ${task.name}
        ${task.kappaRequired ? '<span class="kappa-badge">🟣 Kappa</span>' : ""}
      </h3>
      <p>Marchand : ${task.trader?.name || "Inconnu"}</p>
    `;

    content.appendChild(card);
  });
}

function displayQuestDetails(task) {
  const unlockedTasks = getUnlockedTasks(task.id);

  content.innerHTML = `
    <button class="back-btn" onclick="displayQuests(allTasks)">← Retour</button>

    <div class="quest-detail">
      <h2>${task.name}</h2>

      ${task.kappaRequired ? '<div class="kappa-detail">🟣 Requise pour Kappa</div>' : ""}

      <button class="favorite-btn" onclick='addFavorite("quête", { id: "${task.id}", name: "${task.name}" })'>
        ${isFavorite(task.id) ? "⭐ Retirer des favoris" : "☆ Ajouter aux favoris"}
      </button>

      <button class="complete-btn" onclick='toggleTaskComplete("${task.id}")'>
        ${isTaskComplete(task.id) ? "✔ Quête terminée" : "❌ Marquer comme terminée"}
      </button>

      <div class="detail-box">
        <p><strong>Marchand :</strong> ${task.trader?.name || "Inconnu"}</p>
        <p><strong>Map :</strong> ${task.map?.name || "Non précisée"}</p>
        <p><strong>Niveau requis :</strong> ${task.minPlayerLevel || "Aucun"}</p>
        <p><strong>XP :</strong> ${task.experience || 0}</p>
      </div>

      <div class="detail-box">
        <button class="section-toggle" onclick="toggleSection('objectives-section')">▼ Objectifs</button>
        <div id="objectives-section">
          ${
            task.objectives?.length > 0
              ? task.objectives.map(obj => `<div class="objective">${obj.description}</div>`).join("")
              : "<p>Aucun objectif trouvé.</p>"
          }
        </div>
      </div>

      <div class="detail-box">
        <button class="section-toggle" onclick="toggleSection('rewards-section')">▼ Récompenses</button>
        <div id="rewards-section">
          ${
            task.finishRewards?.items?.length > 0
              ? task.finishRewards.items.map(reward => `
                  <div class="reward">
                    ${reward.item.iconLink ? `<img src="${reward.item.iconLink}" alt="${reward.item.name}">` : ""}
                    <span>${reward.count} x ${reward.item.name}</span>
                  </div>
                `).join("")
              : "<p>Aucune récompense trouvée.</p>"
          }
        </div>
      </div>

      <div class="detail-box">
        <button class="section-toggle" onclick="toggleSection('requirements-section')">▼ Quêtes précédentes</button>
        <div id="requirements-section">
          ${
            task.taskRequirements?.length > 0
              ? task.taskRequirements.map(req => `<div class="objective">${req.task?.name || "Quête inconnue"}</div>`).join("")
              : "<p>Aucune quête précédente requise.</p>"
          }
        </div>
      </div>

      <div class="detail-box">
        <button class="section-toggle" onclick="toggleSection('unlocked-section')">▼ Quêtes débloquées</button>
        <div id="unlocked-section">
          ${
            unlockedTasks.length > 0
              ? unlockedTasks.map(unlocked => `
                  <div class="objective">
                    ${unlocked.name}
                    ${unlocked.kappaRequired ? '<span class="kappa-badge">🟣 Kappa</span>' : ""}
                  </div>
                `).join("")
              : "<p>Aucune quête débloquée trouvée.</p>"
          }
        </div>
      </div>
    </div>
  `;
}

async function showItems() {
  currentSection = "items";
  searchInput.style.display = "block";
  searchInput.value = "";
  content.innerHTML = "<p>Chargement des objets...</p>";

  const cachedItems = loadFromCache("cachedItems");

  if (cachedItems) {
    allItems = cachedItems;
    displayItems(allItems);
    return;
  }

  const query = `
    {
      items {
        id
        name
        shortName
        description
        iconLink
        imageLink
        avg24hPrice
        weight
        width
        height
        category { name }
      }
    }
  `;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });

    const result = await response.json();

    if (result.errors) {
      console.error(result.errors);
      content.innerHTML = "<p>Erreur API objets.</p>";
      return;
    }

    allItems = result.data.items;
    saveToCache("cachedItems", allItems);
    displayItems(allItems);
  } catch (error) {
    console.error(error);
    content.innerHTML = "<p>Erreur chargement objets.</p>";
  }
}

function displayItems(items) {
  content.innerHTML = "<h2>Objets</h2>";

  items.slice(0, 100).forEach(item => {
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => displayItemDetails(item);

    card.innerHTML = `
      <div class="item-card">
        <img src="${item.iconLink}" alt="${item.name}">
        <div>
          <h3>${item.name}</h3>
          <p>${item.category?.name || "Inconnu"}</p>
          <p>${item.avg24hPrice || 0}₽</p>
        </div>
      </div>
    `;

    content.appendChild(card);
  });
}

function displayItemDetails(item) {
  content.innerHTML = `
    <button class="back-btn" onclick="displayItems(allItems)">← Retour</button>

    <div class="quest-detail">
      <h2>${item.name}</h2>

      <button class="favorite-btn" onclick='addFavorite("objet", { id: "${item.id}", name: "${item.name}" })'>
        ${isFavorite(item.id) ? "⭐ Retirer des favoris" : "☆ Ajouter aux favoris"}
      </button>

      <div class="detail-box item-detail-header">
        <img src="${item.imageLink || item.iconLink}" alt="${item.name}">
        <div>
          <p><strong>Nom court :</strong> ${item.shortName || "N/A"}</p>
          <p><strong>Catégorie :</strong> ${item.category?.name || "Inconnu"}</p>
          <p><strong>Prix moyen :</strong> ${item.avg24hPrice || 0}₽</p>
        </div>
      </div>

      <div class="detail-box">
        <h3>Informations</h3>
        <p><strong>Poids :</strong> ${item.weight || 0} kg</p>
        <p><strong>Taille :</strong> ${item.width || "?"} x ${item.height || "?"}</p>
      </div>

      <div class="detail-box">
        <h3>Description</h3>
        <p>${item.description || "Aucune description"}</p>
      </div>
    </div>
  `;
}

function showMaps() {
  currentSection = "maps";
  searchInput.style.display = "none";
  searchInput.value = "";

  content.innerHTML = "<h2>Maps</h2>";

  mapsData.forEach(map => {
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => openMap(map);

    card.innerHTML = `
      <div class="map-preview">
        <img src="${map.image}" alt="${map.name}">
      </div>
      <h3>${map.name}</h3>
      <p><strong>Difficulté :</strong> ${map.difficulty}</p>
      <p><strong>Boss :</strong> ${map.boss}</p>
    `;

    content.appendChild(card);
  });
}

function openMap(map) {
  currentSection = "map-detail";
  searchInput.style.display = "none";

  content.innerHTML = `
    <button class="back-btn" onclick="showMaps()">← Retour</button>

    <div class="quest-detail">
      <h2>${map.name}</h2>

      <div class="detail-box">
        <p><strong>Difficulté :</strong> ${map.difficulty}</p>
        <p><strong>Boss :</strong> ${map.boss}</p>
        <p><strong>Utilité :</strong> ${map.use}</p>
      </div>

      <div class="detail-box">
        <h3>Extracts principales</h3>
        ${map.extracts.map(extract => `<div class="objective">${extract}</div>`).join("")}
      </div>
    </div>
  `;
}

async function showHideout() {
  currentSection = "hideout";
  searchInput.style.display = "none";
  searchInput.value = "";

  content.innerHTML = "<p>Chargement du hideout...</p>";

  const query = `
    {
      hideoutStations {
        id
        name
        levels {
          level
          itemRequirements {
            item {
              id
              name
              iconLink
            }
            count
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });

    const result = await response.json();

    if (result.errors) {
      console.error(result.errors);
      content.innerHTML = "<p>Erreur API Hideout.</p>";
      return;
    }

    allHideoutStations = result.data.hideoutStations;
    displayHideoutStations(allHideoutStations);
  } catch (error) {
    console.error(error);
    content.innerHTML = "<p>Impossible de charger le hideout.</p>";
  }
}

function getHideoutStationProgress(station) {
  let total = 0;
  let completed = 0;

  station.levels.forEach(level => {
    level.itemRequirements?.forEach(req => {
      const itemKey = `${station.id}-${level.level}-${req.item.id}`;
      const currentAmount = getHideoutItemProgress(itemKey);
      const requiredAmount = req.count;

      total += requiredAmount;
      completed += Math.min(currentAmount, requiredAmount);
    });
  });

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { completed, total, percent };
}

function displayHideoutStations(stations) {
  content.innerHTML = "<h2>Hideout</h2>";

  stations.forEach(station => {
    const progress = getHideoutStationProgress(station);

    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => displayHideoutDetails(station);

    card.innerHTML = `
      <h3>${station.name}</h3>
      <p>${station.levels.length} niveaux</p>
      <p>${progress.completed} / ${progress.total} requis</p>

      <div class="progress-bar mini-progress">
        <div class="progress-fill" style="width: ${progress.percent}%;"></div>
      </div>

      <p>${progress.percent}%</p>
    `;

    content.appendChild(card);
  });
}

function displayHideoutDetails(station) {
  content.innerHTML = `
    <button class="back-btn" onclick="displayHideoutStations(allHideoutStations)">← Retour</button>

    <div class="quest-detail">
      <h2>${station.name}</h2>

      <button
        class="favorite-btn"
        onclick='hideCompletedItems = !hideCompletedItems; displayHideoutDetails(allHideoutStations.find(s => s.id === "${station.id}"))'
      >
        ${hideCompletedItems ? "👁 Afficher tous les objets" : "🎯 Afficher uniquement les objets manquants"}
      </button>

      ${
        station.levels.map(level => `
          <div class="detail-box">
            <h3>Niveau ${level.level}</h3>

            ${
              level.itemRequirements?.length > 0
                ? level.itemRequirements
                    .filter(req => {
                      const itemKey = `${station.id}-${level.level}-${req.item.id}`;
                      const currentAmount = getHideoutItemProgress(itemKey);

                      return !hideCompletedItems || currentAmount < req.count;
                    })
                    .map(req => {
                      const itemKey = `${station.id}-${level.level}-${req.item.id}`;
                      const currentAmount = getHideoutItemProgress(itemKey);
                      const maxAmount = req.count;

                      return `
                        <div class="reward hideout-requirement">
                          ${req.item.iconLink ? `<img src="${req.item.iconLink}" alt="${req.item.name}">` : ""}

                          <div class="hideout-progress">
                            <span class="hideout-item-name">${req.item.name}</span>

                            <div class="hideout-controls">
                              ${
                                maxAmount > 100
                                  ? `
                                    <button class="qty-btn small-btn" onclick='event.stopPropagation(); changeHideoutItem("${itemKey}", -10000, "${station.id}", ${maxAmount})'>-10k</button>
                                    <button class="qty-btn small-btn" onclick='event.stopPropagation(); changeHideoutItem("${itemKey}", -1000, "${station.id}", ${maxAmount})'>-1k</button>
                                  `
                                  : `
                                    <button class="qty-btn" onclick='event.stopPropagation(); changeHideoutItem("${itemKey}", -1, "${station.id}", ${maxAmount})'>-</button>
                                  `
                              }

                              <span class="qty-display">${currentAmount} / ${maxAmount}</span>

                              ${
                                maxAmount > 100
                                  ? `
                                    <button class="qty-btn small-btn" onclick='event.stopPropagation(); changeHideoutItem("${itemKey}", 1000, "${station.id}", ${maxAmount})'>+1k</button>
                                    <button class="qty-btn small-btn" onclick='event.stopPropagation(); changeHideoutItem("${itemKey}", 10000, "${station.id}", ${maxAmount})'>+10k</button>
                                  `
                                  : `
                                    <button class="qty-btn" onclick='event.stopPropagation(); changeHideoutItem("${itemKey}", 1, "${station.id}", ${maxAmount})'>+</button>
                                  `
                              }
                            </div>
                          </div>
                        </div>
                      `;
                    }).join("")
                : "<p>Aucun objet requis.</p>"
            }
          </div>
        `).join("")
      }
    </div>
  `;
}

function changeHideoutItem(itemKey, amount, stationId, max) {
  if (!hideoutItemProgress[itemKey]) {
    hideoutItemProgress[itemKey] = 0;
  }

  hideoutItemProgress[itemKey] += amount;

  if (hideoutItemProgress[itemKey] < 0) {
    hideoutItemProgress[itemKey] = 0;
  }

  if (hideoutItemProgress[itemKey] > max) {
    hideoutItemProgress[itemKey] = max;
  }

  saveHideoutProgress();
  refreshHideoutStation(stationId);
}

function refreshHideoutStation(stationId) {
  const station = allHideoutStations.find(station => station.id === stationId);

  if (station) {
    displayHideoutDetails(station);
  }
}

function saveHideoutProgress() {
  localStorage.setItem("hideoutItemProgress", JSON.stringify(hideoutItemProgress));
}

function getHideoutItemProgress(itemKey) {
  return hideoutItemProgress[itemKey] || 0;
}

searchInput.addEventListener("input", () => {
  const value = searchInput.value.toLowerCase();

  if (currentSection === "quests") {
    displayQuests(allTasks.filter(task => task.name.toLowerCase().includes(value)));
  }

  if (currentSection === "items") {
    displayItems(
      allItems.filter(item =>
        item.name.toLowerCase().includes(value) ||
        item.shortName?.toLowerCase().includes(value)
      )
    );
  }
});

function getUnlockedTasks(taskId) {
  return allTasks.filter(otherTask =>
    otherTask.taskRequirements?.some(req => req.task?.id === taskId)
  );
}

function toggleSection(id) {
  const section = document.getElementById(id);
  section.style.display = section.style.display === "none" ? "block" : "none";
}

function addFavorite(type, data) {
  const exists = favorites.find(fav => fav.id === data.id);

  if (exists) {
    favorites = favorites.filter(fav => fav.id !== data.id);
  } else {
    favorites.push({ type, ...data });
  }

  localStorage.setItem("favorites", JSON.stringify(favorites));
}

function isFavorite(id) {
  return favorites.some(fav => fav.id === id);
}

function showFavorites() {
  currentSection = "favorites";
  searchInput.style.display = "none";
  searchInput.value = "";

  const cachedTasks = loadFromCache("cachedTasks");
  const cachedItems = loadFromCache("cachedItems");

  if (cachedTasks) allTasks = cachedTasks;
  if (cachedItems) allItems = cachedItems;

  content.innerHTML = "<h2>Favoris</h2>";

  if (favorites.length === 0) {
    content.innerHTML += "<p>Aucun favori.</p>";
    return;
  }

  favorites.forEach(fav => {
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => openFavorite(fav);

    card.innerHTML = `
      <h3>${fav.name}</h3>
      <p>${fav.type}</p>
    `;

    content.appendChild(card);
  });
}

function openFavorite(fav) {
  if (fav.type === "quête") {
    const task = allTasks.find(task => task.id === fav.id);
    task ? displayQuestDetails(task) : alert("Charge d'abord les quêtes.");
  }

  if (fav.type === "objet") {
    const item = allItems.find(item => item.id === fav.id);
    item ? displayItemDetails(item) : alert("Charge d'abord les objets.");
  }
}

function toggleTaskComplete(taskId) {
  if (completedTasks.includes(taskId)) {
    completedTasks = completedTasks.filter(id => id !== taskId);
  } else {
    completedTasks.push(taskId);
  }

  localStorage.setItem("completedTasks", JSON.stringify(completedTasks));
}

function isTaskComplete(taskId) {
  return completedTasks.includes(taskId);
}

function getKappaProgress() {
  const kappaTasks = allTasks.filter(task => task.kappaRequired);
  const completedKappaTasks = kappaTasks.filter(task => completedTasks.includes(task.id));

  return {
    completed: completedKappaTasks.length,
    total: kappaTasks.length,
    percent: kappaTasks.length > 0
      ? Math.round((completedKappaTasks.length / kappaTasks.length) * 100)
      : 0
  };
}

function showKappaTasks() {
  currentSection = "kappa";
  searchInput.style.display = "none";

  const kappaTasks = allTasks.filter(task => task.kappaRequired);

  const sortedTasks = [
    ...kappaTasks.filter(task => completedTasks.includes(task.id)),
    ...kappaTasks.filter(task => !completedTasks.includes(task.id))
  ];

  content.innerHTML = "<h2>🟣 Quêtes Kappa</h2>";

  sortedTasks.forEach(task => {
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => displayQuestDetails(task);

    card.innerHTML = `
      <h3>${completedTasks.includes(task.id) ? "✔ " : ""}${task.name}</h3>
      <p>${task.trader?.name || "Inconnu"}</p>
    `;

    content.appendChild(card);
  });
}

function showHome() {
  currentSection = "home";
  searchInput.style.display = "none";
  searchInput.value = "";

  const cachedTasks = loadFromCache("cachedTasks");

  if (cachedTasks) {
    allTasks = cachedTasks;
  }

  content.innerHTML = `
    <div class="home-screen">
      <div class="home-overlay">
        <h1>WikiTarkov</h1>

        <p class="subtitle">
          Companion App Escape From Tarkov
        </p>

        <div class="kappa-progress" onclick="showKappaTasks()">
          <h3>🟣 Progression Kappa</h3>
          <p>${getKappaProgress().completed} / ${getKappaProgress().total} quêtes</p>

          <div class="progress-bar">
            <div class="progress-fill" style="width: ${getKappaProgress().percent}%;"></div>
          </div>

          <span>${getKappaProgress().percent}%</span>
        </div>

        <div class="home-buttons">
          <button onclick="getQuests()">📋 Quêtes</button>
          <button onclick="showItems()">🎒 Objets</button>
          <button onclick="showMaps()">🗺 Maps</button>
          <button onclick="showHideout()">🏚 Hideout</button>
          <button onclick="showFavorites()">⭐ Favoris</button>
        </div>
      </div>
    </div>
  `;
}

if ("serviceWorker" in navigator) {

  navigator.serviceWorker.register(
    "service-worker.js"
  )

  .then(() => {
    console.log("Service Worker enregistré");
  })

  .catch(error => {
    console.log(error);
  });
}

function showTraders() {
  currentSection = "traders";
  searchInput.style.display = "none";
  searchInput.value = "";

  content.innerHTML = `
    <h2>Marchands</h2>

    <div class="card">
      <h3>En construction</h3>
      <p>
        Ici on affichera les marchands, leurs objets vendus et leurs échanges.
      </p>
    </div>
  `;
}

showHome();