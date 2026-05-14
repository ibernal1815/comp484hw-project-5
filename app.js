// csun map quiz - project 5
// isaiah bernal

// five locations: 4 chosen + my assigned one (asian american activities center)
// lat/lng pulled from google maps by dropping pins on each building
// radius is the tolerance in meters — how close counts as correct
var locations = [
  {
    name: "Asian American Activities Center",
    lat: 34.24262,
    lng: -118.52985,
    radius: 60
  },
  {
    name: "University Library",
    lat: 34.24158,
    lng: -118.52770,
    radius: 65
  },
  {
    name: "Jacaranda Hall",
    lat: 34.24073,
    lng: -118.52688,
    radius: 60
  },
  {
    name: "Student Recreation Center",
    lat: 34.23940,
    lng: -118.52680,
    radius: 70
  },
  {
    name: "Manzanita Hall",
    lat: 34.24340,
    lng: -118.52730,
    radius: 60
  }
];

// custom dark map style so the map matches the dark panel
// generated from google maps styling wizard
var darkStyle = [
  { elementType: "geometry", stylers: [{ color: "#1a1a1f" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6b6b7a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0d0d0f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a32" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#111114" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a3a42" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d0d0f" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#16161b" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#141a14" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#3a4a3a" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#1a1a22" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#2a2a3a" }] }
];

var map;
var currentIndex = 0;
var score = 0;
var drawnRects = [];
var timerInterval;
var elapsedSeconds = 0;
var gameActive = false;

// called automatically once the google maps script tag finishes loading
function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 34.2414, lng: -118.5285 },
    zoom: 16,
    disableDefaultUI: true,
    gestureHandling: "none",    // per the spec, panning and zooming are off
    keyboardShortcuts: false,
    styles: darkStyle
  });

  map.addListener("dblclick", function(event) {
    handleClick(event.latLng);
  });

  startGame();
}

function startGame() {
  currentIndex = 0;
  score = 0;
  elapsedSeconds = 0;
  gameActive = true;

  // clear rectangles from the previous round
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

  // animate the prompt text swap
  $("#prompt-name").css({ opacity: 0 }).text(loc.name).animate({ opacity: 1 }, 200);

  updateCounter();

  // add a pending entry to the log so the user sees what's being asked
  var entry = $("<div>").addClass("log-entry pending");
  entry.append($("<span>").addClass("log-icon").text("?"));
  entry.append($("<span>").text((currentIndex + 1) + ". " + loc.name));
  entry.attr("id", "log-entry-" + currentIndex);
  $("#answer-log").append(entry);
}

function handleClick(latLng) {
  if (!gameActive) return;

  var target = locations[currentIndex];
  var targetLatLng = new google.maps.LatLng(target.lat, target.lng);

  // how far was the click from the actual building
  var distance = google.maps.geometry.spherical.computeDistanceBetween(latLng, targetLatLng);
  var correct = distance <= target.radius;

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

  var icon = correct ? "+" : "x";
  var detail = correct
    ? name
    : name + " (" + dist + "m off)";

  entry.append($("<span>").addClass("log-icon").text(icon));
  entry.append($("<span>").text((index + 1) + ". " + detail));
}

// draws a rectangle over the correct location — green if right, red if wrong
function drawRect(target, correct) {
  var offset = 0.00025;
  var color = correct ? "#4caf50" : "#ff4d4d";

  var rect = new google.maps.Rectangle({
    bounds: {
      north: target.lat + offset,
      south: target.lat - offset,
      east:  target.lng + offset,
      west:  target.lng - offset
    },
    map: map,
    strokeColor: color,
    strokeWeight: 2,
    strokeOpacity: 1,
    fillColor: color,
    fillOpacity: 0.35
  });

  // pulse the fill a couple times so the result is obvious, then leave it
  var fading = false;
  var pulse = setInterval(function() {
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
  $("#score-time-final").text("Finished in " + formatTime(elapsedSeconds));
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
