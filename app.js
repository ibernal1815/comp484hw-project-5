// csun map quiz — project 5
// isaiah bernal
//
// the game loads a google map centered on csun, then asks the user to
// double click where they think each of five buildings is located.
// after each guess it draws a colored rectangle over the correct spot,
// logs whether the answer was right or wrong, and moves to the next question.
// when all five are done it shows the final score and elapsed time.


// ─── locations ────────────────────────────────────────────────────────────────
// each object holds the building name, the exact lat/lng of the building
// (verified by dropping a pin on google maps), and a radius in meters that
// defines how close the user's click needs to be to count as correct.
// my assigned location from the project sheet is the asian american activities center.

var locations = [
  {
    name: "Asian American Activities Center",
    lat: 34.24285,
    lng: -118.52998,
    radius: 55
  },
  {
    name: "University Library",
    lat: 34.24175,
    lng: -118.52802,
    radius: 60
  },
  {
    name: "Jacaranda Hall",
    lat: 34.24060,
    lng: -118.52666,
    radius: 55
  },
  {
    name: "Student Recreation Center",
    lat: 34.23955,
    lng: -118.52606,
    radius: 65
  },
  {
    name: "Manzanita Hall",
    lat: 34.24378,
    lng: -118.52758,
    radius: 55
  }
];


// ─── dark style rules ─────────────────────────────────────────────────────────
// this array defines the visual rules for our custom map type.
// each object targets a feature type (roads, water, poi, etc.) and an element
// type (geometry, labels, etc.) and applies stylers like color or visibility.
//
// important: this is just a plain array defined at the top level.
// the actual google.maps.StyledMapType object is created inside initMap()
// because google.maps is not available until the API callback fires —
// trying to call new google.maps.StyledMapType() here would throw
// "google is not defined" since the script tag hasn't finished loading yet.
//
// docs: https://developers.google.com/maps/documentation/javascript/examples/maptype-styled-simple

var darkStyleRules = [
  // base geometry — everything starts dark
  { elementType: "geometry",            stylers: [{ color: "#1a1a1f" }] },

  // labels — light enough to read, dark enough not to fight the rectangles
  { elementType: "labels.text.fill",    stylers: [{ color: "#8888aa" }] },
  { elementType: "labels.text.stroke",  stylers: [{ color: "#0d0d0f" }] },

  // kill the default POI icons, they clutter the map at this zoom level
  { elementType: "labels.icon",         stylers: [{ visibility: "off" }] },

  // roads — slightly lighter than the base so campus paths are visible
  { featureType: "road",          elementType: "geometry",        stylers: [{ color: "#2e2e3a" }] },
  { featureType: "road",          elementType: "geometry.stroke", stylers: [{ color: "#111114" }] },
  { featureType: "road.highway",  elementType: "geometry",        stylers: [{ color: "#3a3a48" }] },

  // keep street name labels on so users have some reference points
  { featureType: "road.local",    elementType: "labels",          stylers: [{ visibility: "on"  }] },

  // water goes almost black so it doesn't compete with anything
  { featureType: "water",         elementType: "geometry",        stylers: [{ color: "#0a0a10" }] },

  // generic POIs off, school POIs on — csun buildings show up as school features
  { featureType: "poi",           elementType: "geometry",        stylers: [{ color: "#16161e" }] },
  { featureType: "poi",           elementType: "labels",          stylers: [{ visibility: "off" }] },
  { featureType: "poi.park",      elementType: "geometry",        stylers: [{ color: "#131a13" }] },
  { featureType: "poi.school",    elementType: "geometry",        stylers: [{ color: "#1a1a28" }] },
  { featureType: "poi.school",    elementType: "labels",          stylers: [{ visibility: "on"  }] },

  // transit and admin boundaries, kept subtle
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
// the google maps script tag calls this function automatically via the
// &callback=initMap param once the API finishes loading.
// all google.maps.* calls must live inside here or in functions called after
// this fires — anything calling google.maps at the top level will crash because
// the API hasn't loaded yet when the browser first parses app.js.

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 34.2416, lng: -118.5280 },  // centered on csun's main quad
    zoom: 17,                                    // tight enough to see individual buildings
    disableDefaultUI: true,                      // removes all default map controls
    gestureHandling: "cooperative",              // blocks scroll zoom but allows click events
    keyboardShortcuts: false,
    clickableIcons: false                        // prevents POI popups from interrupting clicks
  });

  // google.maps.StyledMapType creates a named, registerable custom map style.
  // it takes our darkStyleRules array and an options object with a display name.
  // this is one of the two google maps features chosen for the presentation.
  // docs: https://developers.google.com/maps/documentation/javascript/examples/maptype-styled-simple
  var csunDarkStyle = new google.maps.StyledMapType(darkStyleRules, { name: "CSUN Dark" });

  // register the StyledMapType under the id "csun_dark" so the map recognizes it
  map.mapTypes.set("csun_dark", csunDarkStyle);

  // google.maps.Map.setOptions() applies configuration changes to an already-created map.
  // here we use it to switch the active map type to our registered StyledMapType
  // and lock out scroll wheel zoom so the map stays fixed per the spec.
  // setOptions is also used later in drawRect() to animate rectangle fill opacity
  // without having to tear down and recreate the overlay object.
  // this is the second of the two google maps features chosen for the presentation.
  // docs: https://developers.google.com/earth-engine/apidocs/map-setoptions
  map.setOptions({
    mapTypeId: "csun_dark",   // switches to our StyledMapType
    scrollwheel: false        // belt-and-suspenders zoom lock on top of gestureHandling
  });

  // listen for double clicks anywhere on the map surface
  map.addListener("dblclick", function(event) {
    handleClick(event.latLng);
  });

  startGame();
}


// ─── startGame ─────────────────────────────────────────────────────────────────
// resets all state and kicks off a fresh round. also called by the play again button.

function startGame() {
  currentIndex   = 0;
  score          = 0;
  elapsedSeconds = 0;
  gameActive     = true;

  // remove any rectangles left over from the previous round
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
// updates the panel with the current question and adds a pending log entry.
// if we've run out of questions it calls endGame instead.

function showQuestion() {
  if (currentIndex >= locations.length) {
    endGame();
    return;
  }

  var loc = locations[currentIndex];

  // flash the prompt border briefly so the question change is visually obvious
  $("#prompt-section").addClass("flash");
  setTimeout(function() { $("#prompt-section").removeClass("flash"); }, 400);

  // fade the building name in so it doesn't just snap to the new text
  $("#prompt-name").css({ opacity: 0 }).text(loc.name).animate({ opacity: 1 }, 200);

  updateCounter();

  // add a pending entry to the log for this question — updated after the guess
  var entry = $("<div>").addClass("log-entry pending");
  entry.append($("<span>").addClass("log-icon").text("?"));
  entry.append($("<span>").text((currentIndex + 1) + ". " + loc.name));
  entry.attr("id", "log-entry-" + currentIndex);
  $("#answer-log").append(entry);
}


// ─── handleClick ───────────────────────────────────────────────────────────────
// fires on every double click. measures the distance from the click to the
// correct building and decides if it counts as correct.

function handleClick(latLng) {
  if (!gameActive) return;

  var target       = locations[currentIndex];
  var targetLatLng = new google.maps.LatLng(target.lat, target.lng);

  // computeDistanceBetween returns straight-line distance in meters
  // between two LatLng points using the spherical law of cosines
  var distance = google.maps.geometry.spherical.computeDistanceBetween(latLng, targetLatLng);
  var correct  = distance <= target.radius;

  if (correct) score++;

  drawRect(target, correct);
  updateLogEntry(currentIndex, target.name, correct, Math.round(distance));

  currentIndex++;
  showQuestion();
}


// ─── updateLogEntry ────────────────────────────────────────────────────────────
// swaps the pending log entry for the answered result, colored green or red.
// if wrong, appends how many meters off the click was so the user has feedback.

function updateLogEntry(index, name, correct, dist) {
  var entry = $("#log-entry-" + index);
  entry.removeClass("pending").addClass(correct ? "correct" : "wrong");
  entry.empty();

  var icon   = correct ? "+" : "x";
  var detail = correct ? name : name + " (" + dist + "m off)";

  entry.append($("<span>").addClass("log-icon").text(icon));
  entry.append($("<span>").text((index + 1) + ". " + detail));
}


// ─── drawRect ─────────────────────────────────────────────────────────────────
// places a filled rectangle centered on the correct building location.
// green means the user got it right, red means they missed.
//
// rect.setOptions() is the same API as map.setOptions() — it applies property
// changes to an existing overlay without recreating it. here we use it to
// animate the fill opacity up and down a few times so the result is obvious
// the moment it appears, then settle it at a static 0.35 opacity.

function drawRect(target, correct) {
  var offset = 0.00025;   // roughly 25 meters in each direction from center
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

  // pulse the fill using rect.setOptions() — toggles between dim and full
  // every 450ms for 2 seconds, then clears the interval and locks at 0.35
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


// ─── updateCounter ─────────────────────────────────────────────────────────────
// keeps the "1/5" question counter in the panel header in sync with currentIndex.

function updateCounter() {
  $("#q-current").text(Math.min(currentIndex + 1, locations.length));
  $("#q-total").text(locations.length);
}


// ─── endGame ───────────────────────────────────────────────────────────────────
// stops the timer, hides the game UI, and shows the final score screen.

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
// counts up from zero each round and updates the display every second.

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

// pads seconds to two digits so the timer shows 0:05 instead of 0:5
function formatTime(s) {
  var m   = Math.floor(s / 60);
  var sec = s % 60;
  return m + ":" + (sec < 10 ? "0" : "") + sec;
}


// ─── restart ───────────────────────────────────────────────────────────────────

$("#restart-btn").on("click", function() {
  startGame();
});
