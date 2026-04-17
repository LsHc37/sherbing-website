'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';

type TaskId = 'lawn' | 'gutters' | 'weeds';

type SceneData = {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  overgrownGrass: THREE.Mesh[];
  gutterDebris: THREE.Mesh[];
  weeds: THREE.Mesh[];
  frameId: number;
};

const TASKS: Array<{ id: TaskId; label: string; description: string }> = [
  { id: 'lawn', label: 'Lawn Mowing', description: 'Cut long grass down to a clean finish.' },
  { id: 'gutters', label: 'Gutter Cleaning', description: 'Remove leaves and debris from roof edges.' },
  { id: 'weeds', label: 'Weed Removal', description: 'Clear visible weed clusters around the lawn.' },
];

const taskToProgress: Record<TaskId, number> = {
  lawn: 33,
  gutters: 66,
  weeds: 100,
};

export default function HowItWorksExperience() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneDataRef = useRef<SceneData | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  const [activeTasks, setActiveTasks] = useState<Record<TaskId, boolean>>({
    lawn: true,
    gutters: true,
    weeds: true,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [statusText, setStatusText] = useState('Select services, then click Run Sequence.');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8ec7ff);

    const parent = canvas.parentElement;
    const width = Math.max(parent?.clientWidth ?? 0, 100);
    const height = Math.max(parent?.clientHeight ?? 0, 100);

    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 1000);
    camera.position.set(9, 7, 10);
    camera.lookAt(0, 1, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.25);
    directionalLight.position.set(10, 16, 8);
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

    const lawn = new THREE.Mesh(
      new THREE.BoxGeometry(20, 1, 20),
      new THREE.MeshStandardMaterial({ color: 0x47a447 }),
    );
    lawn.position.y = -0.5;
    scene.add(lawn);

    const house = new THREE.Group();

    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 2.2, 3),
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
    );
    walls.position.y = 1.1;
    house.add(walls);

    const roofLeft = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.2, 1.9),
      new THREE.MeshStandardMaterial({ color: 0x7a4e2c }),
    );
    roofLeft.position.set(0, 2.4, -0.5);
    roofLeft.rotation.x = 0.5;
    house.add(roofLeft);

    const roofRight = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.2, 1.9),
      new THREE.MeshStandardMaterial({ color: 0x7a4e2c }),
    );
    roofRight.position.set(0, 2.4, 0.5);
    roofRight.rotation.x = -0.5;
    house.add(roofRight);

    scene.add(house);

    const overgrownGrass: THREE.Mesh[] = [];
    const grassGeometry = new THREE.CylinderGeometry(0.06, 0.08, 1.0, 7);
    const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x1f8f35 });

    for (let index = 0; index < 50; index += 1) {
      const grass = new THREE.Mesh(grassGeometry, grassMaterial);
      let x = (Math.random() - 0.5) * 17;
      let z = (Math.random() - 0.5) * 17;

      if (Math.abs(x) < 2.4 && Math.abs(z) < 2.3) {
        x += x >= 0 ? 3.1 : -3.1;
        z += z >= 0 ? 3.1 : -3.1;
      }

      grass.position.set(x, 0.5, z);
      scene.add(grass);
      overgrownGrass.push(grass);
    }

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

    const weeds: THREE.Mesh[] = [];
    const weedGeometry = new THREE.SphereGeometry(0.12, 12, 12);
    const weedMaterial = new THREE.MeshStandardMaterial({ color: 0xd8cc45 });

    for (let index = 0; index < 28; index += 1) {
      const weed = new THREE.Mesh(weedGeometry, weedMaterial);
      let x = (Math.random() - 0.5) * 14;
      let z = (Math.random() - 0.5) * 14;

      if (Math.abs(x) < 2.2 && Math.abs(z) < 2.2) {
        x += x >= 0 ? 2.8 : -2.8;
        z += z >= 0 ? 2.8 : -2.8;
      }

      weed.position.set(x, 0.12, z);
      scene.add(weed);
      weeds.push(weed);
    }

    let frameId = 0;

    const animate = () => {
      camera.position.x = Math.cos(Date.now() * 0.0002) * 10;
      camera.position.z = Math.sin(Date.now() * 0.0002) * 10;
      camera.lookAt(0, 1, 0);
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    sceneDataRef.current = {
      renderer,
      camera,
      scene,
      overgrownGrass,
      gutterDebris,
      weeds,
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

      gsap.to(sceneData.overgrownGrass.map((mesh) => mesh.scale), {
        y: 0.1,
        duration: 2,
        stagger: 0.03,
        onComplete: resolve,
      });
    });
  };

  const runGutterTask = () => {
    return new Promise<void>((resolve) => {
      const sceneData = sceneDataRef.current;
      if (!sceneData || !activeTasks.gutters) {
        resolve();
        return;
      }

      setStatusText('Gutter cleaning in progress...');

      gsap.to(sceneData.gutterDebris.map((mesh) => mesh.scale), {
        x: 0.01,
        y: 0.01,
        z: 0.01,
        duration: 1.4,
        stagger: 0.05,
        onComplete: () => {
          sceneData.gutterDebris.forEach((debris) => {
            debris.visible = false;
          });
          resolve();
        },
      });
    });
  };

  const runWeedTask = () => {
    return new Promise<void>((resolve) => {
      const sceneData = sceneDataRef.current;
      if (!sceneData || !activeTasks.weeds) {
        resolve();
        return;
      }

      setStatusText('Weed removal in progress...');

      gsap.to(sceneData.weeds.map((mesh) => mesh.scale), {
        y: 0.01,
        x: 0.01,
        z: 0.01,
        duration: 1.6,
        stagger: 0.03,
        onComplete: resolve,
      });
    });
  };

  const resetScene = () => {
    const sceneData = sceneDataRef.current;
    if (!sceneData) {
      return;
    }

    sceneData.overgrownGrass.forEach((mesh) => {
      mesh.visible = true;
      mesh.scale.set(1, 1, 1);
    });

    sceneData.gutterDebris.forEach((mesh) => {
      mesh.visible = true;
      mesh.scale.set(1, 1, 1);
    });

    sceneData.weeds.forEach((mesh) => {
      mesh.visible = true;
      mesh.scale.set(1, 1, 1);
    });

    if (progressRef.current) {
      gsap.set(progressRef.current, { width: '0%' });
    }

    setStatusText('Scene reset. Select services, then click Run Sequence.');
  };

  const runSequence = async () => {
    if (isRunning) {
      return;
    }

    setIsRunning(true);
    setStatusText('Starting service sequence...');

    try {
      await runLawnMowingTask();
      if (activeTasks.lawn) {
        await updateProgress(taskToProgress.lawn);
      }

      await runGutterTask();
      if (activeTasks.gutters) {
        await updateProgress(taskToProgress.gutters);
      }

      await runWeedTask();
      if (activeTasks.weeds) {
        await updateProgress(taskToProgress.weeds);
      }

      setStatusText('Sequence complete. Your property looks clean.');
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

          <div className="hiw-progress-track" aria-label="Progress track">
            <div id="progress-bar" ref={progressRef} className="hiw-progress-bar" />
          </div>
        </aside>
      </div>
    </div>
  );
}
