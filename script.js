// csun map quiz - project 5
// isaiah bernal

// the five locations for the quiz.
// lat/lng pulled from google maps by searching each building on campus.
// radius is how close the user needs to click (in meters) to count as correct.
// my assigned location is the asian american activities center.
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

var map;
var currentIndex = 0;
var score = 0;
var drawnRects = [];
var timerInterval;
var elapsedSeconds = 0;
var gameActive = false;

// initMap is called automatically by the google maps script tag once it loads
function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 34.2414, lng: -118.5285 },
    zoom: 16,
    disableDefaultUI: true,
    gestureHandling: "none",    // per the spec, panning and zooming stay off
    keyboardShortcuts: false
  });

  // listen for double clicks anywhere on the map
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

  // clear any rectangles left over from a previous round
  drawnRects.forEach(function(r) { r.setMap(null); });
  drawnRects = [];

  $("#feedback-box").empty();
  $("#score-box").addClass("hidden");
  $("#question-box").show();
  $("#timer-box").show();

  showQuestion();
  startTimer();
}

function showQuestion() {
  if (currentIndex >= locations.length) {
    endGame();
    return;
  }
  $("#question-text").text("Where is " + locations[currentIndex].name + "?");
}

function handleClick(latLng) {
  if (!gameActive) return;

  var target = locations[currentIndex];
  var targetLatLng = new google.maps.LatLng(target.lat, target.lng);

  // measure how far the click was from the correct spot
  var distance = google.maps.geometry.spherical.computeDistanceBetween(latLng, targetLatLng);
  var correct = distance <= target.radius;

  if (correct) {
    score++;
    addFeedback("Your answer is correct!!", "correct");
  } else {
    addFeedback("Sorry wrong location.", "wrong");
  }

  drawRect(target, correct);

  currentIndex++;
  showQuestion();
}

// adds a line to the feedback log on the left panel
function addFeedback(message, type) {
  var entry = $("<p>").addClass("feedback-entry " + type).text(message);
  $("#feedback-box").append(entry);
}

// draws a filled rectangle over the correct location.
// green if the user got it right, red if they missed.
function drawRect(target, correct) {
  var offset = 0.00025;
  var color = correct ? "#4caf50" : "#f44336";

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
    strokeOpacity: 0.9,
    fillColor: color,
    fillOpacity: 0.4
  });

  // quick pulse effect so the user notices where the answer landed
  var fading = false;
  var pulse = setInterval(function() {
    fading = !fading;
    rect.setOptions({ fillOpacity: fading ? 0.15 : 0.4 });
  }, 500);

  setTimeout(function() {
    clearInterval(pulse);
    rect.setOptions({ fillOpacity: 0.4 });
  }, 2000);

  drawnRects.push(rect);
}

function endGame() {
  gameActive = false;
  clearInterval(timerInterval);

  var wrong = locations.length - score;

  $("#question-box").hide();
  $("#timer-box").hide();

  $("#final-score").text(score + " Correct, " + wrong + " Incorrect");
  $("#score-box").removeClass("hidden");
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
  var minutes = Math.floor(elapsedSeconds / 60);
  var seconds = elapsedSeconds % 60;
  var display = minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
  $("#timer").text(display);
}

// restart button just kicks off a fresh game
$("#restart-btn").on("click", function() {
  startGame();
});
