// csun map quiz — project 5
// isaiah bernal

// five locations: 4 chosen + my assigned one (asian american activities center)
var locations = [
  { name: "Asian American Activities Center", lat: 34.24285, lng: -118.52998, radius: 55 },
  { name: "University Library",               lat: 34.24175, lng: -118.52802, radius: 60 },
  { name: "Jacaranda Hall",                   lat: 34.24060, lng: -118.52666, radius: 55 },
  { name: "Student Recreation Center",        lat: 34.23955, lng: -118.52606, radius: 65 },
  { name: "Manzanita Hall",                   lat: 34.24378, lng: -118.52758, radius: 55 }
];

// dark style rules array — plain JS, safe to define before google loads
var darkStyleRules = [
  { elementType: "geometry",            stylers: [{ color: "#1a1a1f" }] },
  { elementType: "labels.text.fill",    stylers: [{ color: "#8888aa" }] },
  { elementType: "labels.text.stroke",  stylers: [{ color: "#0d0d0f" }] },
  { elementType: "labels.icon",         stylers: [{ visibility: "off" }] },
  { featureType: "road",         elementType: "geometry",        stylers: [{ color: "#2e2e3a" }] },
  { featureType: "road",         elementType: "geometry.stroke", stylers: [{ color: "#111114" }] },
  { featureType: "road.highway", elementType: "geometry",        stylers: [{ color: "#3a3a48" }] },
  { featureType: "road.local",   elementType: "labels",          stylers: [{ visibility: "on"  }] },
  { featureType: "water",        elementType: "geometry",        stylers: [{ color: "#0a0a10" }] },
  { featureType: "poi",          elementType: "geometry",        stylers: [{ color: "#16161e" }] },
  { featureType: "poi",          elementType: "labels",          stylers: [{ visibility: "off" }] },
  { featureType: "poi.park",     elementType: "geometry",        stylers: [{ color: "#131a13" }] },
  { featureType: "poi.school",   elementType: "geometry",        stylers: [{ color: "#1a1a28" }] },
  { featureType: "poi.school",   elementType: "labels",          stylers: [{ visibility: "on"  }] },
  { featureType: "transit",                    elementType: "geometry",        stylers: [{ color: "#1a1a22" }] },
  { featureType: "administrative",             elementType: "geometry.stroke", stylers: [{ color: "#2a2a3a" }] },
  { featureType: "administrative.land_parcel", elementType: "labels",          stylers: [{ visibility: "off" }] }
];

var map;
var currentIndex   = 0;
var score          = 0;
var drawnRects     = [];
var timerInterval;
var elapsedSeconds = 0;
var gameActive     = false;

// initMap is called by the google maps script tag once the API is ready
function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 34.2416, lng: -118.5280 },
    zoom: 17,
    disableDefaultUI: true,
    disableDoubleClickZoom: true,
    keyboardShortcuts: false,
    clickableIcons: false
  });

  // google.maps.StyledMapType — registers a fully custom named map style
  // docs: https://developers.google.com/maps/documentation/javascript/examples/maptype-styled-simple
  var csunDarkStyle = new google.maps.StyledMapType(darkStyleRules, { name: "CSUN Dark" });
  map.mapTypes.set("csun_dark", csunDarkStyle);

  // map.setOptions() — applies config changes to an existing map instance.
  // used here to activate our StyledMapType and also later in drawRect()
  // to animate rectangle opacity without recreating the overlay.
  // docs: https://developers.google.com/earth-engine/apidocs/map-setoptions
  map.setOptions({ mapTypeId: "csun_dark" });

  // dblclick listener — fires after disableDoubleClickZoom kills the zoom behavior
  // so the event reaches our handler instead of being consumed by the map
  google.maps.event.addListener(map, "dblclick", function(event) {
    handleClick(event.latLng);
  });

  startGame();
}

function startGame() {
  currentIndex   = 0;
  score          = 0;
  elapsedSeconds = 0;
  gameActive     = true;

  drawnRects.forEach(function(r) { r.setMap(null); });
  drawnRects = [];

  $("#answer-log").empty();
  $("#score-screen").hide();
  $("#prompt-section").show();
  $("#log-section").show();

  updateCounter();
  showQuestion();
  startTimer();
}

function showQuestion() {
  if (currentIndex >= locations.length) {
    endGame();
    return;
  }

  var loc = locations[currentIndex];

  $("#prompt-section").addClass("flash");
  setTimeout(function() { $("#prompt-section").removeClass("flash"); }, 400);
  $("#prompt-name").css({ opacity: 0 }).text(loc.name).animate({ opacity: 1 }, 200);

  updateCounter();

  var entry = $("<div>").addClass("log-entry pending");
  entry.append($("<span>").addClass("log-icon").text("?"));
  entry.append($("<span>").text((currentIndex + 1) + ". " + loc.name));
  entry.attr("id", "log-entry-" + currentIndex);
  $("#answer-log").append(entry);
}

function handleClick(latLng) {
  if (!gameActive) return;

  var target       = locations[currentIndex];
  var targetLatLng = new google.maps.LatLng(target.lat, target.lng);

  // computeDistanceBetween measures straight-line meters between two LatLng points
  var distance = google.maps.geometry.spherical.computeDistanceBetween(latLng, targetLatLng);
  var correct  = distance <= target.radius;

  if (correct) score++;

  drawRect(target, correct);
  updateLogEntry(currentIndex, target.name, correct, Math.round(distance));

  currentIndex++;
  showQuestion();
}

function updateLogEntry(index, name, correct, dist) {
  var entry = $("#log-entry-" + index);
  entry.removeClass("pending").addClass(correct ? "correct" : "wrong");
  entry.empty();

  entry.append($("<span>").addClass("log-icon").text(correct ? "+" : "x"));
  entry.append($("<span>").text((index + 1) + ". " + (correct ? name : name + " (" + dist + "m off)")));
}

// draws a rectangle at the correct location — green if right, red if wrong.
// rect.setOptions() animates the fill opacity without recreating the overlay
function drawRect(target, correct) {
  var offset = 0.00025;
  var color  = correct ? "#4caf50" : "#ff4d4d";

  var rect = new google.maps.Rectangle({
    bounds: {
      north: target.lat + offset,
      south: target.lat - offset,
      east:  target.lng + offset,
      west:  target.lng - offset
    },
    map:           map,
    strokeColor:   color,
    strokeWeight:  2,
    strokeOpacity: 1,
    fillColor:     color,
    fillOpacity:   0.35
  });

  var fading = false;
  var pulse  = setInterval(function() {
    fading = !fading;
    rect.setOptions({ fillOpacity: fading ? 0.1 : 0.35 });
  }, 450);

  setTimeout(function() {
    clearInterval(pulse);
    rect.setOptions({ fillOpacity: 0.35 });
  }, 2000);

  drawnRects.push(rect);
}

function updateCounter() {
  $("#q-current").text(Math.min(currentIndex + 1, locations.length));
  $("#q-total").text(locations.length);
}

function endGame() {
  gameActive = false;
  clearInterval(timerInterval);

  var wrong = locations.length - score;

  $("#prompt-section").hide();
  $("#log-section").hide();
  $("#score-correct").text(score);
  $("#score-breakdown").text(score + " correct, " + wrong + " wrong");
  $("#score-time-final").text("finished in " + formatTime(elapsedSeconds));
  $("#score-screen").css("display", "flex");
}

function startTimer() {
  clearInterval(timerInterval);
  elapsedSeconds = 0;
  updateTimerDisplay();
  timerInterval = setInterval(function() {
    elapsedSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function updateTimerDisplay() {
  $("#timer-display").text(formatTime(elapsedSeconds));
}

function formatTime(s) {
  var m = Math.floor(s / 60);
  var sec = s % 60;
  return m + ":" + (sec < 10 ? "0" : "") + sec;
}

$("#restart-btn").on("click", function() {
  startGame();
});
