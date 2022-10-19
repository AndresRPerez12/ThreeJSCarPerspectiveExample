setup();

function setup() {
  const script = document.createElement('script');
  script.src = 'https://threejs.org/build/three.js';
  script.async = true;
  script.onload = () => {
    console.log('Script loaded successfuly');
    setUpApp();
  };
  script.onerror = () => {
    console.log('Error occurred while loading script');
  };
  document.body.appendChild(script);
}

function draw() {}

function setUpApp() {
  window.focus(); // Capture keys right away (by default focus is on editor)

  // Pick a random value from an array
  function pickRandom(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  const vehicleColors = [
    0xa52523,
    0xef2d56,
    0x0ad3ff,
    0xff9f1c /*0xa52523, 0xbdb638, 0x78b14b*/
  ];

  const carStartingHeight = 100;

  const lawnGreen = "#67C240";
  const trackColor = "#546E90";
  const edgeColor = "#725F48";
  const treeCrownColor = 0x498c2c;
  const treeTrunkColor = 0x4b3f2f;

  const wheelGeometry = new THREE.BoxBufferGeometry(12, 33, 12);
  const wheelMaterial = new THREE.MeshLambertMaterial({
    color: 0x333333
  });
  const treeTrunkGeometry = new THREE.BoxBufferGeometry(15, 15, 80);
  const treeTrunkMaterial = new THREE.MeshLambertMaterial({
    color: treeTrunkColor
  });
  const treeCrownMaterial = new THREE.MeshLambertMaterial({
    color: treeCrownColor
  });

  const config = {
    shadows: true, // Use shadow
    trees: true, // Add trees to the map
    curbs: true, // Show texture on the extruded geometry
    grid: false // Show grid helper
  };

  const baseSpeedForward = 0.3;
  const baseSpeedSideways = 0.004;

  const playerAngleInitial = Math.PI;
  let playerAngleMoved;
  let accelerate = false; // Is the player accelerating
  let decelerate = false; // Is the player decelerating
  let turnLeft = false; // Is player turning left
  let turnRight = false; // Is player turning right
  let inOrthographicView = true;

  let ready;
  let lastTimestamp;

  const trackRadius = 225;
  const trackWidth = 45;
  const innerTrackRadius = trackRadius - trackWidth;
  const outerTrackRadius = trackRadius + trackWidth;

  const arcAngle1 = (1 / 3) * Math.PI; // 60 degrees

  const deltaY = Math.sin(arcAngle1) * innerTrackRadius;
  const arcAngle2 = Math.asin(deltaY / outerTrackRadius);

  const arcCenterX =
    (Math.cos(arcAngle1) * innerTrackRadius +
      Math.cos(arcAngle2) * outerTrackRadius) /
    2;

  const arcAngle3 = Math.acos(arcCenterX / innerTrackRadius);

  const arcAngle4 = Math.acos(arcCenterX / outerTrackRadius);

  // Set up physics
  const world = new CANNON.World();
  world.gravity.set(0, 0, -9.82); 
  var groundMesh, groundBody;
  const groundPhysMat = new CANNON.Material();
  const carPhysMat = new CANNON.Material();
  const groundBoxContactMat = new CANNON.ContactMaterial(
      groundPhysMat,
      carPhysMat,
      {friction: 0.04}
  );

  // Initialize ThreeJs
  // Set up camera
  const aspectRatio = window.innerWidth / window.innerHeight;
  const cameraWidth = 960;
  const cameraHeight = cameraWidth / aspectRatio;

  let camera = new THREE.OrthographicCamera(
    cameraWidth / -2, // left
    cameraWidth / 2, // right
    cameraHeight / 2, // top
    cameraHeight / -2, // bottom
    50, // near plane
    700 // far plane
  );

  camera.position.set(0, -210, 300);
  camera.lookAt(0, 0, 0);

  const scene = new THREE.Scene();
  
  const playerCar = Car();
  const carBody = new CANNON.Body({
      mass: 8,
      shape: new CANNON.Box(new CANNON.Vec3(60, 30, 15)),
      material: carPhysMat
  });
  world.addBody(carBody);
  scene.add(playerCar);

  renderMap();

  world.addContactMaterial(groundBoxContactMat);

  // Set up lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(100, -300, 300);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.left = -800;
  dirLight.shadow.camera.right = 700;
  dirLight.shadow.camera.top = 800;
  dirLight.shadow.camera.bottom = -300;
  dirLight.shadow.camera.near = 100;
  dirLight.shadow.camera.far = 800;
  scene.add(dirLight);

  // const cameraHelper = new THREE.CameraHelper(dirLight.shadow.camera);
  // scene.add(cameraHelper);

  if (config.grid) {
    const gridHelper = new THREE.GridHelper(80, 8);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);
  }

  // Set up renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    alpha: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (config.shadows) renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  reset();

  function reset() {
    // Reset position
    playerAngleMoved = 0;
    playerCar.position.x = 0;
    playerCar.position.y = 0;
    playerCar.position.z = carStartingHeight;
    lastTimestamp = undefined;

    // Reset physics
    carBody.position.copy(playerCar.position);
    carBody.quaternion.copy(playerCar.quaternion);

    // Place the player's car to the starting position
    movePlayerCar(0);

    // Render the scene
    renderer.render(scene, camera);

    ready = true;
  }

  function startGame() {
    if (ready) {
      ready = false;
      renderer.setAnimationLoop(animation);
    }
  }

  function getLineMarkings(mapWidth, mapHeight) {
    const canvas = document.createElement("canvas");
    canvas.width = mapWidth;
    canvas.height = mapHeight;
    const context = canvas.getContext("2d");

    context.fillStyle = trackColor;
    context.fillRect(0, 0, mapWidth, mapHeight);

    context.lineWidth = 2;
    context.strokeStyle = "#E0FFFF";
    context.setLineDash([10, 14]);

    // Left circle
    context.beginPath();
    context.arc(
      mapWidth / 2 - arcCenterX,
      mapHeight / 2,
      trackRadius,
      0,
      Math.PI * 2
    );
    context.stroke();

    // Right circle
    context.beginPath();
    context.arc(
      mapWidth / 2 + arcCenterX,
      mapHeight / 2,
      trackRadius,
      0,
      Math.PI * 2
    );
    context.stroke();

    return new THREE.CanvasTexture(canvas);
  }

  function getCurbsTexture(mapWidth, mapHeight) {
    const canvas = document.createElement("canvas");
    canvas.width = mapWidth;
    canvas.height = mapHeight;
    const context = canvas.getContext("2d");

    context.fillStyle = lawnGreen;
    context.fillRect(0, 0, mapWidth, mapHeight);

    // Extra big
    context.lineWidth = 65;
    context.strokeStyle = "#A2FF75";
    context.beginPath();
    context.arc(
      mapWidth / 2 - arcCenterX,
      mapHeight / 2,
      innerTrackRadius,
      arcAngle1,
      -arcAngle1
    );
    context.arc(
      mapWidth / 2 + arcCenterX,
      mapHeight / 2,
      outerTrackRadius,
      Math.PI + arcAngle2,
      Math.PI - arcAngle2,
      true
    );
    context.stroke();

    context.beginPath();
    context.arc(
      mapWidth / 2 + arcCenterX,
      mapHeight / 2,
      innerTrackRadius,
      Math.PI + arcAngle1,
      Math.PI - arcAngle1
    );
    context.arc(
      mapWidth / 2 - arcCenterX,
      mapHeight / 2,
      outerTrackRadius,
      arcAngle2,
      -arcAngle2,
      true
    );
    context.stroke();

    // Extra small
    context.lineWidth = 60;
    context.strokeStyle = lawnGreen;
    context.beginPath();
    context.arc(
      mapWidth / 2 - arcCenterX,
      mapHeight / 2,
      innerTrackRadius,
      arcAngle1,
      -arcAngle1
    );
    context.arc(
      mapWidth / 2 + arcCenterX,
      mapHeight / 2,
      outerTrackRadius,
      Math.PI + arcAngle2,
      Math.PI - arcAngle2,
      true
    );
    context.arc(
      mapWidth / 2 + arcCenterX,
      mapHeight / 2,
      innerTrackRadius,
      Math.PI + arcAngle1,
      Math.PI - arcAngle1
    );
    context.arc(
      mapWidth / 2 - arcCenterX,
      mapHeight / 2,
      outerTrackRadius,
      arcAngle2,
      -arcAngle2,
      true
    );
    context.stroke();

    // Base
    context.lineWidth = 6;
    context.strokeStyle = edgeColor;

    // Outer circle left
    context.beginPath();
    context.arc(
      mapWidth / 2 - arcCenterX,
      mapHeight / 2,
      outerTrackRadius,
      0,
      Math.PI * 2
    );
    context.stroke();

    // Outer circle right
    context.beginPath();
    context.arc(
      mapWidth / 2 + arcCenterX,
      mapHeight / 2,
      outerTrackRadius,
      0,
      Math.PI * 2
    );
    context.stroke();

    // Inner circle left
    context.beginPath();
    context.arc(
      mapWidth / 2 - arcCenterX,
      mapHeight / 2,
      innerTrackRadius,
      0,
      Math.PI * 2
    );
    context.stroke();

    // Inner circle right
    context.beginPath();
    context.arc(
      mapWidth / 2 + arcCenterX,
      mapHeight / 2,
      innerTrackRadius,
      0,
      Math.PI * 2
    );
    context.stroke();

    return new THREE.CanvasTexture(canvas);
  }

  function getLeftIsland() {
    const islandLeft = new THREE.Shape();

    islandLeft.absarc(
      -arcCenterX,
      0,
      innerTrackRadius,
      arcAngle1,
      -arcAngle1,
      false
    );

    islandLeft.absarc(
      arcCenterX,
      0,
      outerTrackRadius,
      Math.PI + arcAngle2,
      Math.PI - arcAngle2,
      true
    );

    return islandLeft;
  }

  function getMiddleIsland() {
    const islandMiddle = new THREE.Shape();

    islandMiddle.absarc(
      -arcCenterX,
      0,
      innerTrackRadius,
      arcAngle3,
      -arcAngle3,
      true
    );

    islandMiddle.absarc(
      arcCenterX,
      0,
      innerTrackRadius,
      Math.PI + arcAngle3,
      Math.PI - arcAngle3,
      true
    );

    return islandMiddle;
  }

  function getRightIsland() {
    const islandRight = new THREE.Shape();

    islandRight.absarc(
      arcCenterX,
      0,
      innerTrackRadius,
      Math.PI - arcAngle1,
      Math.PI + arcAngle1,
      true
    );

    islandRight.absarc(
      -arcCenterX,
      0,
      outerTrackRadius,
      -arcAngle2,
      arcAngle2,
      false
    );

    return islandRight;
  }

  function getOuterField(mapWidth, mapHeight) {
    const field = new THREE.Shape();

    field.moveTo(-mapWidth / 2, -mapHeight / 2);
    field.lineTo(0, -mapHeight / 2);

    field.absarc(-arcCenterX, 0, outerTrackRadius, -arcAngle4, arcAngle4, true);

    field.absarc(
      arcCenterX,
      0,
      outerTrackRadius,
      Math.PI - arcAngle4,
      Math.PI + arcAngle4,
      true
    );

    field.lineTo(0, -mapHeight / 2);
    field.lineTo(mapWidth / 2, -mapHeight / 2);
    field.lineTo(mapWidth / 2, mapHeight / 2);
    field.lineTo(-mapWidth / 2, mapHeight / 2);

    return field;
  }

  function renderMap() {
    groundBody = new CANNON.Body({
      shape: new CANNON.Box(new CANNON.Vec3(75, 75, 0.1)),
      type: CANNON.Body.STATIC,
      material: groundPhysMat,
      position: new CANNON.Vec3(0, 0, 0),
    });
    world.addBody(groundBody);

    const groundGeo = new THREE.PlaneGeometry(150, 150);
    const groundMat = new THREE.MeshBasicMaterial({ 
      color: 'red',
      side: THREE.DoubleSide,
      wireframe: false 
    });
    groundMesh = new THREE.Mesh(groundGeo, groundMat);
    scene.add(groundMesh);
  }

  function getCarFrontTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 32;
    const context = canvas.getContext("2d");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 64, 32);

    context.fillStyle = "#666666";
    context.fillRect(8, 8, 48, 24);

    return new THREE.CanvasTexture(canvas);
  }

  function getCarSideTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 32;
    const context = canvas.getContext("2d");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 128, 32);

    context.fillStyle = "#666666";
    context.fillRect(10, 8, 38, 24);
    context.fillRect(58, 8, 60, 24);

    return new THREE.CanvasTexture(canvas);
  }

  function Car() {
    const car = new THREE.Group();

    const color = pickRandom(vehicleColors);

    const main = new THREE.Mesh(
      new THREE.BoxBufferGeometry(60, 30, 15),
      new THREE.MeshLambertMaterial({
        color
      })
    );
    main.position.z = 12;
    main.castShadow = true;
    main.receiveShadow = true;
    car.add(main);

    const carFrontTexture = getCarFrontTexture();
    carFrontTexture.center = new THREE.Vector2(0.5, 0.5);
    carFrontTexture.rotation = Math.PI / 2;

    const carBackTexture = getCarFrontTexture();
    carBackTexture.center = new THREE.Vector2(0.5, 0.5);
    carBackTexture.rotation = -Math.PI / 2;

    const carLeftSideTexture = getCarSideTexture();
    carLeftSideTexture.flipY = false;

    const carRightSideTexture = getCarSideTexture();

    const cabin = new THREE.Mesh(new THREE.BoxBufferGeometry(33, 24, 12), [
      new THREE.MeshLambertMaterial({
        map: carFrontTexture
      }),
      new THREE.MeshLambertMaterial({
        map: carBackTexture
      }),
      new THREE.MeshLambertMaterial({
        map: carLeftSideTexture
      }),
      new THREE.MeshLambertMaterial({
        map: carRightSideTexture
      }),
      new THREE.MeshLambertMaterial({
        color: 0xffffff
      }), // top
      new THREE.MeshLambertMaterial({
        color: 0xffffff
      }) // bottom
    ]);
    cabin.position.x = -6;
    cabin.position.z = 25.5;
    cabin.castShadow = true;
    cabin.receiveShadow = true;
    car.add(cabin);

    const backWheel = new Wheel();
    backWheel.position.x = -18;
    car.add(backWheel);

    const frontWheel = new Wheel();
    frontWheel.position.x = 18;
    car.add(frontWheel);

    return car;
  }

  function Wheel() {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.position.z = 6;
    wheel.castShadow = false;
    wheel.receiveShadow = false;
    return wheel;
  }

  function Tree() {
    const tree = new THREE.Group();

    const trunk = new THREE.Mesh(treeTrunkGeometry, treeTrunkMaterial);
    trunk.position.z = 10;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    trunk.matrixAutoUpdate = false;
    tree.add(trunk);

    const treeHeights = [45, 60, 75];
    const height = pickRandom(treeHeights);

    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(height / 2, 30, 30),
      treeCrownMaterial
    );
    crown.position.z = height / 2 + 30;
    crown.castShadow = true;
    crown.receiveShadow = false;
    tree.add(crown);

    return tree;
  }

  window.addEventListener("keydown", function (event) {
    if (event.key == "ArrowUp") {
      startGame();
      accelerate = true;
      return;
    }
    if (event.key == "ArrowDown") {
      decelerate = true;
      return;
    }
    if (event.key == "ArrowLeft") {
      turnLeft = true;
      return;
    }
    if (event.key == "ArrowRight") {
      turnRight = true;
      return;
    }
    if (event.key == "R" || event.key == "r") {
      reset();
      return;
    }
    if (event.key == "C" || event.key == "c") {
      if (inOrthographicView) inOrthographicView = false;
      else {
        inOrthographicView = true;
        setUpOrthographicCamera();
      }
      return;
    }
  });

  window.addEventListener("keyup", function (event) {
    if (event.key == "ArrowUp") {
      accelerate = false;
      return;
    }
    if (event.key == "ArrowDown") {
      decelerate = false;
      return;
    }
    if (event.key == "ArrowLeft") {
      turnLeft = false;
      return;
    }
    if (event.key == "ArrowRight") {
      turnRight = false;
      return;
    }
  });

  function animation(timestamp) {
    if (!lastTimestamp) {
      lastTimestamp = timestamp;
      return;
    }

    const timeDelta = timestamp - lastTimestamp;
    movePlayerCar(timeDelta);

    const timeStep = 1 / 60;
    world.step(timeStep);

    groundMesh.position.copy(groundBody.position);
    groundMesh.quaternion.copy(groundBody.quaternion);

    renderer.render(scene, camera);
    lastTimestamp = timestamp;
  }

  function movePlayerCar(timeDelta) {
    const playerSpeed = getPlayerSpeed();

    playerAngleMoved += playerSpeed.sideways * timeDelta;
    const totalPlayerAngle = playerAngleInitial + playerAngleMoved;
    playerCar.rotation.z = totalPlayerAngle - Math.PI / 2;

    const forwardMovement = playerSpeed.forward * timeDelta;
    const deltaX = forwardMovement * Math.cos(playerCar.rotation.z);
    const deltaY = forwardMovement * Math.sin(playerCar.rotation.z);
    playerCar.position.x += deltaX;
    playerCar.position.y += deltaY;

    // Update THREE car position
    carBody.position.x = playerCar.position.x;
    carBody.position.y = playerCar.position.y;
    playerCar.position.copy(carBody.position);
    // playerCar.quaternion.copy(carBody.quaternion);
    if (inOrthographicView == false) setUpPerspectiveCamera();
  }

  function getPlayerSpeed() {
    let speedObject = {
      forward: 0,
      sideways: 0
    }
    if (accelerate == decelerate) speedObject.forward = 0;
    else if (accelerate) speedObject.forward = baseSpeedForward;
    else if (decelerate) speedObject.forward = -baseSpeedForward;
    if (turnLeft == turnRight || speedObject.forward == 0) speedObject.sideways = 0;
    else if (turnLeft) speedObject.sideways = baseSpeedSideways;
    else if (turnRight) speedObject.sideways = -baseSpeedSideways;
    return speedObject;
  }

  function setUpOrthographicCamera() {
    camera = new THREE.OrthographicCamera(
      cameraWidth / -2, // left
      cameraWidth / 2, // right
      cameraHeight / 2, // top
      cameraHeight / -2, // bottom
      50, // near plane
      700 // far plane
    );

    camera.position.set(0, -210, 300);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  function setUpPerspectiveCamera() {
    camera = new THREE.PerspectiveCamera(45, aspectRatio, 1, 1000);
    const deltaCameraX = 200 * Math.cos(playerCar.rotation.z);
    const deltaCameraY = 200 * Math.sin(playerCar.rotation.z);
    camera.position.set(playerCar.position.x - deltaCameraX, playerCar.position.y - deltaCameraY, playerCar.position.z + 150);
    camera.up = new THREE.Vector3(0, 0, 1);
    camera.lookAt(playerCar.position.x + deltaCameraX, playerCar.position.y + deltaCameraY, playerCar.position.z + 20);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  window.addEventListener("resize", () => {
    console.log("resize", window.innerWidth, window.innerHeight);

    // Adjust camera
    if (inOrthographicView) setUpOrthographicCamera();
    else setUpPerspectiveCamera();

    // Reset renderer
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.render(scene, camera);
  });

}