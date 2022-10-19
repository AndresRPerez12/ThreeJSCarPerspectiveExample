setup();

function setup() {
  importThree();
}

function draw() {}

function importThree(){
  const script = document.createElement('script');
  script.src = 'https://threejs.org/build/three.js';
  script.async = true;
  script.onload = () => {
    console.log('Script loaded successfuly');
    importCannon();
  };
  script.onerror = () => {
    console.log('Error occurred while loading script');
  };
  document.body.appendChild(script);
}

function importCannon(){
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.js';
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

  const lavaRed = "#7cfc00";
  const trackColor = "black";
  const blockColor = "#BF9742";
  const mountainColor = "#A47E3B";
  const baseColor = "#61481C";

  const wheelGeometry = new THREE.BoxBufferGeometry(12, 33, 12);
  const wheelMaterial = new THREE.MeshLambertMaterial({
    color: 0x333333
  });

  const config = {
    shadows: true, // Use shadow
    trees: true, // Add trees to the map
    curbs: true, // Show texture on the extruded geometry
    grid: false // Show grid helper
  };

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
  var lavaMesh, lavaBody;
  var trackMesh, trackBody;
  var blockMesh, blockBody;
  var mountainMesh, mountainBody;
  var baseMesh, baseBody;
  const groundPhysMat = new CANNON.Material();
  const carPhysMat = new CANNON.Material();
  const groundBoxContactMat = new CANNON.ContactMaterial(
      groundPhysMat,
      carPhysMat,
      {
        friction: 0.04,
        restitution: 0
      }
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
    5, // near plane
    2000 // far plane
  );

  camera.position.set(200, -500, 630);
  camera.up = new THREE.Vector3(0, 0, 1);
  camera.lookAt(0, 0, 0);

  const scene = new THREE.Scene();
  
  const playerCar = Car();
  const carBody = new CANNON.Body({
      mass: 20,
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
    playerCar.position.x = -300;
    playerCar.position.y = -300;
    playerCar.position.z = 50;
    playerCar.rotation.x = 0;
    playerCar.rotation.y = 0;
    playerCar.rotation.z = 0;
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

  function renderMap() {
    const lavaDimensions = {
      x: 2000,
      y: 2000,
      pos_z: -200
    }
    const trackDimensions = {
      x: 800,
      y: 700,
      pos_z: 10
    }
    const blockDimensions = {
      x: 100,
      y: 50,
      pos_z: 0
    }
    const mountainDimensions = {
      x: 150,
      y: 100,
      pos_z: 0
    }
    const baseDimensions = {
      x: 400,
      y: 400,
      pos_z: -200
    }


    // Lava
    lavaBody = new CANNON.Body({
      shape: new CANNON.Box(new CANNON.Vec3(lavaDimensions.x/2, lavaDimensions.y/2, 0.1)),
      type: CANNON.Body.STATIC,
      material: groundPhysMat,
      position: new CANNON.Vec3(0, 0, lavaDimensions.pos_z),
    });
    world.addBody(lavaBody);

    const lavaGeo = new THREE.PlaneGeometry(lavaDimensions.x, lavaDimensions.y);
    const lavaMat = new THREE.MeshBasicMaterial({ 
      color: lavaRed,
      side: THREE.DoubleSide,
      wireframe: false 
    });
    lavaMesh = new THREE.Mesh(lavaGeo, lavaMat);
    scene.add(lavaMesh);
    
    // Track
    trackBody = new CANNON.Body({
      shape: new CANNON.Box(new CANNON.Vec3(trackDimensions.x/2, trackDimensions.y/2, 0.1)),
      type: CANNON.Body.STATIC,
      material: groundPhysMat,
      position: new CANNON.Vec3(0, 0, trackDimensions.pos_z),
    });
    world.addBody(trackBody);

    const trackGeo = new THREE.PlaneGeometry(trackDimensions.x, trackDimensions.y);
    const trackMat = new THREE.MeshBasicMaterial({ 
      color: trackColor,
      side: THREE.DoubleSide,
      wireframe: false 
    });
    trackMesh = new THREE.Mesh(trackGeo, trackMat);
    scene.add(trackMesh);
    
    // Block
    blockBody = new CANNON.Body({
      shape: new CANNON.Box(new CANNON.Vec3(blockDimensions.x/2, blockDimensions.y/2, 1000)),
      type: CANNON.Body.STATIC,
      material: groundPhysMat,
      position: new CANNON.Vec3(0, 0, blockDimensions.pos_z),
    });
    world.addBody(blockBody);

    const blockGeo = new THREE.BoxGeometry(blockDimensions.x, blockDimensions.y, 1000);
    const blockMat = new THREE.MeshBasicMaterial({ 
      color: blockColor,
      side: THREE.DoubleSide,
      wireframe: false 
    });
    blockMesh = new THREE.Mesh(blockGeo, blockMat);
    scene.add(blockMesh);

    // Mountain
    mountainBody = new CANNON.Body({
      shape: new CANNON.Box(new CANNON.Vec3(mountainDimensions.x/2, mountainDimensions.y/2, 700)),
      type: CANNON.Body.STATIC,
      material: groundPhysMat,
      position: new CANNON.Vec3(0, 0, mountainDimensions.pos_z),
    });
    world.addBody(mountainBody);

    const mountainGeo = new THREE.BoxGeometry(mountainDimensions.x, mountainDimensions.y, 700);
    const mountainMat = new THREE.MeshBasicMaterial({ 
      color: mountainColor,
      side: THREE.DoubleSide,
      wireframe: false 
    });
    mountainMesh = new THREE.Mesh(mountainGeo, mountainMat);
    scene.add(mountainMesh);

    // Base
    baseBody = new CANNON.Body({
      shape: new CANNON.Box(new CANNON.Vec3(baseDimensions.x/2, baseDimensions.y/2, 500)),
      type: CANNON.Body.STATIC,
      material: groundPhysMat,
      position: new CANNON.Vec3(0, 0, baseDimensions.pos_z),
    });
    world.addBody(baseBody);

    const baseGeo = new THREE.BoxGeometry(baseDimensions.x, baseDimensions.y, 500);
    const baseMat = new THREE.MeshBasicMaterial({ 
      color: baseColor,
      side: THREE.DoubleSide,
      wireframe: false 
    });
    baseMesh = new THREE.Mesh(baseGeo, baseMat);
    scene.add(baseMesh);
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

    // Apply gravity
    const timeStep = 1 / 60;
    world.step(timeStep);

    // Update THREE car position
    playerCar.position.copy(carBody.position);
    playerCar.quaternion.copy(carBody.quaternion);

    lavaMesh.position.copy(lavaBody.position);
    lavaMesh.quaternion.copy(lavaBody.quaternion);
    trackMesh.position.copy(trackBody.position);
    trackMesh.quaternion.copy(trackBody.quaternion);
    blockMesh.position.copy(blockBody.position);
    blockMesh.quaternion.copy(blockBody.quaternion);

    renderer.render(scene, camera);
    lastTimestamp = timestamp;
  }

  function movePlayerCar(timeDelta) {
    const playerSpeed = getPlayerSpeed();

    playerAngleMoved += playerSpeed.sideways * timeDelta;
    const totalPlayerAngle = playerAngleInitial + playerAngleMoved;
    playerCar.rotation.z = totalPlayerAngle - Math.PI / 2;
    carBody.quaternion.copy(playerCar.quaternion);

    const forwardMovement = playerSpeed.forward * timeDelta;
    const deltaX = forwardMovement * Math.cos(playerCar.rotation.z);
    const deltaY = forwardMovement * Math.sin(playerCar.rotation.z);
    // playerCar.position.x += deltaX;
    // playerCar.position.y += deltaY;

    const impulse = new CANNON.Vec3(playerSpeed.forward, 0, -1);
    carBody.applyLocalImpulse(impulse,new CANNON.Vec3(0, 0, 0));

    if (inOrthographicView == false) setUpPerspectiveCamera();
  }

  function getPlayerSpeed() {
    const baseSpeedForward = 20;
    const baseSpeedSideways = 0.004;
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
      5, // near plane
      2000 // far plane
    );

    camera.position.set(200, -500, 630);
    camera.up = new THREE.Vector3(0, 0, 1);
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