let video;
let faceapi;
let detections = [];
let lastGlitchTime = 0;
let glitchDuration = 500; // Duration of the glitch effect in milliseconds
let isGlitching = false;
let isInteracting = false; // Tracks interaction state
let randomKeypoints = [];
let lastKeypoints = []; // Stores the last detected keypoints
let tapMessage = "Tap the screen...";
let transitionDuration = 2000; // 2 seconds for transition
let transitionStartTime = 0;
let targetKeypoints = [];
let returnStartTime = 0;

function setup() {
  let canvasWidth = windowWidth;
  let canvasHeight = 700;

  let cnv = createCanvas(canvasWidth, canvasHeight);
  cnv.touchStarted(touchStartedHandler);
  cnv.touchEnded(touchEndedHandler);
  cnv.mousePressed(mousePressedHandler);
  cnv.mouseReleased(mouseReleasedHandler);

  video = createCapture(VIDEO);
  video.size(canvasWidth, canvasHeight);
  video.hide();

  // Initialize the face detection model
  faceapi = ml5.faceApi(video, {
    withLandmarks: true,
    withDescriptors: false,
  }, modelReady);
}

function modelReady() {
  console.log('FaceAPI model ready!');
  faceapi.detect(gotFaces);
}

function gotFaces(error, result) {
  if (error) {
    console.error(error);
    return;
  }
  if (result.length > 0) {
    detections = result;
    lastKeypoints = detections[0].landmarks.positions; // Store the keypoints
  }
  faceapi.detect(gotFaces);
}

function draw() {
  background(0);
  push();
  fill(255);
  noStroke();
  textSize(20);
  textAlign(CENTER, BOTTOM);
  text(tapMessage, windowWidth / 2, windowHeight - 20); // Positioned 20px from the bottom
  pop();
  // Check for glitch trigger
  if (millis() - lastGlitchTime > 10000) {
    isGlitching = true;
    lastGlitchTime = millis();
  }

  // Turn off glitch effect after the duration
  if (isGlitching && millis() - lastGlitchTime > glitchDuration) {
    isGlitching = false;
  }

  let keypoints = detections.length > 0 ? detections[0].landmarks.positions : lastKeypoints;

  if (keypoints.length > 0) {
    if (isInteracting) {
      moveKeypointsSmoothly(keypoints);
    } else {
      if (targetKeypoints.length > 0) {
        returnToOriginalPosition(keypoints);
      }
    }
    let faceCenter = getFaceCenter(keypoints);
    translate(width / 2 - faceCenter.x, height / 2 - faceCenter.y);
    drawFaceFill(keypoints);
    drawPointCloud(detections, isGlitching);
  }
}

function touchStartedHandler(event) {
  if (event) event.preventDefault();
  isInteracting = true;
  if (detections.length > 0) {
    createRandomKeypoints(detections[0].landmarks.positions);
  }
  return false;
}

function touchEndedHandler(event) {
  if (event) event.preventDefault();
  isInteracting = false;
  resetSketch();
  return false;
}

function mousePressedHandler() {
  isInteracting = true;
  if (detections.length > 0) {
    createRandomKeypoints(detections[0].landmarks.positions);
  }
  return false;
}

function mouseReleasedHandler() {
  isInteracting = false;
  resetSketch();
  return false;
}

function createRandomKeypoints(keypoints) {
  targetKeypoints = keypoints.map(pt => {
    return { x: random(width), y: random(height) };
  });
  transitionStartTime = millis();
}

function moveKeypointsSmoothly(keypoints) {
  if (targetKeypoints.length > 0) {
    let elapsedTime = millis() - transitionStartTime;
    let t = map(elapsedTime, 0, transitionDuration, 0, 1);
    t = constrain(t, 0, 1);
    for (let i = 0; i < keypoints.length; i++) {
      keypoints[i]._x = lerp(keypoints[i]._x, targetKeypoints[i].x, t);
      keypoints[i]._y = lerp(keypoints[i]._y, targetKeypoints[i].y, t);
    }
  }
}

function returnToOriginalPosition(keypoints) {
  if (targetKeypoints.length === 0) {
    returnStartTime = millis();
  }
  let elapsedTime = millis() - returnStartTime;
  let t = map(elapsedTime, 0, transitionDuration, 0, 1);
  t = constrain(t, 0, 1);
  for (let i = 0; i < keypoints.length; i++) {
    keypoints[i]._x = lerp(keypoints[i]._x, lastKeypoints[i].x, t);
    keypoints[i]._y = lerp(keypoints[i]._y, lastKeypoints[i].y, t);
  }
}

function drawFaceFill(points) {
  fill(0, 255, 0, 25); // Semi-transparent green
  noStroke();
  beginShape();
  for (let i = 0; i < points.length; i++) {
    vertex(points[i]._x, points[i]._y);
  }
  endShape(CLOSE);
}

function drawPointCloud(detections, glitch) {
  for (let detection of detections) {
    const keypoints = detection.landmarks.positions;

    // Set up for glow effect
    drawingContext.shadowBlur = 10; // Adjust the glow size
    drawingContext.shadowColor = color(0, 255, 0); // Green glow

    stroke(0, 255, 0);
    strokeWeight(1);
    for (let i = 0; i < keypoints.length; i++) {
      let closestPoints = findClosestPoints(keypoints, i, 3);
      for (let pt of closestPoints) {
        let x1 = glitch ? keypoints[i]._x + random(-10, 10) : keypoints[i]._x;
        let y1 = glitch ? keypoints[i]._y + random(-10, 10) : keypoints[i]._y;
        let x2 = glitch ? pt._x + random(-10, 10) : pt._x;
        let y2 = glitch ? pt._y + random(-10, 10) : pt._y;
        line(x1, y1, x2, y2);
      }
    }

    // Reset shadow effect to avoid affecting other elements
    drawingContext.shadowBlur = 0;

    strokeWeight(5);
    for (let i = 0; i < keypoints.length; i++) {
      let x = glitch ? keypoints[i]._x + random(-10, 10) : keypoints[i]._x;
      let y = glitch ? keypoints[i]._y + random(-10, 10) : keypoints[i]._y;
      point(x, y);
    }
  }
}

function findClosestPoints(points, index, count) {
  let distances = points.map((pt, i) => {
    return {
      point: pt,
      distance: dist(pt._x, pt._y, points[index]._x, points[index]._y),
      index: i
    };
  });

  distances.sort((a, b) => a.distance - b.distance);
  return distances.slice(1, count + 1).map(d => d.point);
}

function getFaceCenter(points) {
  let sumX = 0, sumY = 0;
  for (let pt of points) {
    sumX += pt._x;
    sumY += pt._y;
  }
  return createVector(sumX / points.length, sumY / points.length);
}

function resetSketch() {
  targetKeypoints = [];
  returnStartTime = millis();
}
