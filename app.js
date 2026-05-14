// csun map quiz — project 5
// isaiah bernal
//
// the game asks the user to double click where they think five csun buildings are.
// after each guess it draws a rectangle over the correct spot and logs the result.
// at the end it shows the total score and elapsed time.


// ─── locations ────────────────────────────────────────────────────────────────
// each object holds the building name, lat/lng center, and a tolerance radius.
// to verify/fix coordinates: open the page, right-click anywhere on the map,
// and the exact lat/lng logs to the console. use that to pin each building.
// my assigned location from the project sheet is the asian american activities center.

var locations = [
  // coordinates computed from the official csun campus map grid (fall 2025 pdf)
  // grid anchors: Reseda Blvd=col A west, Lindley Ave=col G east,
  //               Plummer St=row 1 north, Nordhoff St=row 13 south
  // (main campus runs Plummer to Nordhoff, not Devonshire — previous version was wrong)
  { name: "Asian American Activities Center", lat: 34.24254, lng: -118.53000, radius: 65 },
  { name: "University Library",               lat: 34.24362, lng: -118.52760, radius: 65 },
  { name: "Jacaranda Hall",                   lat: 34.24308, lng: -118.52640, radius: 65 },
  { name: "Student Recreation Center",        lat: 34.24362, lng: -118.52400, radius: 65 },
  { name: "Manzanita Hall",                   lat: 34.24469, lng: -118.52760, radius: 65 }
];


// ─── dark map style rules ─────────────────────────────────────────────────────
// plain JS array — safe to define here before google loads.
// the StyledMapType object is created inside initMap() where google.maps exists.
// docs: https://developers.google.com/maps/documentation/javascript/examples/maptype-styled-simple

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


// ─── game state ────────────────────────────────────────────────────────────────

var map;
var currentIndex   = 0;
var score          = 0;
var drawnRects     = [];
var timerInterval;
var elapsedSeconds = 0;
var gameActive     = false;


// ─── initMap ───────────────────────────────────────────────────────────────────
// called automatically by the maps API once it finishes loading via &callback=initMap.
// all google.maps.* usage lives here or in functions called after this fires.

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 34.2420, lng: -118.5276 },  // centered between Plummer and Nordhoff
    zoom: 16,
    disableDefaultUI: true,
    disableDoubleClickZoom: true,   // stops maps from consuming dblclick for zoom
    keyboardShortcuts: false,
    clickableIcons: false           // prevents POI popups from interrupting clicks
  });

  // google.maps.StyledMapType — creates a named, registerable custom map style.
  // takes the style rules array and an options object with a display name.
  // this is one of the two google maps API features used for the presentation.
  // docs: https://developers.google.com/maps/documentation/javascript/examples/maptype-styled-simple
  var csunDarkStyle = new google.maps.StyledMapType(darkStyleRules, { name: "CSUN Dark" });

  // register the custom style under id "csun_dark" so the map can reference it
  map.mapTypes.set("csun_dark", csunDarkStyle);

  // map.setOptions() applies config changes to an already-created map instance.
  // used here to switch to our StyledMapType. also used in drawRect() to animate
  // rectangle fill opacity without tearing down and recreating the overlay.
  // this is the second google maps API feature used for the presentation.
  // docs: https://developers.google.com/earth-engine/apidocs/map-setoptions
  map.setOptions({ mapTypeId: "csun_dark" });

  // right-click anywhere to log the lat/lng — useful for verifying building coordinates
  google.maps.event.addListener(map, "rightclick", function(event) {
    console.log("lat: " + event.latLng.lat().toFixed(5) + ", lng: " + event.latLng.lng().toFixed(5));
  });

  // dblclick fires after disableDoubleClickZoom kills the zoom behavior,
  // so it reaches our handler cleanly instead of being consumed by the map
  google.maps.event.addListener(map, "dblclick", function(event) {
    handleClick(event.latLng);
  });

  startGame();
}


// ─── startGame ─────────────────────────────────────────────────────────────────
// resets all state and begins a fresh round. called on load and by play again.

function startGame() {
  currentIndex   = 0;
  score          = 0;
  elapsedSeconds = 0;
  gameActive     = true;

  // remove all rectangles from the previous round before starting fresh
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


// ─── showQuestion ──────────────────────────────────────────────────────────────
// displays the current building prompt and adds a pending log entry.
// calls endGame if all five questions are done.

function showQuestion() {
  if (currentIndex >= locations.length) {
    endGame();
    return;
  }

  var loc = locations[currentIndex];

  // flash the left border so the question change is obvious
  $("#prompt-section").addClass("flash");
  setTimeout(function() { $("#prompt-section").removeClass("flash"); }, 400);

  // fade the name in smoothly instead of snapping to the new text
  $("#prompt-name").css({ opacity: 0 }).text(loc.name).animate({ opacity: 1 }, 200);

  updateCounter();

  // pending log entry — replaced with correct/wrong after the user clicks
  var entry = $("<div>").addClass("log-entry pending");
  entry.append($("<span>").addClass("log-icon").text("?"));
  entry.append($("<span>").text((currentIndex + 1) + ". " + loc.name));
  entry.attr("id", "log-entry-" + currentIndex);
  $("#answer-log").append(entry);
}


// ─── handleClick ───────────────────────────────────────────────────────────────
// fires on every double click. measures distance from click to the correct
// building and decides if it's within the tolerance radius.

function handleClick(latLng) {
  if (!gameActive) return;

  var target       = locations[currentIndex];
  var targetLatLng = new google.maps.LatLng(target.lat, target.lng);

  // computeDistanceBetween returns straight-line meters between two LatLng points
  var distance = google.maps.geometry.spherical.computeDistanceBetween(latLng, targetLatLng);
  var correct  = distance <= target.radius;

  if (correct) score++;

  drawRect(target, correct);
  updateLogEntry(currentIndex, target.name, correct, Math.round(distance));

  currentIndex++;
  showQuestion();
}


// ─── updateLogEntry ────────────────────────────────────────────────────────────
// updates the pending log entry to show correct or wrong after a guess.
// if wrong, shows how many meters off the click was.

function updateLogEntry(index, name, correct, dist) {
  var entry = $("#log-entry-" + index);
  entry.removeClass("pending").addClass(correct ? "correct" : "wrong");
  entry.empty();

  // feedback text matches the spec: "Your answer is correct!!" and "Sorry wrong location."
  var result = correct ? "Your answer is correct!!" : "Sorry wrong location.";
  entry.append($("<span>").addClass("log-icon").text(correct ? "+" : "x"));
  entry.append($("<span>").text((index + 1) + ". " + name + " — " + result));
}


// ─── drawRect ─────────────────────────────────────────────────────────────────
// draws a filled rectangle centered on the correct building location.
// green = correct, red = wrong.
// rect.setOptions() animates fill opacity without recreating the overlay —
// same API as map.setOptions(), just called on a Rectangle instead of the Map.

function drawRect(target, correct) {
  var offset = 0.00022;   // roughly 24 meters each direction from center
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
    fillOpacity:   0.4
  });

  // pulse the fill a few times using setOptions so the result is immediately obvious
  var fading = false;
  var pulse  = setInterval(function() {
    fading = !fading;
    rect.setOptions({ fillOpacity: fading ? 0.1 : 0.4 });
  }, 450);

  setTimeout(function() {
    clearInterval(pulse);
    rect.setOptions({ fillOpacity: 0.4 });
  }, 2000);

  drawnRects.push(rect);
}


// ─── updateCounter ─────────────────────────────────────────────────────────────
// keeps the "1/5" counter in the header synced with currentIndex.

function updateCounter() {
  $("#q-current").text(Math.min(currentIndex + 1, locations.length));
  $("#q-total").text(locations.length);
}


// ─── endGame ───────────────────────────────────────────────────────────────────
// stops the timer and shows the final score screen.

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


// ─── timer ─────────────────────────────────────────────────────────────────────
// counts up from zero and updates the display every second.

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

// pads seconds to two digits so 0:05 doesn't show as 0:5
function formatTime(s) {
  var m   = Math.floor(s / 60);
  var sec = s % 60;
  return m + ":" + (sec < 10 ? "0" : "") + sec;
}


// ─── restart ───────────────────────────────────────────────────────────────────
// startGame() already clears drawnRects by calling setMap(null) on each one,
// so rectangles from the previous round are removed before the new round starts.

$("#restart-btn").on("click", function() {
  startGame();
});
