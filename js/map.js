/* ============================================================
   AMAN PATROL — Area Map.
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
  var layers = {};       // id -> { group, on, label, accent }
  var tileErrors = 0;
  var addPinMode = false;
  var onAddPinCb = null;

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

  function buildLayers() {
    var A = window.AREA;
    var S = window.AmanStore;

    function mk(id, label, accent, def) {
      layers[id] = { group: L.layerGroup(), on: !!def, label: label, accent: !!accent };
    }

    // masjids
    mk("masjids", "Masjids", true, true);
    (A.masjids || []).forEach(function (m) {
      L.marker([m.lat, m.lng], { icon: pinIcon("#0e9f9f", "mosque") })
        .bindPopup("<b>" + esc(m.name) + "</b><br>Place of worship (Muslim)<br><i>Coordinator to confirm which two masjids serve Greenside &amp; Emmarentia.</i>" + srcTag())
        .addTo(layers.masjids.group);
    });

    // schools (off by default to avoid clutter)
    mk("schools", "Schools", false, false);
    (A.schools || []).forEach(function (s) {
      L.marker([s.lat, s.lng], { icon: pinIcon("#13294b", "school") })
        .bindPopup("<b>" + esc(s.name) + "</b><br>School" + srcTag())
        .addTo(layers.schools.group);
    });

    // parks / green (off by default)
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

    // businesses (off by default — keeps the first view calm)
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
    // Only attach uncluttered, essential safety layers
    Object.keys(layers).forEach(function (id) {
      if (layers[id].on) {
        layers[id].group.addTo(map);
      }
    });
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
    map = L.map(el, { zoomControl: true, attributionControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
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

    // pending focus (e.g. "view on map" from an incident)
    if (window.__amanMapFocus) {
      var f = window.__amanMapFocus;
      window.__amanMapFocus = null;
      setTimeout(function () { map.setView([f.lat, f.lng], 17, { animate: true }); }, 250);
      if (f.marker) {
        L.circleMarker([f.lat, f.lng], { radius: 14, color: "#dc2626", weight: 3, fillOpacity: 0.15 })
          .addTo(map);
      }
    }
    setTimeout(function () { map.invalidateSize(); }, 150);
  }

  function destroy() {
    if (map) { map.remove(); map = null; }
    layers = {};
    addPinMode = false;
    tileErrors = 0;
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
    focus: function (lat, lng, marker) {
      window.__amanMapFocus = { lat: lat, lng: lng, marker: !!marker };
      if (map) { map.setView([lat, lng], 17); window.__amanMapFocus = null; }
    }
  };
})();