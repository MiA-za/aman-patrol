/* ============================================================
   AMAN PATROL — Area Map.
   - Multi-layer base maps: Streets, Satellite (Aerial), CSS-filtered Night
   - Zone A (Greenside) & Zone B (Emmarentia) boundary outlines
   - One-tap "Locate Me" live GPS tracking
   - Real layers from OpenStreetMap (via Overpass snapshot in data.js)
   - Custom coordinator pins (dark spots, risk corners, madrassah corridors…)
   - Recent incidents from the store
   ============================================================ */
(function () {
  "use strict";

  function esc(s) {
    return String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var map = null;
  var currentTileLayer = null;
  var currentBaseMap = "streets";
  var layers = {};       // id -> { group, on, label, accent }
  var tileErrors = 0;
  var addPinMode = false;
  var onAddPinCb = null;
  var userLocationMarker = null;
  var userAccuracyCircle = null;

  var BASE_TILES = {
    streets: {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      opts: { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
      label: "Default Streets"
    },
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      opts: { maxZoom: 19, attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, GIS User Community" },
      label: "Satellite Aerial"
    },
    dark: {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      opts: {
        maxZoom: 19,
        className: "night-map-tiles",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      },
      label: "Night / Dark"
    }
  };

  var ZONE_BOUNDARIES = {
    "Zone A – Greenside": {
      coords: [
        [-26.1425, 28.0078],
        [-26.1438, 28.0210],
        [-26.1518, 28.0248],
        [-26.1605, 28.0215],
        [-26.1578, 28.0089],
        [-26.1488, 28.0082]
      ],
      color: "#0e9f9f",
      label: "Zone A — Greenside",
      center: [-26.1515, 28.0150]
    },
    "Zone B – Emmarentia": {
      coords: [
        [-26.1436, 28.0072],
        [-26.1492, 28.0078],
        [-26.1576, 28.0082],
        [-26.1685, 28.0125],
        [-26.1668, 27.9942],
        [-26.1532, 27.9935],
        [-26.1448, 27.9978]
      ],
      color: "#13294b",
      label: "Zone B — Emmarentia",
      center: [-26.1550, 28.0020]
    }
  };

  function pinIcon(color, glyph, letter) {
    var inner = letter
      ? '<span style="transform:rotate(45deg);font-weight:900;font-size:12px;color:#fff">' + letter + "</span>"
      : "<span>" + window.AmanUI.I(glyph, 14) + "</span>";
    return L.divIcon({
      className: "",
      html: '<div class="pin" style="background:' + color + '">' + inner + "</div>",
      iconSize: [30, 30], iconAnchor: [15, 28], popupAnchor: [0, -26]
    });
  }

  function dotIcon(color) {
    return L.divIcon({ className: "", html: '<div class="dot" style="background:' + color + '"></div>', iconSize: [12, 12], iconAnchor: [6, 6] });
  }

  function srcTag() { return '<div style="margin-top:6px;font-size:0.66rem;color:#8b98ab">Source: OpenStreetMap contributors</div>'; }

  function applyMapAppearance() {
    var wrapper = document.querySelector(".map-wrap");
    if (!wrapper) return;
    wrapper.classList.toggle("map-night", currentBaseMap === "dark");
    wrapper.classList.toggle("map-satellite", currentBaseMap === "satellite");
    wrapper.classList.toggle("map-theme-dark", document.documentElement.getAttribute("data-theme") === "dark");
  }

  function setBaseMap(type) {
    if (!BASE_TILES[type] || !map) return;
    currentBaseMap = type;
    tileErrors = 0;
    try { localStorage.setItem("aman_map_basemap", type); } catch (e) {}
    if (currentTileLayer) {
      map.removeLayer(currentTileLayer);
    }
    var cfg = BASE_TILES[type];
    currentTileLayer = L.tileLayer(cfg.url, cfg.opts).addTo(map);
    applyMapAppearance();
  }

  function buildLayers() {
    var A = window.AREA;
    var S = window.AmanStore;

    function mk(id, label, accent, def) {
      var saved = null;
      try { saved = localStorage.getItem("aman_layer_" + id); } catch (e) {}
      var isOn = saved !== null ? saved === "1" : !!def;
      layers[id] = { group: L.layerGroup(), on: isOn, label: label, accent: !!accent };
    }

    // sector / zone boundaries
    mk("zones", "Sector boundaries (Zones A & B)", true, true);
    for (var zKey in ZONE_BOUNDARIES) {
      var z = ZONE_BOUNDARIES[zKey];
      L.polygon(z.coords, {
        color: z.color,
        weight: 3.5,
        opacity: 0.85,
        fillColor: z.color,
        fillOpacity: 0.08,
        dashArray: "6, 6"
      }).bindPopup("<b>" + esc(z.label) + "</b><br>Official Community Watch Sector Boundary").addTo(layers.zones.group);

      L.marker(z.center, {
        icon: L.divIcon({
          className: "",
          html: '<div class="zone-label-badge" style="background:' + z.color + '">' + esc(z.label.split(" — ")[0]) + '</div>',
          iconSize: [70, 22], iconAnchor: [35, 11]
        })
      }).bindPopup("<b>" + esc(z.label) + "</b><br>Observe and report only — never patrol alone.").addTo(layers.zones.group);
    }

    // masjids
    mk("masjids", "Masjids", true, true);
    (A.masjids || []).forEach(function (m) {
      L.marker([m.lat, m.lng], { icon: pinIcon("#0e9f9f", "mosque") })
        .bindPopup("<b>" + esc(m.name) + "</b><br>Place of worship (Muslim)<br><i>Coordinator to confirm which two masjids serve Greenside &amp; Emmarentia.</i>" + srcTag())
        .addTo(layers.masjids.group);
    });

    // schools
    mk("schools", "Schools", false, false);
    (A.schools || []).forEach(function (s) {
      L.marker([s.lat, s.lng], { icon: pinIcon("#13294b", "school") })
        .bindPopup("<b>" + esc(s.name) + "</b><br>School" + srcTag())
        .addTo(layers.schools.group);
    });

    // parks / green
    mk("parks", "Parks & green", false, false);
    (A.parks || []).forEach(function (p) {
      L.marker([p.lat, p.lng], { icon: pinIcon("#16a34a", "tree") })
        .bindPopup("<b>" + esc(p.name) + "</b><br>" + esc((p.kind || "park").replace("_", " ")) + srcTag())
        .addTo(layers.parks.group);
    });

    // police
    mk("police", "Police", true, true);
    (A.police || []).forEach(function (p) {
      L.marker([p.lat, p.lng], { icon: pinIcon("#2563eb", "shield_star") })
        .bindPopup("<b>" + esc(p.name) + "</b><br>SAPS police station" + srcTag())
        .addTo(layers.police.group);
    });

    // businesses
    mk("businesses", "Businesses", false, false);
    (A.businesses || []).forEach(function (b) {
      L.marker([b.lat, b.lng], { icon: dotIcon("#d97706") })
        .bindPopup("<b>" + esc(b.name) + "</b><br>" + esc(b.kind) + srcTag())
        .addTo(layers.businesses.group);
    });

    // main roads / arterials
    mk("roads", "Main roads", false, false);
    var ROAD_STYLE = {
      primary: { color: "#3f4c63", weight: 4.5, opacity: 0.9 },
      secondary: { color: "#5b6b82", weight: 3.5, opacity: 0.85 },
      tertiary: { color: "#8496ad", weight: 2.5, opacity: 0.8 }
    };
    (A.roads || []).forEach(function (r) {
      L.polyline(r.coords, ROAD_STYLE[r.cls] || ROAD_STYLE.tertiary)
        .bindPopup("<b>" + esc(r.name) + "</b><br>Main road / arterial — patrol approach &amp; escape route" + srcTag())
        .addTo(layers.roads.group);
    });

    // key intersections (traffic signals)
    mk("signals", "Intersections", false, false);
    (A.signals || []).forEach(function (s) {
      L.circleMarker([s.lat, s.lng], { radius: 3.5, color: "#fff", weight: 1, fillColor: "#5d6c82", fillOpacity: 0.95 })
        .bindPopup("Key intersection (traffic signals)" + srcTag())
        .addTo(layers.signals.group);
    });

    // custom coordinator pins
    mk("pins", "Custom pins", true, true);
    refreshPinLayer();

    // incidents
    mk("incidents", "Incidents", false, true);
    refreshIncidentLayer();

    // live on-duty patrollers
    mk("patrollers", "On-duty patrollers", true, true);
    refreshPatrollersLayer();
  }

  function refreshPatrollersLayer() {
    if (!layers.patrollers) return;
    layers.patrollers.group.clearLayers();
    var S = window.AmanStore;
    var list = S.listLiveLocations ? S.listLiveLocations() : [];
    list.forEach(function (p) {
      var u = S.userById ? S.userById(p.user_id) : null;
      var name = u ? (u.first_name + " " + (u.surname ? u.surname[0] + "." : "")) : "Patroller";
      var icon = L.divIcon({
        className: "",
        html: '<div class="patroller-pin"><div class="patroller-pulse"></div><div class="patroller-dot">' + window.AmanUI.I("shield", 12) + '</div></div>',
        iconSize: [28, 28], iconAnchor: [14, 14]
      });
      L.marker([p.lat, p.lng], { icon: icon })
        .bindPopup("<b>" + esc(name) + "</b><br>On-duty patroller (Live GPS active)<br><span style=\'font-size:0.7rem;color:#8b98ab\'>Accuracy: ±" + (p.accuracy || 10) + "m</span>")
        .addTo(layers.patrollers.group);
    });
  }

  function refreshPinLayer() {
    if (!layers.pins) return;
    layers.pins.group.clearLayers();
    var S = window.AmanStore;
    var TYPE = {
      dark_spot: { color: "#1e293b", glyph: "moon", label: "Dark spot" },
      risk_corner: { color: "#dc2626", glyph: "alert", label: "Known risk corner" },
      madrassah_corridor: { color: "#0e9f9f", glyph: "users", label: "Madrassah walking corridor" },
      recent_incident: { color: "#ea580c", glyph: "pin", label: "Recent incident location" },
      other: { color: "#5d6c82", glyph: "pin", label: "Coordinator pin" }
    };
    S.pins().forEach(function (p) {
      var t = TYPE[p.type] || TYPE.other;
      var del = "";
      var u = S.sessionUser();
      if (u && u.role === "coordinator") {
        del = '<br><button class="link-btn" style="padding:2px 0" onclick="AmanApp.deletePin(\'' + p.id + '\')">Remove pin</button>';
      }
      L.marker([p.lat, p.lng], { icon: pinIcon(t.color, t.glyph) })
        .bindPopup("<b>" + esc(p.label) + "</b><br>" + t.label + " — coordinator-confirmed" + del)
        .addTo(layers.pins.group);
    });
  }

  function refreshIncidentLayer() {
    if (!layers.incidents) return;
    layers.incidents.group.clearLayers();
    var S = window.AmanStore;
    S.incidents().forEach(function (i) {
      if (i.gps_lat === null || i.gps_lat === undefined) return;
      var letter = i.category.indexOf("Vehicle") !== -1 ? "V" : (i.category.indexOf("Person") !== -1 ? "P" : "I");
      L.marker([i.gps_lat, i.gps_lng], { icon: pinIcon("#dc2626", "", letter) })
        .bindPopup(
          "<b>" + esc(i.category) + "</b><br>" +
          (i.location_address ? esc(i.location_address) + "<br>" : "") +
          "Status: <b>" + esc(i.status) + "</b> · " + esc(S.fmtDateTime(i.created_at)) +
          '<br><button class="link-btn" style="padding:2px 0" onclick="AmanApp.viewIncident(\'' + i.id + '\')">View details</button>'
        )
        .addTo(layers.incidents.group);
    });
  }

  var currentRouteLayer = null;
  function routeTo(destLat, destLng, destTitle) {
    if (!map) return;
    var userGps = (window.AmanLiveTracking && window.AmanLiveTracking.lat)
      ? { lat: window.AmanLiveTracking.lat, lng: window.AmanLiveTracking.lng }
      : window.AREA.center;
    var url = "https://router.project-osrm.org/route/v1/driving/" +
      userGps.lng + "," + userGps.lat + ";" + destLng + "," + destLat +
      "?overview=full&geometries=geojson";
    
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.routes || !data.routes[0]) throw new Error("No route found");
        var route = data.routes[0];
        var distKm = (route.distance / 1000).toFixed(1);
        var durMin = Math.round(route.duration / 60);
        if (currentRouteLayer) { map.removeLayer(currentRouteLayer); }
        currentRouteLayer = L.geoJSON(route.geometry, {
          style: { color: "#0e9f9f", weight: 5, opacity: 0.9, dashArray: "6, 6" }
        }).addTo(map);
        map.fitBounds(currentRouteLayer.getBounds(), { padding: [40, 40] });
        setNote("Route to " + esc(destTitle || "destination") + ": " + distKm + " km · ~" + durMin + " min. Observe and report only.");
      })
      .catch(function () {
        if (currentRouteLayer) { map.removeLayer(currentRouteLayer); }
        currentRouteLayer = L.polyline([[userGps.lat, userGps.lng], [destLat, destLng]], {
          color: "#0e9f9f", weight: 4, dashArray: "6, 6"
        }).addTo(map);
        map.fitBounds(currentRouteLayer.getBounds(), { padding: [40, 40] });
        setNote("Direct route to " + esc(destTitle || "destination") + " plotted.");
      });
  }

  function renderToolbar() {
    Object.keys(layers).forEach(function (id) {
      if (layers[id].on) {
        layers[id].group.addTo(map);
      } else {
        map.removeLayer(layers[id].group);
      }
    });
  }

  function locateUser() {
    if (!map) return;
    var btn = document.getElementById("map-locate-btn");
    if (btn) btn.classList.add("locating");
    setNote("Acquiring high-accuracy GPS position…");

    if (!navigator.geolocation) {
      if (btn) btn.classList.remove("locating");
      window.AmanUI.toast("Geolocation is not supported on this device.", "error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        if (btn) btn.classList.remove("locating");
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;
        var acc = Math.round(pos.coords.accuracy || 10);

        if (userLocationMarker) map.removeLayer(userLocationMarker);
        if (userAccuracyCircle) map.removeLayer(userAccuracyCircle);

        userAccuracyCircle = L.circle([lat, lng], {
          radius: Math.max(acc, 15),
          color: "#0e9f9f",
          weight: 1.5,
          fillColor: "#0e9f9f",
          fillOpacity: 0.15
        }).addTo(map);

        userLocationMarker = L.circleMarker([lat, lng], {
          radius: 8,
          color: "#ffffff",
          weight: 3,
          fillColor: "#0e9f9f",
          fillOpacity: 1
        }).bindPopup("<b>Your Current Position</b><br>Accuracy: ±" + acc + "m").addTo(map);

        map.setView([lat, lng], 17, { animate: true });
        setNote("Centered on your live GPS position (accuracy ±" + acc + "m).");
        window.AmanUI.toast("Position located (±" + acc + "m)", "ok");
      },
      function (err) {
        if (btn) btn.classList.remove("locating");
        setNote("Could not get GPS position: " + err.message);
        window.AmanUI.toast("Unable to get current GPS location.", "warn");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function openLayersModal() {
    var baseOptions = [
      { id: "streets", label: "Default Streets", icon: "map" },
      { id: "satellite", label: "Satellite Aerial", icon: "camera" },
      { id: "dark", label: "Night / Dark", icon: "moon" }
    ];

    var overlays = [
      { id: "zones", label: "Sector Boundaries (Zones A & B)" },
      { id: "pins", label: "Coordinator Risk Pins & Dark Spots" },
      { id: "incidents", label: "Active Incident Locations" },
      { id: "patrollers", label: "On-Duty Patrollers (Live GPS)" },
      { id: "masjids", label: "Masjids & Places of Worship" },
      { id: "schools", label: "Schools" },
      { id: "parks", label: "Parks & Green Areas" },
      { id: "police", label: "SAPS Police Stations" },
      { id: "roads", label: "Main Arterial Roads" },
      { id: "signals", label: "Key Intersections" }
    ];

    var baseCardsHtml = '<div class="layer-choice-grid">' + baseOptions.map(function (b) {
      var active = b.id === currentBaseMap ? " active" : "";
      return '<div class="layer-card' + active + '" data-base-choice="' + b.id + '">' +
        '<div>' + window.AmanUI.I(b.icon, 20) + '</div>' +
        '<div style="margin-top:4px">' + esc(b.label) + '</div></div>';
    }).join("") + '</div>';

    var overlaysHtml = overlays.map(function (o) {
      var isChecked = layers[o.id] && layers[o.id].on ? " checked" : "";
      return '<label class="check plain" style="margin-bottom:6px">' +
        '<input type="checkbox" data-overlay-toggle="' + o.id + '"' + isChecked + '> ' +
        '<span>' + esc(o.label) + '</span></label>';
    }).join("");

    window.AmanUI.modal(
      "<h3>" + window.AmanUI.I("layers", 18) + " Map Layers &amp; Overlays</h3>" +
      '<p class="m-sub">Switch map styling and choose operational safety overlays.</p>' +
      '<h4 style="font-size:0.84rem;margin:8px 0 6px">Base Map Style</h4>' +
      baseCardsHtml +
      '<h4 style="font-size:0.84rem;margin:12px 0 6px">Operational Overlays</h4>' +
      '<div style="max-height:220px;overflow-y:auto;padding-right:4px">' + overlaysHtml + '</div>' +
      '<div class="m-actions"><button class="btn btn-primary" data-close>Done</button></div>',
      function (root) {
        root.querySelectorAll("[data-base-choice]").forEach(function (card) {
          card.onclick = function () {
            var choice = card.getAttribute("data-base-choice");
            setBaseMap(choice);
            root.querySelectorAll("[data-base-choice]").forEach(function (c) { c.classList.remove("active"); });
            card.classList.add("active");
          };
        });

        root.querySelectorAll("[data-overlay-toggle]").forEach(function (chk) {
          chk.onchange = function () {
            var lid = chk.getAttribute("data-overlay-toggle");
            if (layers[lid]) {
              layers[lid].on = chk.checked;
              try { localStorage.setItem("aman_layer_" + lid, chk.checked ? "1" : "0"); } catch (e) {}
              renderToolbar();
            }
          };
        });
      }
    );
  }

  function startAddPin() {
    addPinMode = !addPinMode;
    document.getElementById("map").style.cursor = addPinMode ? "crosshair" : "";
    setNote(addPinMode
      ? "Tap the map where the pin should go (dark spot, risk corner, madrassah corridor…)."
      : null);
    var b = document.getElementById("add-pin-btn");
    if (b) b.classList.toggle("on", addPinMode);
  }

  function setNote(msg) {
    var el = document.getElementById("map-note");
    if (!el) return;
    var A = window.AREA;
    var base = "Real area data © OpenStreetMap contributors (snapshot " + (A.meta && A.meta.snapshot) +
      ") · street tiles & weather need internet · pins are coordinator-confirmed";
    el.innerHTML = msg ? esc(msg) : base;
  }

  function mount(opts) {
    opts = opts || {};
    var el = document.getElementById("map");
    if (!el || !window.L) return;
    map = L.map(el, { zoomControl: false, attributionControl: true });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    try {
      var savedBase = localStorage.getItem("aman_map_basemap");
      if (savedBase && BASE_TILES[savedBase]) currentBaseMap = savedBase;
    } catch (e) {}

    setBaseMap(currentBaseMap);

    map.on("tileerror", function () {
      tileErrors++;
      if (tileErrors === 3) setNote("Map tiles can't load right now (no internet connection). Marker data still shown. Open this app with internet access to see the street map.");
    });

    var A = window.AREA;
    map.fitBounds(A.fitBounds || [[-26.168, 27.976], [-26.136, 28.026]]);

    buildLayers();
    renderToolbar();
    setNote(null);

    map.on("click", function (e) {
      if (addPinMode && onAddPinCb) {
        addPinMode = false;
        document.getElementById("map").style.cursor = "";
        renderToolbar();
        setNote(null);
        onAddPinCb(e.latlng.lat, e.latlng.lng);
      }
    });

    if (window.__amanMapFocus) {
      var f = window.__amanMapFocus;
      window.__amanMapFocus = null;
      setTimeout(function () { map.setView([f.lat, f.lng], 17, { animate: true }); }, 250);
      if (f.marker) {
        L.circleMarker([f.lat, f.lng], { radius: 14, color: "#dc2626", weight: 3, fillOpacity: 0.15 })
          .addTo(map);
      }
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { if (map) map.invalidateSize(); });
    });
    setTimeout(function () { if (map) map.invalidateSize(); }, 300);
  }

  function destroy() {
    if (map) { map.remove(); map = null; }
    layers = {};
    addPinMode = false;
    tileErrors = 0;
    userLocationMarker = null;
    userAccuracyCircle = null;
    currentTileLayer = null;
  }

  window.AmanMap = {
    mount: mount,
    destroy: destroy,
    refreshPins: refreshPinLayer,
    refreshIncidents: refreshIncidentLayer,
    refreshPatrollers: refreshPatrollersLayer,
    routeTo: routeTo,
    setAddPinHandler: function (fn) { onAddPinCb = fn; },
    startAddPin: startAddPin,
    locateUser: locateUser,
    openLayersModal: openLayersModal,
    setBaseMap: setBaseMap,
    syncTheme: function () { applyMapAppearance(); },
    focus: function (lat, lng, marker) {
      window.__amanMapFocus = { lat: lat, lng: lng, marker: !!marker };
      if (map) { map.setView([lat, lng], 17); window.__amanMapFocus = null; }
    }
  };
})();
