'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';

type TaskId = 'lawn' | 'gutters' | 'wash' | 'weeds';

type SceneData = {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  gutterDebris: THREE.Mesh[];
  houseWalls: THREE.Mesh;
  wallStartColor: THREE.Color;
  frameId: number;
};

let overgrownGrass: THREE.Mesh[] = [];
let weedClusters: THREE.Mesh[] = [];
let yardMess: THREE.Mesh[] = [];

function spawnYardMess(scene: THREE.Scene) {
  overgrownGrass = [];
  weedClusters = [];

  const grassGeometry = new THREE.CylinderGeometry(0.06, 0.08, 1.0, 7);
  const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x186c2a });

  const weedGeometry = new THREE.SphereGeometry(0.12, 12, 12);
  const weedMaterial = new THREE.MeshStandardMaterial({ color: 0xd8cc45 });

  const isInsideHouseFootprint = (x: number, z: number) => Math.abs(x) < 2.4 && Math.abs(z) < 2.3;

  const randomOpenPosition = (range: number) => {
    let x = 0;
    let z = 0;

    do {
      x = (Math.random() - 0.5) * range;
      z = (Math.random() - 0.5) * range;
    } while (isInsideHouseFootprint(x, z));

    return { x, z };
  };

  for (let index = 0; index < 50; index += 1) {
    const grass = new THREE.Mesh(grassGeometry, grassMaterial);
    const { x, z } = randomOpenPosition(17);
    grass.position.set(x, 0.5, z);
    grass.castShadow = true;
    grass.receiveShadow = true;
    scene.add(grass);
    overgrownGrass.push(grass);
  }

  for (let index = 0; index < 20; index += 1) {
    const weed = new THREE.Mesh(weedGeometry, weedMaterial);
    const { x, z } = randomOpenPosition(14);
    weed.position.set(x, 0.12, z);
    weed.castShadow = true;
    weed.receiveShadow = true;
    scene.add(weed);
    weedClusters.push(weed);
  }
}

function initializeYardState(scene: THREE.Scene) {
  yardMess = [];

  const isInsideHouseFootprint = (x: number, z: number) => Math.abs(x) < 2.5 && Math.abs(z) < 2.5;

  const randomOpenPosition = (range: number) => {
    let x = 0;
    let z = 0;

    do {
      x = (Math.random() - 0.5) * range;
      z = (Math.random() - 0.5) * range;
    } while (isInsideHouseFootprint(x, z));

    return { x, z };
  };

  const sphereSizes = [0.09, 0.15, 0.24];

  for (let index = 0; index < 40; index += 1) {
    const useSphere = Math.random() > 0.35;

    const mesh = useSphere
      ? new THREE.Mesh(
          new THREE.SphereGeometry(sphereSizes[Math.floor(Math.random() * sphereSizes.length)], 10, 10),
          new THREE.MeshStandardMaterial({ color: 0x8f7a4c }),
        )
      : new THREE.Mesh(
          new THREE.BoxGeometry(
            0.12 + Math.random() * 0.32,
            0.08 + Math.random() * 0.18,
            0.12 + Math.random() * 0.3,
          ),
          new THREE.MeshStandardMaterial({ color: 0x725e39 }),
        );

    const { x, z } = randomOpenPosition(15);
    mesh.position.set(x, 0.07 + Math.random() * 0.07, z);
    mesh.rotation.set(Math.random() * 0.4, Math.random() * 0.45, Math.random() * 0.3);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    yardMess.push(mesh);
  }
}

function createSimpleMower() {
  const mower = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.24, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x2f9e44 }),
  );
  body.position.y = 0.2;
  body.castShadow = true;
  body.receiveShadow = true;
  mower.add(body);

  const wheelGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 14);
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });

  const leftWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  leftWheel.rotation.z = Math.PI / 2;
  leftWheel.position.set(0, 0.08, 0.23);
  leftWheel.castShadow = true;
  mower.add(leftWheel);

  const rightWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  rightWheel.rotation.z = Math.PI / 2;
  rightWheel.position.set(0, 0.08, -0.23);
  rightWheel.castShadow = true;
  mower.add(rightWheel);

  return mower;
}

function createDustParticleSystem(scene: THREE.Scene, position: THREE.Vector3, color: number) {
  const count = 44;
  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    positions[stride] = (Math.random() - 0.5) * 0.42;
    positions[stride + 1] = Math.random() * 0.26;
    positions[stride + 2] = (Math.random() - 0.5) * 0.3;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color,
    size: 0.08,
    opacity: 0.9,
    transparent: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.position.copy(position);
  scene.add(points);

  return { points, geometry, material };
}

function createWaterParticleSystem(scene: THREE.Scene) {
  const count = 120;
  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    positions[stride] = (Math.random() - 0.5) * 0.34;
    positions[stride + 1] = (Math.random() - 0.5) * 0.34;
    positions[stride + 2] = (Math.random() - 0.5) * 0.24;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0x9ad7ff,
    size: 0.07,
    opacity: 0.9,
    transparent: true,
    depthWrite: false,
  });

  const particles = new THREE.Points(geometry, material);
  particles.position.set(-2.75, 1.45, 2.15);
  scene.add(particles);

  return { particles, geometry, material };
}

const TASKS: Array<{ id: TaskId; label: string; description: string }> = [
  { id: 'lawn', label: 'Lawn Mowing', description: 'Cut long grass down to a clean finish.' },
  { id: 'gutters', label: 'Gutter Cleaning', description: 'Remove leaves and debris from roof edges.' },
  { id: 'wash', label: 'Exterior Wash', description: 'Spray and brighten the siding surfaces.' },
  { id: 'weeds', label: 'Weed Removal', description: 'Clear visible weed clusters around the lawn.' },
];

export default function HowItWorksExperience() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneDataRef = useRef<SceneData | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  const [activeTasks, setActiveTasks] = useState<Record<TaskId, boolean>>({
    lawn: true,
    gutters: true,
    wash: true,
    weeds: true,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [statusText, setStatusText] = useState('Select services, then click Run Sequence.');
  const [progressStageLabel, setProgressStageLabel] = useState('Progress');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    const parent = canvas.parentElement;
    const width = Math.max(parent?.clientWidth ?? 0, 100);
    const height = Math.max(parent?.clientHeight ?? 0, 100);

    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 1000);
    camera.position.set(9, 7, 10);
    camera.lookAt(0, 1, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const textureLoader = new THREE.TextureLoader();
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    const grassTexture = textureLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(8, 8);
    grassTexture.colorSpace = THREE.SRGBColorSpace;
    grassTexture.anisotropy = maxAnisotropy;

    const roofTexture = textureLoader.load('https://threejs.org/examples/textures/brick_diffuse.jpg');
    roofTexture.wrapS = THREE.RepeatWrapping;
    roofTexture.wrapT = THREE.RepeatWrapping;
    roofTexture.repeat.set(4, 2);
    roofTexture.colorSpace = THREE.SRGBColorSpace;
    roofTexture.anisotropy = maxAnisotropy;

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.25);
    directionalLight.position.set(10, 16, 8);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 60;
    directionalLight.shadow.camera.left = -16;
    directionalLight.shadow.camera.right = 16;
    directionalLight.shadow.camera.top = 16;
    directionalLight.shadow.camera.bottom = -16;
    scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0xd8eeff, 0x5f8748, 0.5);
    scene.add(hemisphereLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

    const lawn = new THREE.Mesh(
      new THREE.BoxGeometry(20, 1, 20),
      new THREE.MeshStandardMaterial({ map: grassTexture, color: 0x9bcf8c }),
    );
    lawn.position.y = -0.5;
    lawn.castShadow = true;
    lawn.receiveShadow = true;
    scene.add(lawn);

    const house = new THREE.Group();

    const houseWidth = 3.8;
    const houseHeight = 2.3;
    const houseDepth = 3.2;

    const driveway = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 8.4),
      new THREE.MeshStandardMaterial({ color: 0x808080, side: THREE.DoubleSide }),
    );
    driveway.rotation.x = -Math.PI / 2;
    driveway.position.set(0, 0.02, 5.8);
    driveway.receiveShadow = true;
    scene.add(driveway);

    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(houseWidth, houseHeight, houseDepth),
      new THREE.MeshStandardMaterial({ color: 0xdad7d0 }),
    );
    walls.position.y = houseHeight / 2;
    walls.castShadow = true;
    walls.receiveShadow = true;
    house.add(walls);

    const roofHeight = 1.4;
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(houseWidth * 0.9, roofHeight, 4),
      new THREE.MeshStandardMaterial({ map: roofTexture, color: 0x5b3a25 }),
    );
    roof.position.y = houseHeight + roofHeight / 2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    roof.receiveShadow = true;
    house.add(roof);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 1.2, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x6b3f22 }),
    );
    door.position.set(0, 0.6, houseDepth / 2 + 0.045);
    door.castShadow = true;
    door.receiveShadow = true;
    house.add(door);

    const windowGeometry = new THREE.BoxGeometry(0.58, 0.58, 0.07);
    const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x9fd8ff });

    const leftWindow = new THREE.Mesh(windowGeometry, windowMaterial);
    leftWindow.position.set(-0.92, 1.24, houseDepth / 2 + 0.04);
    leftWindow.castShadow = true;
    leftWindow.receiveShadow = true;
    house.add(leftWindow);

    const rightWindow = new THREE.Mesh(windowGeometry, windowMaterial);
    rightWindow.position.set(0.92, 1.24, houseDepth / 2 + 0.04);
    rightWindow.castShadow = true;
    rightWindow.receiveShadow = true;
    house.add(rightWindow);

    scene.add(house);

    spawnYardMess(scene);
    initializeYardState(scene);

    const gutterDebris: THREE.Mesh[] = [];
    const debrisGeometry = new THREE.BoxGeometry(0.32, 0.16, 0.24);
    const debrisMaterial = new THREE.MeshStandardMaterial({ color: 0x70412a });
    const debrisPositions = [
      [-1.4, 2.38, -1.45],
      [-0.7, 2.4, -1.45],
      [0.1, 2.38, -1.45],
      [0.9, 2.4, -1.45],
      [-1.3, 2.38, 1.45],
      [-0.5, 2.4, 1.45],
      [0.3, 2.38, 1.45],
      [1.1, 2.4, 1.45],
    ];

    debrisPositions.forEach(([x, y, z]) => {
      const debris = new THREE.Mesh(debrisGeometry, debrisMaterial);
      debris.position.set(x, y, z);
      debris.rotation.set(Math.random() * 0.4, Math.random() * 0.5, Math.random() * 0.3);
      scene.add(debris);
      gutterDebris.push(debris);
    });

    let frameId = 0;
    let orbitAngle = 0;
    const orbitRadius = 12;
    const orbitSpeed = 0.14;
    const orbitTarget = new THREE.Vector3(0, houseHeight / 2, 0);

    const animate = () => {
      orbitAngle += orbitSpeed * 0.016;
      camera.position.x = Math.cos(orbitAngle) * orbitRadius;
      camera.position.z = Math.sin(orbitAngle) * orbitRadius;
      camera.position.y = 6.6;
      camera.lookAt(orbitTarget);
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    sceneDataRef.current = {
      renderer,
      camera,
      scene,
      gutterDebris,
      houseWalls: walls,
      wallStartColor: walls.material.color.clone(),
      frameId: 0,
    };
    frameId = window.requestAnimationFrame(animate);

    const onResize = () => {
      const nextWidth = Math.max(parent?.clientWidth ?? 0, 100);
      const nextHeight = Math.max(parent?.clientHeight ?? 0, 100);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight, false);
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      window.cancelAnimationFrame(frameId);
      renderer.dispose();
      sceneDataRef.current = null;
      overgrownGrass = [];
      weedClusters = [];
      yardMess = [];

      scene.traverse((item) => {
        const mesh = item as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }

        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material) => material.dispose());
        }
      });
    };
  }, []);

  const updateProgress = (value: number) => {
    if (!progressRef.current) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      gsap.to(progressRef.current, {
        width: `${value}%`,
        duration: 0.35,
        ease: 'power1.out',
        onComplete: resolve,
      });
    });
  };

  const runLawnMowingTask = () => {
    return new Promise<void>((resolve) => {
      const sceneData = sceneDataRef.current;
      if (!sceneData || !activeTasks.lawn) {
        resolve();
        return;
      }

      setStatusText('Lawn mowing in progress...');
      setProgressStageLabel('Mowing Lawn...');

      const mower = createSimpleMower();
      mower.position.set(-12.8, 0, -6.8);
      mower.rotation.y = 0.16;
      sceneData.scene.add(mower);

      const grassTween = gsap.to(overgrownGrass.map((mesh) => mesh.scale), {
        y: 0.12,
        duration: 4.8,
        stagger: 0.02,
        ease: 'power1.inOut',
      });

      const bobTween = gsap.to(mower.position, {
        y: 0.08,
        duration: 0.28,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });

      gsap.timeline({
        onComplete: () => {
          grassTween.kill();
          bobTween.kill();
          sceneData.scene.remove(mower);
          setActiveTasks((current) => ({ ...current, lawn: false }));
          resolve();
        },
      })
        .to(mower.position, { x: -7.4, z: -6.6, duration: 0.62, ease: 'power2.out' })
        .to(mower.rotation, { y: 0.02, duration: 0.2, ease: 'sine.inOut' }, '<')
        .to(mower.position, { x: 7.2, z: -6.6, duration: 0.74, ease: 'sine.inOut' })
        .to(mower.rotation, { y: -0.08, duration: 0.2, ease: 'sine.inOut' }, '<')
        .to(mower.position, { x: -7.2, z: -3.4, duration: 0.74, ease: 'sine.inOut' })
        .to(mower.rotation, { y: 0.08, duration: 0.2, ease: 'sine.inOut' }, '<')
        .to(mower.position, { x: 7.2, z: -0.2, duration: 0.74, ease: 'sine.inOut' })
        .to(mower.rotation, { y: -0.08, duration: 0.2, ease: 'sine.inOut' }, '<')
        .to(mower.position, { x: -7.2, z: 3.0, duration: 0.74, ease: 'sine.inOut' })
        .to(mower.rotation, { y: 0.08, duration: 0.2, ease: 'sine.inOut' }, '<')
        .to(mower.position, { x: 7.2, z: 6.1, duration: 0.74, ease: 'sine.inOut' })
        .to(mower.rotation, { y: -0.02, duration: 0.2, ease: 'sine.inOut' }, '<')
        .to(mower.position, { x: 13.2, z: 6.5, duration: 0.62, ease: 'power2.in' });
    });
  };

  const runDroneScan = async () => {
    const sceneData = sceneDataRef.current;
    if (!sceneData) {
      return;
    }

    setStatusText('Drone scan in progress...');
    setProgressStageLabel('Scanning Property...');

    const drone = new THREE.Group();

    const droneBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.16, 0.52),
      new THREE.MeshStandardMaterial({ color: 0x2f2f35 }),
    );
    droneBody.castShadow = true;
    droneBody.receiveShadow = true;
    drone.add(droneBody);

    const rotorGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.03, 14);
    const rotorMaterial = new THREE.MeshStandardMaterial({ color: 0x575d66 });
    const rotorOffsets: Array<[number, number]> = [
      [-0.28, -0.28],
      [0.28, -0.28],
      [-0.28, 0.28],
      [0.28, 0.28],
    ];

    const rotors = rotorOffsets.map(([x, z]) => {
      const rotor = new THREE.Mesh(rotorGeometry, rotorMaterial);
      rotor.position.set(x, 0.08, z);
      rotor.castShadow = true;
      drone.add(rotor);
      return rotor;
    });

    drone.position.set(-10, 8, -8);
    sceneData.scene.add(drone);

    const rotorSpinTweens = rotors.map((rotor) =>
      gsap.to(rotor.rotation, {
        y: Math.PI * 2,
        duration: 0.14,
        ease: 'none',
        repeat: -1,
      }),
    );

    await new Promise<void>((resolve) => {
      gsap
        .timeline({
          onComplete: resolve,
        })
        .to(drone.position, {
          x: -1,
          y: 4.8,
          z: -1,
          duration: 1.25,
          ease: 'power2.out',
        })
        .to(drone.position, {
          y: 5.1,
          duration: 0.5,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: 1,
        })
        .to(drone.position, {
          x: 12,
          y: 6.9,
          z: 3,
          duration: 1,
          ease: 'power2.in',
        });
    });

    rotorSpinTweens.forEach((tween) => tween.kill());
    sceneData.scene.remove(drone);
  };

  const runGutterTask = () => {
    return new Promise<void>((resolve) => {
      const sceneData = sceneDataRef.current;
      if (!sceneData || !activeTasks.gutters) {
        resolve();
        return;
      }

      setStatusText('Gutter cleaning in progress...');
      setProgressStageLabel('Cleaning Gutters...');

      const dustBursts = [
        createDustParticleSystem(sceneData.scene, new THREE.Vector3(-1.4, 2.6, 1.45), 0x8a6b49),
        createDustParticleSystem(sceneData.scene, new THREE.Vector3(0.2, 2.65, 1.45), 0xa3a3a3),
        createDustParticleSystem(sceneData.scene, new THREE.Vector3(1.2, 2.6, -1.45), 0x7e5d42),
      ];

      dustBursts.forEach(({ points, material }) => {
        gsap.to(points.position, {
          y: 0.2,
          duration: 1,
          ease: 'power1.in',
        });
        gsap.to(material, {
          opacity: 0,
          duration: 1,
          ease: 'power1.out',
        });
      });

      gsap.to(sceneData.gutterDebris.map((mesh) => mesh.scale), {
        x: 0.01,
        y: 0.01,
        z: 0.01,
        duration: 1.45,
        stagger: 0.05,
        onComplete: () => {
          sceneData.gutterDebris.forEach((debris) => {
            debris.visible = false;
          });

          dustBursts.forEach(({ points, geometry, material }) => {
            sceneData.scene.remove(points);
            geometry.dispose();
            material.dispose();
          });

          setActiveTasks((current) => ({ ...current, gutters: false }));
          resolve();
        },
      });
    });
  };

  const runExteriorWashTask = () => {
    return new Promise<void>((resolve) => {
      const sceneData = sceneDataRef.current;
      if (!sceneData || !activeTasks.wash) {
        resolve();
        return;
      }

      setStatusText('Exterior washing in progress...');
      setProgressStageLabel('Washing House...');

      const sprayGroup = new THREE.Group();
      const particleGeometry = new THREE.SphereGeometry(0.05, 8, 8);
      const particleMaterial = new THREE.MeshStandardMaterial({
        color: 0x53b8ff,
        emissive: 0x1f7bc8,
        emissiveIntensity: 0.3,
      });

      const sprayOrigin = new THREE.Vector3(-2.7, 1.35, 2.1);

      for (let index = 0; index < 44; index += 1) {
        const drop = new THREE.Mesh(particleGeometry, particleMaterial);
        drop.position.set(
          sprayOrigin.x + (Math.random() - 0.5) * 0.25,
          sprayOrigin.y + (Math.random() - 0.5) * 0.25,
          sprayOrigin.z + (Math.random() - 0.5) * 0.2,
        );
        drop.castShadow = true;
        sprayGroup.add(drop);
      }

      sceneData.scene.add(sprayGroup);

      sprayGroup.children.forEach((child, index) => {
        const mesh = child as THREE.Mesh;
        const targetX = -0.9 + Math.random() * 2.1;
        const targetY = 0.9 + Math.random() * 1.8;
        const targetZ = 1.55;

        gsap.to(mesh.position, {
          x: targetX,
          y: targetY,
          z: targetZ,
          duration: 0.75,
          delay: index * 0.018,
          repeat: 2,
          repeatRefresh: true,
          ease: 'power1.out',
        });

        gsap.to(mesh.scale, {
          x: 0.65,
          y: 0.65,
          z: 0.65,
          duration: 0.55,
          yoyo: true,
          repeat: 5,
          ease: 'sine.inOut',
        });
      });

      const wallMaterial = sceneData.houseWalls.material as THREE.MeshStandardMaterial;
      wallMaterial.color.set(0x666666);

      gsap.to(wallMaterial.color, {
        r: 1,
        g: 1,
        b: 1,
        duration: 3,
        ease: 'power1.inOut',
        onComplete: () => {
          sceneData.scene.remove(sprayGroup);
          particleGeometry.dispose();
          particleMaterial.dispose();
          setActiveTasks((current) => ({ ...current, wash: false }));
          resolve();
        },
      });
    });
  };

  const runWeedRemovalTask = () => {
    return new Promise<void>((resolve) => {
      const sceneData = sceneDataRef.current;
      if (!sceneData || !activeTasks.weeds) {
        resolve();
        return;
      }

      setStatusText('Weed removal in progress...');
      setProgressStageLabel('Removing Weeds...');

      gsap.to(weedClusters.map((mesh) => mesh.scale), {
        y: 0,
        x: 0,
        z: 0,
        duration: 1.5,
        ease: 'back.in(1.7)',
        stagger: 0.03,
        onComplete: () => {
          setActiveTasks((current) => ({ ...current, weeds: false }));
          resolve();
        },
      });
    });
  };

  const resetScene = () => {
    const sceneData = sceneDataRef.current;
    if (!sceneData) {
      return;
    }

    overgrownGrass.forEach((mesh) => {
      mesh.visible = true;
      mesh.scale.set(1, 1, 1);
    });

    sceneData.gutterDebris.forEach((mesh) => {
      mesh.visible = true;
      mesh.scale.set(1, 1, 1);
    });

    weedClusters.forEach((mesh) => {
      mesh.visible = true;
      mesh.scale.set(1, 1, 1);
    });

    yardMess.forEach((mesh) => {
      mesh.visible = true;
      mesh.scale.set(1, 1, 1);
    });

    const wallMaterial = sceneData.houseWalls.material as THREE.MeshStandardMaterial;
    wallMaterial.color.copy(sceneData.wallStartColor);

    if (progressRef.current) {
      gsap.set(progressRef.current, { width: '0%' });
    }

    setActiveTasks({ lawn: true, gutters: true, wash: true, weeds: true });
    setProgressStageLabel('Progress');
    setStatusText('Scene reset. Select services, then click Run Sequence.');
  };

  const runSequence = async () => {
    if (isRunning) {
      return;
    }

    const sequenceOrder: Array<{ id: TaskId; run: () => Promise<void> }> = [
      { id: 'lawn', run: runLawnMowingTask },
      { id: 'gutters', run: runGutterTask },
      { id: 'wash', run: runExteriorWashTask },
      { id: 'weeds', run: runWeedRemovalTask },
    ];

    const enabledTasks = sequenceOrder.filter((entry) => activeTasks[entry.id]);

    if (enabledTasks.length === 0) {
      setStatusText('Select at least one service to run.');
      return;
    }

    setIsRunning(true);
    setStatusText('Starting service sequence...');
    setProgressStageLabel('Starting...');

    if (progressRef.current) {
      gsap.set(progressRef.current, { width: '0%' });
    }

    try {
      await runDroneScan();

      let completeCount = 0;
      for (const task of enabledTasks) {
        await task.run();
        completeCount += 1;
        const target = Math.round((completeCount / enabledTasks.length) * 100);
        await updateProgress(target);
      }

      setStatusText('Sequence complete. Your property looks clean.');
      setProgressStageLabel('Job Complete! Ready for Booking.');
    } finally {
      setIsRunning(false);
    }
  };

  const toggleTask = (id: TaskId) => {
    if (isRunning) {
      return;
    }

    setActiveTasks((current) => ({
      ...current,
      [id]: !current[id],
    }));
  };

  return (
    <div className="hiw-app mt-8">
      <div className="hiw-main-container">
        <div className="hiw-canvas-shell">
          <canvas id="webgl-canvas" ref={canvasRef} />
        </div>

        <aside className="hiw-sidebar">
          <h3 className="hiw-sidebar-title">Service Controls</h3>
          <p className="hiw-sidebar-subtitle">Toggle what needs to be done, then run the job sequence.</p>

          {TASKS.map((task) => {
            const isActive = activeTasks[task.id];
            return (
              <button
                key={task.id}
                type="button"
                className={`hiw-toggle-btn ${isActive ? 'active' : ''}`}
                data-service={task.id}
                aria-pressed={isActive}
                onClick={() => toggleTask(task.id)}
              >
                <span>{task.label}</span>
                <small>{task.description}</small>
              </button>
            );
          })}

          <button id="run-sequence-btn" type="button" className="hiw-run-sequence-btn" onClick={runSequence} disabled={isRunning}>
            {isRunning ? 'Running Sequence...' : 'Run Sequence'}
          </button>

          <button type="button" className="hiw-reset-btn" onClick={resetScene} disabled={isRunning}>
            Reset Scene
          </button>

          <p className="hiw-status-text">{statusText}</p>
          <p className="hiw-status-text">{progressStageLabel}</p>

          <div className="hiw-progress-track" aria-label="Progress track">
            <div id="progress-bar" ref={progressRef} className="hiw-progress-bar" />
          </div>
        </aside>
      </div>
    </div>
  );
}
