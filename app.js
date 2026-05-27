const API_URL = "https://api.tarkov.dev/graphql";

const content = document.getElementById("content");
const searchInput = document.getElementById("searchInput");

let allTasks = [];
let allItems = [];
let allHideoutStations = [];
let allTraders = [];
let allAmmo = [];

let currentSection = "home";
let hideCompletedItems = false;

let selectedTraderLevel = "all";
let traderViewMode = "sales";
let traderSearchValue = "";
let pendingTraderSearch = "";
let selectedAmmoPen = 0;
let selectedAmmoCaliber = "all";

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

/* =========================
   NAVIGATION ACTIVE
   Met en surbrillance le bouton de la section courante
========================= */

function setActiveNav(section) {
  const navMap = {
    home:      0,
    quests:    1,
    kappa:     1,
    items:     2,
    maps:      3,
    "map-detail": 3,
    hideout:   4,
    traders:   5,
    ammo:      6,
    favorites: 7
  };

  const buttons = document.querySelectorAll(".bottom-nav button");
  buttons.forEach(btn => btn.classList.remove("nav-active"));

  const index = navMap[section];
  if (index !== undefined && buttons[index]) {
    buttons[index].classList.add("nav-active");
  }
}

/* =========================
   HISTORIQUE NAVIGATEUR (History API)
   Le bouton retour mobile navigue entre les sections
========================= */

// Enregistre une entrée dans l'historique à chaque changement de section
function pushHistory(section, data = {}) {
  history.pushState({ section, ...data }, "", `#${section}`);
}

// Écoute le bouton retour natif
window.addEventListener("popstate", event => {
  const state = event.state;
  if (!state) { showHome(); return; }

  switch (state.section) {
    case "home":      showHome(false); break;
    case "quests":    displayQuests(allTasks, false); break;
    case "items":     displayItems(allItems, false); break;
    case "maps":      showMaps(false); break;
    case "hideout":   displayHideoutStations(allHideoutStations, false); break;
    case "traders":   displayTraders(allTraders, false); break;
    case "ammo":      displayAmmo(allAmmo, false); break;
    case "favorites": showFavorites(false); break;
    case "quest-detail":
      const task = allTasks.find(t => t.id === state.id);
      if (task) displayQuestDetails(task, false);
      break;
    case "item-detail":
      const item = allItems.find(i => i.id === state.id);
      if (item) displayItemDetails(item, false);
      break;
    case "map-detail":
      const map = mapsData.find(m => m.name === state.name);
      if (map) openMap(map, false);
      break;
    default: showHome(false);
  }
});

/* =========================
   SÉCURITÉ — ÉCHAPPEMENT HTML
   Empêche les injections XSS depuis les données API
========================= */

function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================
   CACHE AVEC TTL (1 heure)
   Évite de servir des données périmées après un wipe ou une MAJ API
========================= */

const CACHE_TTL = 60 * 60 * 1000; // 1 heure en millisecondes

function saveToCache(key, data) {
  const entry = {
    timestamp: Date.now(),
    data
  };
  localStorage.setItem(key, JSON.stringify(entry));
}

function loadFromCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const entry = JSON.parse(raw);

    // Ancien format sans timestamp — invalide
    if (!entry.timestamp || !entry.data) return null;

    // Données expirées
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

/* =========================
   DEBOUNCE
   Evite de re-render le DOM à chaque frappe clavier
========================= */

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* =========================
   QUÊTES
========================= */

async function getQuests(push = true) {
  currentSection = "quests";
  if (push) pushHistory("quests");
  setActiveNav("quests");
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

function displayQuests(tasks, push = true) {
  if (push) pushHistory("quests");
  setActiveNav("quests");
  content.innerHTML = "<h2>Quêtes</h2>";

  tasks.forEach(task => {
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => displayQuestDetails(task);

    card.innerHTML = `
      <h3>
        ${isTaskComplete(task.id) ? "✔ " : ""}
        ${escapeHTML(task.name)}
        ${task.kappaRequired ? '<span class="kappa-badge">🟣 Kappa</span>' : ""}
      </h3>
      <p>Marchand : ${escapeHTML(task.trader?.name) || "Inconnu"}</p>
    `;

    content.appendChild(card);
  });
}

function displayQuestDetails(task, push = true) {
  if (push) pushHistory("quest-detail", { id: task.id });
  setActiveNav("quests");
  const unlockedTasks = getUnlockedTasks(task.id);

  content.innerHTML = `
    <button class="back-btn" onclick="displayQuests(allTasks)">
      ← Retour
    </button>

    <div class="quest-detail">
      <h2>${escapeHTML(task.name)}</h2>

      ${task.kappaRequired ? '<div class="kappa-detail">🟣 Requise pour Kappa</div>' : ""}

      <button
        class="favorite-btn"
        onclick='addFavorite("quête", { id: "${escapeHTML(task.id)}", name: "${escapeHTML(task.name)}" })'
      >
        ${isFavorite(task.id) ? "⭐ Retirer des favoris" : "☆ Ajouter aux favoris"}
      </button>

      <button
        class="complete-btn"
        onclick='toggleTaskComplete("${escapeHTML(task.id)}")'
      >
        ${isTaskComplete(task.id) ? "✔ Quête terminée" : "❌ Marquer comme terminée"}
      </button>

      <div class="detail-box">
        <p><strong>Marchand :</strong> ${escapeHTML(task.trader?.name) || "Inconnu"}</p>
        <p><strong>Map :</strong> ${escapeHTML(task.map?.name) || "Non précisée"}</p>
        <p><strong>Niveau requis :</strong> ${escapeHTML(task.minPlayerLevel) || "Aucun"}</p>
        <p><strong>XP :</strong> ${task.experience || 0}</p>
      </div>

      <div class="detail-box">
        <button class="section-toggle" onclick="toggleSection('objectives-section')">
          ▼ Objectifs
        </button>
        <div id="objectives-section">
          ${
            task.objectives?.length > 0
              ? task.objectives.map(obj => `
                  <div class="objective">${escapeHTML(obj.description)}</div>
                `).join("")
              : "<p>Aucun objectif trouvé.</p>"
          }
        </div>
      </div>

      <div class="detail-box">
        <button class="section-toggle" onclick="toggleSection('rewards-section')">
          ▼ Récompenses
        </button>
        <div id="rewards-section">
          ${
            task.finishRewards?.items?.length > 0
              ? task.finishRewards.items.map(reward => `
                  <div class="reward">
                    ${reward.item.iconLink ? `<img src="${escapeHTML(reward.item.iconLink)}" alt="${escapeHTML(reward.item.name)}" loading="lazy">` : ""}
                    <span>${reward.count} x ${escapeHTML(reward.item.name)}</span>
                  </div>
                `).join("")
              : "<p>Aucune récompense trouvée.</p>"
          }
        </div>
      </div>

      <div class="detail-box">
        <button class="section-toggle" onclick="toggleSection('requirements-section')">
          ▼ Quêtes précédentes
        </button>
        <div id="requirements-section">
          ${
            task.taskRequirements?.length > 0
              ? task.taskRequirements.map(req => `
                  <div class="objective">${escapeHTML(req.task?.name) || "Quête inconnue"}</div>
                `).join("")
              : "<p>Aucune quête précédente requise.</p>"
          }
        </div>
      </div>

      <div class="detail-box">
        <button class="section-toggle" onclick="toggleSection('unlocked-section')">
          ▼ Quêtes débloquées
        </button>
        <div id="unlocked-section">
          ${
            unlockedTasks.length > 0
              ? unlockedTasks.map(unlocked => `
                  <div class="objective">
                    ${escapeHTML(unlocked.name)}
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

/* =========================
   OBJETS
========================= */

async function showItems(push = true) {
  currentSection = "items";
  if (push) pushHistory("items");
  setActiveNav("items");
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

function displayItems(items, push = true) {
  if (push) pushHistory("items");
  setActiveNav("items");
  content.innerHTML = "<h2>Objets</h2>";

  // Limite à 100 résultats pour les performances
  items.slice(0, 100).forEach(item => {
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => displayItemDetails(item);

    card.innerHTML = `
      <div class="item-card">
        <img src="${escapeHTML(item.iconLink)}" alt="${escapeHTML(item.name)}" loading="lazy">
        <div>
          <h3>${escapeHTML(item.name)}</h3>
          <p>${escapeHTML(item.category?.name) || "Inconnu"}</p>
          <p>${item.avg24hPrice || 0}₽</p>
        </div>
      </div>
    `;

    content.appendChild(card);
  });
}

function displayItemDetails(item, push = true) {
  if (push) pushHistory("item-detail", { id: item.id });
  setActiveNav("items");
  content.innerHTML = `
    <button class="back-btn" onclick="displayItems(allItems)">
      ← Retour
    </button>

    <div class="quest-detail">
      <h2>${escapeHTML(item.name)}</h2>

      <button
        class="favorite-btn"
        onclick='addFavorite("objet", { id: "${escapeHTML(item.id)}", name: "${escapeHTML(item.name)}" })'
      >
        ${isFavorite(item.id) ? "⭐ Retirer des favoris" : "☆ Ajouter aux favoris"}
      </button>

      <div class="detail-box item-detail-header">
        <img src="${escapeHTML(item.imageLink || item.iconLink)}" alt="${escapeHTML(item.name)}" loading="lazy">
        <div>
          <p><strong>Nom court :</strong> ${escapeHTML(item.shortName) || "N/A"}</p>
          <p><strong>Catégorie :</strong> ${escapeHTML(item.category?.name) || "Inconnu"}</p>
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
        <p>${escapeHTML(item.description) || "Aucune description"}</p>
      </div>
    </div>
  `;
}

/* =========================
   MAPS
========================= */

function showMaps(push = true) {
  currentSection = "maps";
  if (push) pushHistory("maps");
  setActiveNav("maps");
  searchInput.style.display = "none";
  searchInput.value = "";

  content.innerHTML = "<h2>Maps</h2>";

  mapsData.forEach(map => {
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => openMap(map);

    card.innerHTML = `
      <div class="map-preview">
        <img src="${escapeHTML(map.image)}" alt="${escapeHTML(map.name)}" loading="lazy">
      </div>
      <h3>${escapeHTML(map.name)}</h3>
      <p><strong>Difficulté :</strong> ${escapeHTML(map.difficulty)}</p>
      <p><strong>Boss :</strong> ${escapeHTML(map.boss)}</p>
    `;

    content.appendChild(card);
  });
}

function openMap(map, push = true) {
  currentSection = "map-detail";
  if (push) pushHistory("map-detail", { name: map.name });
  setActiveNav("maps");
  searchInput.style.display = "none";

  content.innerHTML = `
    <button class="back-btn" onclick="showMaps()">
      ← Retour
    </button>

    <div class="quest-detail">
      <h2>${escapeHTML(map.name)}</h2>

      <div class="detail-box">
        <p><strong>Difficulté :</strong> ${escapeHTML(map.difficulty)}</p>
        <p><strong>Boss :</strong> ${escapeHTML(map.boss)}</p>
        <p><strong>Utilité :</strong> ${escapeHTML(map.use)}</p>
      </div>

      <div class="detail-box">
        <h3>Extracts principales</h3>
        ${map.extracts.map(extract => `
          <div class="objective">${escapeHTML(extract)}</div>
        `).join("")}
      </div>
    </div>
  `;
}

/* =========================
   HIDEOUT
========================= */

async function showHideout(push = true) {
  currentSection = "hideout";
  if (push) pushHistory("hideout");
  setActiveNav("hideout");
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

function displayHideoutStations(stations, push = true) {
  if (push) pushHistory("hideout");
  setActiveNav("hideout");
  content.innerHTML = "<h2>Hideout</h2>";

  stations.forEach(station => {
    const progress = getHideoutStationProgress(station);

    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => displayHideoutDetails(station);

    card.innerHTML = `
      <h3>${escapeHTML(station.name)}</h3>
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
    <button class="back-btn" onclick="displayHideoutStations(allHideoutStations)">
      ← Retour
    </button>

    <div class="quest-detail">
      <h2>${escapeHTML(station.name)}</h2>

      <button
        class="favorite-btn"
        onclick='hideCompletedItems = !hideCompletedItems; displayHideoutDetails(allHideoutStations.find(s => s.id === "${escapeHTML(station.id)}"))'
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
                          ${req.item.iconLink ? `<img src="${escapeHTML(req.item.iconLink)}" alt="${escapeHTML(req.item.name)}" loading="lazy">` : ""}

                          <div class="hideout-progress">
                            <span class="hideout-item-name">${escapeHTML(req.item.name)}</span>

                            <div class="hideout-controls">
                              ${
                                maxAmount > 100
                                  ? `
                                    <button class="qty-btn small-btn" onclick='event.stopPropagation(); changeHideoutItem("${itemKey}", -10000, "${escapeHTML(station.id)}", ${maxAmount})'>-10k</button>
                                    <button class="qty-btn small-btn" onclick='event.stopPropagation(); changeHideoutItem("${itemKey}", -1000, "${escapeHTML(station.id)}", ${maxAmount})'>-1k</button>
                                  `
                                  : `
                                    <button class="qty-btn" onclick='event.stopPropagation(); changeHideoutItem("${itemKey}", -1, "${escapeHTML(station.id)}", ${maxAmount})'>-</button>
                                  `
                              }

                              <span class="qty-display" id="qty-${itemKey}">${currentAmount} / ${maxAmount}</span>

                              ${
                                maxAmount > 100
                                  ? `
                                    <button class="qty-btn small-btn" onclick='event.stopPropagation(); changeHideoutItem("${itemKey}", 1000, "${escapeHTML(station.id)}", ${maxAmount})'>+1k</button>
                                    <button class="qty-btn small-btn" onclick='event.stopPropagation(); changeHideoutItem("${itemKey}", 10000, "${escapeHTML(station.id)}", ${maxAmount})'>+10k</button>
                                  `
                                  : `
                                    <button class="qty-btn" onclick='event.stopPropagation(); changeHideoutItem("${itemKey}", 1, "${escapeHTML(station.id)}", ${maxAmount})'>+</button>
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

  if (hideoutItemProgress[itemKey] < 0) hideoutItemProgress[itemKey] = 0;
  if (hideoutItemProgress[itemKey] > max) hideoutItemProgress[itemKey] = max;

  saveHideoutProgress();

  // Mise à jour ciblée — on ne reconstruit pas toute la vue
  const display = document.getElementById(`qty-${itemKey}`);
  if (display) {
    display.textContent = `${hideoutItemProgress[itemKey]} / ${max}`;
  }
}

function saveHideoutProgress() {
  localStorage.setItem("hideoutItemProgress", JSON.stringify(hideoutItemProgress));
}

function getHideoutItemProgress(itemKey) {
  return hideoutItemProgress[itemKey] || 0;
}

/* =========================
   MARCHANDS
   Requête filtrée : on ne charge que le trader demandé
========================= */

async function showTraders(push = true) {
  currentSection = "traders";
  if (push) pushHistory("traders");
  setActiveNav("traders");
  searchInput.style.display = "none";
  searchInput.value = "";

  content.innerHTML = "<p>Chargement des marchands...</p>";

  const query = `
    {
      traders {
        id
        name
        imageLink
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
      content.innerHTML = "<p>Erreur API Marchands.</p>";
      return;
    }

    allTraders = result.data.traders;
    displayTraders(allTraders);

  } catch (error) {
    console.error(error);
    content.innerHTML = "<p>Impossible de charger les marchands.</p>";
  }
}

function displayTraders(traders, push = true) {
  if (push) pushHistory("traders");
  setActiveNav("traders");
  content.innerHTML = "<h2>Marchands</h2>";

  traders.forEach(trader => {
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => displayTraderDetails(trader);

    card.innerHTML = `
      <div class="item-card">
        ${trader.imageLink ? `<img src="${escapeHTML(trader.imageLink)}" alt="${escapeHTML(trader.name)}" loading="lazy">` : ""}
        <div>
          <h3>${escapeHTML(trader.name)}</h3>
          <p>Voir les objets et échanges</p>
        </div>
      </div>
    `;

    content.appendChild(card);
  });
}

async function displayTraderDetails(trader) {
  content.innerHTML = `
    <button class="back-btn" onclick="displayTraders(allTraders)">
      ← Retour
    </button>
    <p>Chargement des offres de ${escapeHTML(trader.name)}...</p>
  `;

  // OPTIMISATION : on filtre directement par ID côté API
  // L'ancienne version chargeait TOUS les traders pour n'en utiliser qu'un
  const query = `
    {
      traders(id: "${trader.id}") {
        id
        name
        cashOffers {
          item {
            id
            name
            iconLink
          }
          price
          currency
          minTraderLevel
        }
        barters {
          level
          requiredItems {
            count
            item {
              id
              name
              iconLink
            }
          }
          rewardItems {
            count
            item {
              id
              name
              iconLink
            }
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
      content.innerHTML = "<p>Erreur API offres marchand.</p>";
      return;
    }

    const fullTrader = result.data.traders[0];

    if (!fullTrader) {
      content.innerHTML = "<p>Marchand introuvable.</p>";
      return;
    }

    selectedTraderLevel = "all";
    traderViewMode = "sales";
    traderSearchValue = "";
    pendingTraderSearch = "";

    allTraders = allTraders.map(t => t.id === fullTrader.id ? fullTrader : t);

    displayTraderOffers(fullTrader);

  } catch (error) {
    console.error(error);
    content.innerHTML = "<p>Impossible de charger les offres.</p>";
  }
}

function displayTraderOffers(trader) {
  const search = traderSearchValue.toLowerCase();

  const filteredOffers = trader.cashOffers
    .filter(offer =>
      selectedTraderLevel === "all" ||
      offer.minTraderLevel === selectedTraderLevel
    )
    .filter(offer =>
      offer.item?.name?.toLowerCase().includes(search)
    );

  const filteredBarters = trader.barters
    .filter(barter =>
      selectedTraderLevel === "all" ||
      barter.level === selectedTraderLevel
    )
    .filter(barter => {
      const rewardMatch = barter.rewardItems?.some(r => r.item?.name?.toLowerCase().includes(search));
      const requiredMatch = barter.requiredItems?.some(r => r.item?.name?.toLowerCase().includes(search));
      return rewardMatch || requiredMatch;
    });

  content.innerHTML = `
    <button class="back-btn" onclick="displayTraders(allTraders)">
      ← Retour
    </button>

    <div class="quest-detail">
      <h2>${escapeHTML(trader.name)}</h2>

      <div class="trader-search-box">
        <input
          type="text"
          class="trader-search"
          placeholder="Rechercher un objet marchand..."
          value="${escapeHTML(pendingTraderSearch)}"
          oninput='pendingTraderSearch = this.value'
        />
        <button onclick='applyTraderSearch("${escapeHTML(trader.id)}")'>
          🔍 Recherche
        </button>
      </div>

      <div class="trader-tabs">
        <button onclick='setTraderViewMode("sales", "${escapeHTML(trader.id)}")'>🛒 Ventes</button>
        <button onclick='setTraderViewMode("barters", "${escapeHTML(trader.id)}")'>🔁 Échanges</button>
      </div>

      <div class="trader-filters">
        <button onclick='setTraderLevelFilter("all", "${escapeHTML(trader.id)}")'>Tous</button>
        <button onclick='setTraderLevelFilter(1, "${escapeHTML(trader.id)}")'>LL1</button>
        <button onclick='setTraderLevelFilter(2, "${escapeHTML(trader.id)}")'>LL2</button>
        <button onclick='setTraderLevelFilter(3, "${escapeHTML(trader.id)}")'>LL3</button>
        <button onclick='setTraderLevelFilter(4, "${escapeHTML(trader.id)}")'>LL4</button>
      </div>

      ${
        traderViewMode === "sales"
          ? `
            <div class="detail-box">
              <h3>Objets vendus</h3>
              ${
                filteredOffers?.length > 0
                  ? filteredOffers.slice(0, 100).map(offer => `
                      <div class="reward">
                        ${offer.item?.iconLink ? `<img src="${escapeHTML(offer.item.iconLink)}" alt="${escapeHTML(offer.item.name)}" loading="lazy">` : ""}
                        <span>
                          ${escapeHTML(offer.item?.name) || "Objet inconnu"}
                          <br>
                          ${offer.price || 0} ${escapeHTML(offer.currency) || ""}
                          ${offer.minTraderLevel ? ` - LL${offer.minTraderLevel}` : ""}
                        </span>
                      </div>
                    `).join("")
                  : "<p>Aucun objet trouvé.</p>"
              }
            </div>
          `
          : ""
      }

      ${
        traderViewMode === "barters"
          ? `
            <div class="detail-box">
              <h3>Échanges</h3>
              ${
                filteredBarters?.length > 0
                  ? filteredBarters.slice(0, 100).map(barter => `
                      <div class="barter-card">
                        <div class="barter-reward">
                          <strong>Reçoit :</strong>
                          ${
                            barter.rewardItems?.map(reward => `
                              <div class="reward">
                                ${reward.item?.iconLink ? `<img src="${escapeHTML(reward.item.iconLink)}" alt="${escapeHTML(reward.item.name)}" loading="lazy">` : ""}
                                <span>${reward.count} x ${escapeHTML(reward.item?.name) || "Objet inconnu"}</span>
                              </div>
                            `).join("")
                          }
                        </div>
                        <div class="barter-required">
                          <strong>Donne :</strong>
                          ${
                            barter.requiredItems?.map(required => `
                              <div class="reward">
                                ${required.item?.iconLink ? `<img src="${escapeHTML(required.item.iconLink)}" alt="${escapeHTML(required.item.name)}" loading="lazy">` : ""}
                                <span>${required.count} x ${escapeHTML(required.item?.name) || "Objet inconnu"}</span>
                              </div>
                            `).join("")
                          }
                        </div>
                        <p>LL${barter.level || "?"}</p>
                      </div>
                    `).join("")
                  : "<p>Aucun échange trouvé.</p>"
              }
            </div>
          `
          : ""
      }
    </div>
  `;
}

function setTraderViewMode(mode, traderId) {
  traderViewMode = mode;
  const trader = allTraders.find(t => t.id === traderId);
  if (trader) displayTraderOffers(trader);
}

function setTraderLevelFilter(level, traderId) {
  selectedTraderLevel = level;
  const trader = allTraders.find(t => t.id === traderId);
  if (trader) displayTraderOffers(trader);
}

function applyTraderSearch(traderId) {
  traderSearchValue = pendingTraderSearch;
  const trader = allTraders.find(t => t.id === traderId);
  if (trader) displayTraderOffers(trader);
}

/* =========================
   RECHERCHE ET OUTILS
========================= */

// Debounce appliqué : attend 250ms après la dernière frappe avant de filtrer
const handleSearch = debounce(() => {
  const value = searchInput.value.toLowerCase();

  if (currentSection === "quests") {
    const filteredTasks = allTasks.filter(task =>
      task.name.toLowerCase().includes(value)
    );
    displayQuests(filteredTasks);
  }

  if (currentSection === "items") {
    const filteredItems = allItems.filter(item =>
      item.name.toLowerCase().includes(value) ||
      item.shortName?.toLowerCase().includes(value)
    );
    displayItems(filteredItems);
  }

  if (currentSection === "ammo") {
    const filteredAmmo = allAmmo.filter(ammo =>
      ammo.item?.name?.toLowerCase().includes(value) ||
      ammo.item?.shortName?.toLowerCase().includes(value) ||
      ammo.caliber?.toLowerCase().includes(value)
    );
    displayAmmo(filteredAmmo);
  }
}, 250);

searchInput.addEventListener("input", handleSearch);

function getUnlockedTasks(taskId) {
  return allTasks.filter(otherTask =>
    otherTask.taskRequirements?.some(req => req.task?.id === taskId)
  );
}

function toggleSection(id) {
  const section = document.getElementById(id);
  section.style.display = section.style.display === "none" ? "block" : "none";
}

/* =========================
   FAVORIS
========================= */

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

function showFavorites(push = true) {
  currentSection = "favorites";
  if (push) pushHistory("favorites");
  setActiveNav("favorites");
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
      <h3>${escapeHTML(fav.name)}</h3>
      <p>${escapeHTML(fav.type)}</p>
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

/* =========================
   PROGRESSION KAPPA
========================= */

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
      <h3>
        ${completedTasks.includes(task.id) ? "✔ " : ""}
        ${escapeHTML(task.name)}
      </h3>
      <p>${escapeHTML(task.trader?.name) || "Inconnu"}</p>
    `;

    content.appendChild(card);
  });
}

/* =========================
   ACCUEIL
========================= */

function showHome(push = true) {
  currentSection = "home";
  if (push) pushHistory("home");
  setActiveNav("home");
  searchInput.style.display = "none";
  searchInput.value = "";

  const cachedTasks = loadFromCache("cachedTasks");
  if (cachedTasks) allTasks = cachedTasks;

  // OPTIMISATION : getKappaProgress() appelé une seule fois, résultat stocké
  const kappa = getKappaProgress();

  content.innerHTML = `
    <div class="home-screen">
      <div class="home-overlay">
        <h1>WikiTarkov</h1>
        <p class="subtitle">Companion App Escape From Tarkov</p>

        <div class="kappa-progress" onclick="showKappaTasks()">
          <h3>🟣 Progression Kappa</h3>
          <p>${kappa.completed} / ${kappa.total} quêtes</p>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${kappa.percent}%;"></div>
          </div>
          <span>${kappa.percent}%</span>
        </div>

        <div class="home-buttons">
          <button onclick="getQuests()">📋 Quêtes</button>
          <button onclick="showItems()">🎒 Objets</button>
          <button onclick="showMaps()">🗺 Maps</button>
          <button onclick="showHideout()">🏚 Hideout</button>
          <button onclick="showTraders()">💰 Marchands</button>
          <button onclick="showFavorites()">⭐ Favoris</button>
        </div>
      </div>
    </div>
  `;
}

/* =========================
   AMMO
   Cache ajouté (comme les quêtes et objets)
========================= */

async function showAmmo(push = true) {
  currentSection = "ammo";
  if (push) pushHistory("ammo");
  setActiveNav("ammo");
  searchInput.style.display = "block";
  searchInput.value = "";

  content.innerHTML = "<p>Chargement des munitions...</p>";

  const cachedAmmo = loadFromCache("cachedAmmo");

  if (cachedAmmo) {
    allAmmo = cachedAmmo;
    displayAmmo(allAmmo);
    return;
  }

  const query = `
    {
      ammo {
        item {
          id
          name
          shortName
          iconLink
        }
        caliber
        damage
        penetrationPower
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
      content.innerHTML = "<p>Erreur API munitions.</p>";
      return;
    }

    allAmmo = result.data.ammo;
    saveToCache("cachedAmmo", allAmmo);
    displayAmmo(allAmmo);

  } catch (error) {
    console.error(error);
    content.innerHTML = "<p>Impossible de charger les munitions.</p>";
  }
}

function getArmorClassInfo(pen) {
  if (pen >= 50) return { label: "Très efficace classe 5/6", className: "armor-red" };
  if (pen >= 40) return { label: "Efficace classe 4/5", className: "armor-orange" };
  if (pen >= 30) return { label: "Correct classe 3/4", className: "armor-yellow" };
  return { label: "Faible pénétration", className: "armor-green" };
}

function displayAmmo(ammoList, push = true) {
  if (push) pushHistory("ammo");
  setActiveNav("ammo");
  content.innerHTML = "<h2>Ammo / Ballistics</h2>";

  const calibers = [...new Set(allAmmo.map(a => a.caliber).filter(Boolean))].sort();

  content.innerHTML += `
    <div class="ammo-caliber-filter">
      <select onchange="setAmmoCaliberFilter(this.value)">
        <option value="all">Tous les calibres</option>
        ${calibers.map(caliber => `
          <option value="${escapeHTML(caliber)}" ${selectedAmmoCaliber === caliber ? "selected" : ""}>
            ${escapeHTML(caliber)}
          </option>
        `).join("")}
      </select>
    </div>
    <div class="trader-filters"></div>
  `;

  ammoList
    .filter(ammo => ammo.penetrationPower >= selectedAmmoPen)
    .filter(ammo => selectedAmmoCaliber === "all" || ammo.caliber === selectedAmmoCaliber)
    .sort((a, b) => b.penetrationPower - a.penetrationPower)
    .forEach(ammo => {
      const armorInfo = getArmorClassInfo(ammo.penetrationPower || 0);
      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <div class="item-card">
          ${ammo.item?.iconLink ? `<img src="${escapeHTML(ammo.item.iconLink)}" alt="${escapeHTML(ammo.item.name)}" loading="lazy">` : ""}
          <div>
            <h3>${escapeHTML(ammo.item?.name) || "Munition inconnue"}</h3>
            <p><strong>Calibre :</strong> ${escapeHTML(ammo.caliber) || "N/A"}</p>
            <p><strong>Dégâts :</strong> ${ammo.damage || 0}</p>
            <p><strong>Pénétration :</strong> ${ammo.penetrationPower || 0}</p>
            <p><strong>Classe armure :</strong> <span class="${armorInfo.className}">${armorInfo.label}</span></p>
          </div>
        </div>
      `;

      content.appendChild(card);
    });
}

function setAmmoPenFilter(value) {
  selectedAmmoPen = value;
  displayAmmo(allAmmo);
}

function setAmmoCaliberFilter(caliber) {
  selectedAmmoCaliber = caliber;
  displayAmmo(allAmmo);
}

/* =========================
   SERVICE WORKER
========================= */

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("service-worker.js")
    .then(() => console.log("Service Worker enregistré"))
    .catch(error => console.error("SW erreur :", error));
}

/* =========================
   DÉMARRAGE
========================= */

// Remplace l'état initial vide par un état "home" pour que popstate fonctionne
history.replaceState({ section: "home" }, "", "#home");
showHome(false);