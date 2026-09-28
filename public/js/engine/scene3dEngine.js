/**
 * BYE QUIZ LIVE - High Performance 3D Cyber Studio Arena WebGL Engine
 * Highly Optimized Instanced Rendering Pipeline (Sub-40 Draw Calls, GPU Batching)
 * True 3D PerspectiveCamera, Studio Lighting, Curved 3D Backdrop, LED Light Pillars,
 * 36 Avatar Pedestals with Realistic Contact Shadows, PBR Materials, Instanced 3D Confetti.
 */

(function(global) {
  'use strict';

  
  

  class Scene3DEngine {
    constructor(canvasId = 'webgl-stage') {
      this.canvasId = canvasId;
      this.canvas = document.getElementById(canvasId);
      this.isSupported = false;
      this.isInitialized = false;
      this.qualityTier = 'HIGH'; // HIGH | MEDIUM | LOW

      // Core Three.js components
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.clock = null;

      // Camera Animation / Interpolation
      this.camCurrentPos = null;
      this.camTargetPos = null;
      this.camCurrentLook = null;
      this.camTargetLook = null;
      this.camLerpSpeed = 0.05;

      // Instanced Meshes for Ultra-Low Draw Calls
      this.instancedBases = null;
      this.instancedRings = null;
      this.instancedShadows = null;
      this.instancedLedPillars = null;
      this.instancedConfetti = null;

      // Studio Backdrop & Stage
      this.backdropMesh = null;
      this.centralStage = null;
      this.ambientParticles = null;

      // 36 Pedestal Logical State Tracking
      this.pedestals = [];
      this.avatarMeshes = [];

      // Confetti physics state
      this.confettiData = [];
      this.confettiActive = false;

      // Lighting references
      this.lights = {
        ambient: null,
        keyLight: null,
        spotLight: null
      };

      // Realtime Performance Metrics
      this.metrics = {
        fps: 60,
        frameTime: 16.6,
        drawCalls: 0,
        triangles: 0,
        geometries: 0,
        textures: 0,
        framesCount: 0,
        lastTime: (typeof performance !== 'undefined' ? performance : Date).now()
      };

      // Texture cache to prevent memory leaks
      this.avatarTextureCache = new Map();

      // Zero-allocation reusable math scratchpad
      const THREE = global.THREE;
      this._scratchMat = new THREE.Matrix4();
      this._scratchPos = new THREE.Vector3();
      this._scratchRot = new THREE.Euler();
      this._scratchScale = new THREE.Vector3(1, 1, 1);
      this._shadowScale = new THREE.Vector3(1, 1, 1);
      this._confMat = new THREE.Matrix4();
      this._confPos = new THREE.Vector3();
      this._confRot = new THREE.Euler();
      this._confScale = new THREE.Vector3(1, 1, 1);

      // Check Three.js availability
      if (typeof THREE !== 'undefined') {
        this.init();
      } else {
        console.warn('[Scene3D] THREE is not loaded. Fallback to 2.5D CSS mode active.');
      }
    }

    init() {
      if (!this.canvas) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = this.canvasId;
        this.canvas.className = 'webgl-stage-canvas';
        const container = document.querySelector('.studio-arena-viewport') || document.body;
        container.insertBefore(this.canvas, container.firstChild);
      }

      try {
        const THREE = global.THREE;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x04060e);

        const width = this.canvas.clientWidth || window.innerWidth || 800;
        const height = this.canvas.clientHeight || window.innerHeight || 600;

        // True Perspective Camera
        this.camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 1000);
        this.camCurrentPos = new THREE.Vector3(0, 16, 26);
        this.camTargetPos = new THREE.Vector3(0, 16, 26);
        this.camCurrentLook = new THREE.Vector3(0, 0, 0);
        this.camTargetLook = new THREE.Vector3(0, 0, 0);
        this.camera.position.copy(this.camCurrentPos);
        this.camera.lookAt(this.camCurrentLook);

        // WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({
          canvas: this.canvas,
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance'
        });

        const pixelRatio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
        this.renderer.setPixelRatio(pixelRatio);
        this.renderer.setSize(width, height);
        this.renderer.setClearColor(0x04060e, 1.0);

        this.clock = new THREE.Clock();

        // Build Optimized 3D Studio Arena
        this._buildLighting();
        this._buildStudioEnvironment();
        this._buildCurvedStudioBackdrop();
        this._buildOptimized36Pedestals();
        this._buildAtmosphericParticles();
        this._buildInstancedConfettiPool();

        this.isSupported = true;
        this.isInitialized = true;

        // Handle Resizing
        window.addEventListener('resize', () => this.onResize());

        // Start 60 FPS Render Loop
        this._animate();

        // Mark DOM for WebGL active state
        document.body.classList.add('webgl-active');
        console.log('[Scene3D] High-Performance WebGL 3D Studio Arena initialized successfully.');
      } catch (err) {
        console.error('[Scene3D] Failed to initialize WebGL Renderer:', err);
        this.isSupported = false;
        document.body.classList.remove('webgl-active');
      }
    }

    _buildLighting() {
      const THREE = global.THREE;
      // Ambient studio fill light
      this.lights.ambient = new THREE.AmbientLight(0x1a243a, 1.3);
      this.scene.add(this.lights.ambient);

      // Key Directional Light with Optimized Shadow Map
      this.lights.keyLight = new THREE.DirectionalLight(0xd4eaff, 1.4);
      this.lights.keyLight.position.set(15, 30, 20);
      this.lights.keyLight.castShadow = true;
      this.scene.add(this.lights.keyLight);

      // Central Spotlight on stage
      this.lights.spotLight = new THREE.SpotLight(0x00f3ff, 1.8, 50, Math.PI / 3.5, 0.5);
      this.lights.spotLight.position.set(0, 25, 0);
      this.lights.spotLight.castShadow = true;
      this.scene.add(this.lights.spotLight);
    }

    _buildStudioEnvironment() {
      const THREE = global.THREE;

      // 1. Open studio background — no metallic floor panel.
      // The 3D stage remains through lighting, backdrop and central elements.

      // 2. Concentric Neon Stage Rings on the open stage (Shared Geometry)
      const ringOuterGeo = new THREE.TorusGeometry(12, 0.08, 4, 24);
      const ringOuterMat = new THREE.MeshStandardMaterial({
        color: 0x00f3ff,
        emissive: 0x00f3ff,
        emissiveIntensity: 0.8,
        roughness: 0.2
      });
      const ringOuter = new THREE.Mesh(ringOuterGeo, ringOuterMat);
      ringOuter.position.set(0, 0.02, 0);
      this.scene.add(ringOuter);

      const ringInnerGeo = new THREE.TorusGeometry(6, 0.06, 4, 24);
      const ringInnerMat = new THREE.MeshStandardMaterial({
        color: 0x7928ca,
        emissive: 0x7928ca,
        emissiveIntensity: 0.6,
        roughness: 0.2
      });
      const ringInner = new THREE.Mesh(ringInnerGeo, ringInnerMat);
      ringInner.position.set(0, 0.02, 0);
      this.scene.add(ringInner);

      // 3. Central Holographic Question Plinth
      const plinthGeo = new THREE.CylinderGeometry(2.4, 2.8, 0.6, 16);
      const plinthMat = new THREE.MeshStandardMaterial({
        color: 0x0b1324,
        emissive: 0x00f3ff,
        emissiveIntensity: 0.25,
        roughness: 0.3,
        metalness: 0.9
      });
      this.centralStage = new THREE.Mesh(plinthGeo, plinthMat);
      this.centralStage.position.set(0, 0.25, 0);
      this.scene.add(this.centralStage);
    }

    // --- 1. Curved 3D Studio Backdrop & LED Columns ---
    _buildCurvedStudioBackdrop() {
      const THREE = global.THREE;

      // Curved Cylindrical Arena Wall Geometry (Arc behind the arena)
      const radius = 22;
      const height = 14;
      const segments = 20;
      const arc = Math.PI * 0.85; // 153 degrees curved enclosure
      const startAngle = Math.PI * 1.5 - arc / 2;

      const positions = [];
      const normals = [];
      const uvs = [];
      const indices = [];

      for (let y = 0; y <= 1; y++) {
        const py = y === 0 ? -0.1 : height;
        for (let s = 0; s <= segments; s++) {
          const theta = startAngle + (s / segments) * arc;
          const px = Math.cos(theta) * radius;
          const pz = Math.sin(theta) * radius - 2.5;

          positions.push(px, py, pz);
          // Normal pointing towards center stage
          normals.push(-Math.cos(theta), 0, -Math.sin(theta));
          uvs.push(s / segments, y);
        }
      }

      for (let s = 0; s < segments; s++) {
        const a = s;
        const b = s + segments + 1;
        const c = s + 1;
        const d = s + segments + 2;
        indices.push(a, b, c);
        indices.push(c, b, d);
      }

      const backdropGeo = new THREE.BufferGeometry();
      backdropGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
      backdropGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
      backdropGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
      backdropGeo.setIndex(indices);

      const backdropMat = new THREE.MeshStandardMaterial({
        color: 0x060b16,
        roughness: 0.6,
        metalness: 0.4
      });

      this.backdropMesh = new THREE.Mesh(backdropGeo, backdropMat);
      this.scene.add(this.backdropMesh);

      // 10 Vertical LED Light Accent Columns (Hardware Instanced - 1 Draw Call!)
      const pillarCount = 10;
      const pillarGeo = new THREE.CylinderGeometry(0.08, 0.08, 12, 6);
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0x00f3ff,
        emissive: 0x00f3ff,
        emissiveIntensity: 0.6,
        roughness: 0.2
      });

      this.instancedLedPillars = new THREE.InstancedMesh(pillarGeo, pillarMat, pillarCount);
      const pMat = new THREE.Matrix4();
      const pPos = new THREE.Vector3();
      const pRot = new THREE.Euler();
      const pScale = new THREE.Vector3(1, 1, 1);

      for (let i = 0; i < pillarCount; i++) {
        const theta = startAngle + ((i + 0.5) / pillarCount) * arc;
        const px = Math.cos(theta) * (radius - 0.2);
        const pz = Math.sin(theta) * (radius - 0.2) - 2.5;

        pPos.set(px, 6.0, pz);
        pMat.compose(pPos, pRot, pScale);
        this.instancedLedPillars.setMatrixAt(i, pMat);
        
        // Alternate cyan / magenta neon pillars
        const col = (i % 2 === 0) ? new THREE.Color(0x00f3ff) : new THREE.Color(0x7928ca);
        this.instancedLedPillars.setColorAt(i, col);
      }

      // Decorative vertical LED columns are disabled for the clean registration stage.
      this.instancedLedPillars.visible = false;
      this.scene.add(this.instancedLedPillars);
    }

    // --- 2. 36 Pedestals with Realistic Contact Shadows ---
    _buildOptimized36Pedestals() {
      const THREE = global.THREE;
      this.pedestals = [];
      this.avatarMeshes = [];

      // Shared geometries with optimized polygon budget
      const baseGeo = new THREE.CylinderGeometry(0.65, 0.8, 0.35, 12);
      const ringGeo = new THREE.TorusGeometry(0.68, 0.04, 4, 12);
      const coinGeo = new THREE.CircleGeometry(0.55, 12);
      const shadowGeo = new THREE.CircleGeometry(0.85, 12);

      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x111c30,
        roughness: 0.25,
        metalness: 0.8
      });

      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x00f3ff,
        emissive: 0x00f3ff,
        emissiveIntensity: 0.5
      });

      // Procedural Soft Shadow Texture for Realistic Contact Shadows
      const shadowCanvas = document.createElement('canvas');
      shadowCanvas.width = 64;
      shadowCanvas.height = 64;
      const sctx = shadowCanvas.getContext('2d');
      const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
      grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.5)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      sctx.fillStyle = grad;
      sctx.beginPath();
      sctx.arc(32, 32, 32, 0, Math.PI * 2);
      sctx.fill();

      const shadowTex = new THREE.CanvasTexture(shadowCanvas);
      const shadowMat = new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.75,
        depthWrite: false
      });

      // Hardware Instanced Meshes (36 Bases + 36 Rings + 36 Shadows = 3 Draw Calls!)
      this.instancedShadows = new THREE.InstancedMesh(shadowGeo, shadowMat, 36);
      this.instancedBases = new THREE.InstancedMesh(baseGeo, baseMat, 36);
      this.instancedRings = new THREE.InstancedMesh(ringGeo, ringMat, 36);

      this.scene.add(this.instancedShadows);
      this.scene.add(this.instancedBases);
      this.scene.add(this.instancedRings);

      // The public guest UI uses TikTok-style circular DOM seats.
      // Hide the legacy WebGL pedestal grid so the old 36-seat floor
      // can never appear behind the new guest layout.
      this.instancedShadows.visible = false;
      this.instancedBases.visible = false;
      this.instancedRings.visible = false;

      // Arrange 36 seats in a 6x6 arena layout with circular curving
      const cols = 6;
      const rows = 6;
      const spacingX = 2.4;
      const spacingZ = 2.2;
      const startX = -((cols - 1) * spacingX) / 2;
      const startZ = -((rows - 1) * spacingZ) / 2 - 1.5;

      
      
      
      
      const defaultColor = new THREE.Color(0x00f3ff);

      let index = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const posX = startX + c * spacingX;
          const posZ = startZ + r * spacingZ;
          const archCurve = Math.sin((c / (cols - 1)) * Math.PI) * 0.4;
          const posY = 0.18 + archCurve;

          // Initial Contact Shadow transform (flat on the floor plane)
          this._scratchPos.set(posX, 0.005, posZ);
          this._scratchMat.compose(this._scratchPos, this._scratchRot, this._scratchScale);
          this.instancedShadows.setMatrixAt(index, this._scratchMat);

          // Initial Base transform
          this._scratchPos.set(posX, posY, posZ);
          this._scratchMat.compose(this._scratchPos, this._scratchRot, this._scratchScale);
          this.instancedBases.setMatrixAt(index, this._scratchMat);

          // Initial Ring transform
          this._scratchPos.set(posX, posY + 0.18, posZ);
          this._scratchMat.compose(this._scratchPos, this._scratchRot, this._scratchScale);
          this.instancedRings.setMatrixAt(index, this._scratchMat);
          this.instancedRings.setColorAt(index, defaultColor);

          // Individual Avatar Mesh for Dynamic Textures
          const avatarMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true
          });
          const avatarMesh = new THREE.Mesh(coinGeo, avatarMat);
          avatarMesh.position.set(posX, posY + 0.19, posZ);
          avatarMesh.visible = false; // Hidden until participant joins
          this.scene.add(avatarMesh);
          this.avatarMeshes.push(avatarMesh);

          this.pedestals.push({
            id: index + 1,
            index: index,
            posX: posX,
            posZ: posZ,
            baseY: posY,
            targetY: posY,
            currentY: posY,
            avatarMesh: avatarMesh,
            state: 'IDLE', // IDLE | ACTIVE | CORRECT | WRONG | WINNER
            pulsePhase: index * 0.25,
            wobbleTime: 0,
            user: null
          });

          index++;
        }
      }
    }

    _buildAtmosphericParticles() {
      const THREE = global.THREE;
      const count = 45;
      const positions = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 30;
        positions[i * 3 + 1] = Math.random() * 15;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const mat = new THREE.PointsMaterial({
        color: 0x00f3ff,
        size: 3.5,
        transparent: true,
        opacity: 0.65
      });

      this.ambientParticles = new THREE.Points(geo, mat);
      this.scene.add(this.ambientParticles);
    }

    _buildInstancedConfettiPool() {
      const THREE = global.THREE;
      const count = 60;
      const confettiGeo = new THREE.BoxGeometry(0.18, 0.08, 0.02);
      const confettiMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

      // Single InstancedMesh for all 60 confetti pieces (1 draw call!)
      this.instancedConfetti = new THREE.InstancedMesh(confettiGeo, confettiMat, count);
      this.instancedConfetti.visible = false;
      this.scene.add(this.instancedConfetti);

      this.confettiData = [];
      const colors = [0xffd700, 0x00f3ff, 0xff007a, 0x00ff88, 0xffffff];
      for (let i = 0; i < count; i++) {
        const c = new THREE.Color(colors[i % colors.length]);
        this.instancedConfetti.setColorAt(i, c);
        this.confettiData.push({
          x: 0, y: -10, z: 0,
          vx: 0, vy: 0, vz: 0,
          rx: 0, ry: 0,
          life: 0
        });
      }
    }

    // --- Dynamic User Avatar Texture Generator ---
    setPedestalUser(seatIndex, user) {
      if (seatIndex < 0 || seatIndex >= this.pedestals.length) return;
      const pedestal = this.pedestals[seatIndex];
      pedestal.user = user;

      const avatarMesh = this.avatarMeshes[seatIndex];
      if (!user) {
        if (avatarMesh) avatarMesh.visible = false;
        return;
      }

      if (avatarMesh) avatarMesh.visible = true;
      const avatarUrl = user.avatar || user.profilePictureUrl || user.profilePicture || user.avatarUrl;
      const name = user.displayName || user.nickname || user.username || `Seat ${seatIndex + 1}`;

      this._loadOrCreateAvatarTexture(avatarUrl, name, (texture) => {
        if (avatarMesh && avatarMesh.material) {
          avatarMesh.material.map = texture;
          avatarMesh.material.needsUpdate = true;
        }
      });
    }

    _loadOrCreateAvatarTexture(url, name, callback) {
      const THREE = global.THREE;
      const cacheKey = url || name;
      if (this.avatarTextureCache.has(cacheKey)) {
        callback(this.avatarTextureCache.get(cacheKey));
        return;
      }

      // Procedural Canvas Avatar Texture with crisp neon borders
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      // Draw cyber disc base
      ctx.fillStyle = '#0b1329';
      ctx.beginPath();
      ctx.arc(64, 64, 62, 0, Math.PI * 2);
      ctx.fill();

      // Draw User Initial if image is loading or fails
      ctx.fillStyle = '#00f3ff';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initial = (name || 'P').trim().charAt(0).toUpperCase();
      ctx.fillText(initial, 64, 66);

      // Gold / Neon Outer Ring
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 6;
      ctx.stroke();

      const texture = new THREE.CanvasTexture(canvas);
      this.avatarTextureCache.set(cacheKey, texture);
      callback(texture);

      // Load real image asynchronously if URL provided
      if (url && typeof Image !== 'undefined') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.save();
          ctx.beginPath();
          ctx.arc(64, 64, 58, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, 6, 6, 116, 116);
          ctx.restore();

          // Re-stroke border
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(64, 64, 60, 0, Math.PI * 2);
          ctx.stroke();

          texture.needsUpdate = true;
        };
        img.src = url;
      }
    }

    // --- Pedestal State & Reaction Controls ---
    setPedestalState(seatIndex, state) {
      if (seatIndex < 0 || seatIndex >= this.pedestals.length) return;
      const p = this.pedestals[seatIndex];
      p.state = state;

      const THREE = global.THREE;
      if (state === 'CORRECT') {
        p.targetY = p.baseY + 1.2;
        if (this.instancedRings) {
          this.instancedRings.setColorAt(seatIndex, new THREE.Color(0x00ff88));
        }
      } else if (state === 'WRONG') {
        p.targetY = p.baseY - 0.1;
        p.wobbleTime = 1.0;
        if (this.instancedRings) {
          this.instancedRings.setColorAt(seatIndex, new THREE.Color(0xff3366));
        }
      } else if (state === 'WINNER') {
        p.targetY = p.baseY + 2.5;
        if (this.instancedRings) {
          this.instancedRings.setColorAt(seatIndex, new THREE.Color(0xffd700));
        }
        this.triggerWinnerConfetti(p.posX, p.posZ);
      } else if (state === 'ACTIVE') {
        p.targetY = p.baseY + 0.3;
        if (this.instancedRings) {
          this.instancedRings.setColorAt(seatIndex, new THREE.Color(0x00f3ff));
        }
      } else {
        // IDLE
        p.targetY = p.baseY;
        if (this.instancedRings) {
          this.instancedRings.setColorAt(seatIndex, new THREE.Color(0x00f3ff));
        }
      }
    }

    resetAllPedestals() {
      for (let i = 0; i < this.pedestals.length; i++) {
        this.setPedestalState(i, 'IDLE');
      }
    }

    // --- Instanced 3D Confetti & Victory Particle Burst ---
    triggerWinnerConfetti(originX = 0, originZ = 0) {
      if (!this.instancedConfetti) return;
      this.instancedConfetti.visible = true;
      this.confettiActive = true;

      for (let i = 0; i < this.confettiData.length; i++) {
        const c = this.confettiData[i];
        c.x = originX + (Math.random() - 0.5) * 1.5;
        c.y = 3.0 + Math.random() * 0.5;
        c.z = originZ + (Math.random() - 0.5) * 1.5;
        c.vx = (Math.random() - 0.5) * 6;
        c.vy = Math.random() * 8 + 4;
        c.vz = (Math.random() - 0.5) * 6;
        c.rx = Math.random() * 0.2;
        c.ry = Math.random() * 0.2;
        c.life = 4.0;
      }
    }

    // --- True 3D Camera Modes with Smooth Interpolation ---
    setCameraMode(mode, targetSeat = null) {
      if (!this.isSupported) return;

      const THREE = global.THREE;
      switch (mode) {
        case 'WIDE':
        case 'cam-wide':
        case 'LOBBY':
          this.camTargetPos.set(0, 16, 26);
          this.camTargetLook.set(0, 0, 0);
          this.camLerpSpeed = 0.04;
          break;

        case 'SEATS':
        case 'cam-seats':
          this.camTargetPos.set(0, 12, 20);
          this.camTargetLook.set(0, 0.5, -1);
          this.camLerpSpeed = 0.05;
          break;

        case 'QUESTION':
        case 'cam-question':
          this.camTargetPos.set(0, 9.5, 15.5);
          this.camTargetLook.set(0, 1.8, 0);
          this.camLerpSpeed = 0.06;
          break;

        case 'LOCK':
        case 'cam-lock':
          this.camTargetPos.set(0, 8.5, 13.5);
          this.camTargetLook.set(0, 1.6, 0);
          this.camLerpSpeed = 0.08;
          break;

        case 'ANSWERS':
        case 'cam-answers':
        case 'RESULT':
          this.camTargetPos.set(0, 13, 18);
          this.camTargetLook.set(0, 1.0, 0);
          this.camLerpSpeed = 0.05;
          break;

        case 'WINNER':
        case 'cam-winner':
          if (targetSeat !== null && this.pedestals[targetSeat]) {
            const p = this.pedestals[targetSeat];
            this.camTargetPos.set(p.posX * 0.6, 5.5, p.posZ + 6.5);
            this.camTargetLook.set(p.posX, 2.5, p.posZ);
          } else {
            this.camTargetPos.set(0, 6.5, 12);
            this.camTargetLook.set(0, 2.2, 0);
          }
          this.camLerpSpeed = 0.06;
          break;

        case 'PODIUM':
        case 'cam-podium':
          this.camTargetPos.set(0, 6.0, 10.5);
          this.camTargetLook.set(0, 2.8, 0);
          this.camLerpSpeed = 0.05;
          break;

        default:
          this.camTargetPos.set(0, 16, 26);
          this.camTargetLook.set(0, 0, 0);
          this.camLerpSpeed = 0.04;
          break;
      }
    }

    onResize() {
      if (!this.canvas || !this.renderer || !this.camera) return;
      const width = this.canvas.parentElement ? this.canvas.parentElement.clientWidth : window.innerWidth;
      const height = this.canvas.parentElement ? this.canvas.parentElement.clientHeight : window.innerHeight;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();

      const pixelRatio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      this.renderer.setPixelRatio(pixelRatio);
      this.renderer.setSize(width, height);
    }

    _animate() {
      if (!this.isInitialized || !this.renderer) return;

      const THREE = global.THREE;
      const delta = this.clock ? this.clock.getDelta() : 0.016;
      const elapsed = this.clock ? this.clock.getElapsedTime() : 0;

      // 1. Smooth Camera Interpolation
      if (this.camera) {
        this.camCurrentPos.lerp(this.camTargetPos, this.camLerpSpeed);
        this.camCurrentLook.lerp(this.camTargetLook, this.camLerpSpeed);
        this.camera.position.copy(this.camCurrentPos);
        this.camera.lookAt(this.camCurrentLook);
      }

      // 2. Animate 36 Pedestals and Dynamic Contact Shadows
      

      for (let i = 0; i < this.pedestals.length; i++) {
        const p = this.pedestals[i];
        const dy = p.targetY - p.currentY;
        const isMoving = Math.abs(dy) > 0.001 || p.wobbleTime > 0;

        if (isMoving) {
          p.currentY += dy * 0.1;
          let wobble = 0;
          if (p.wobbleTime > 0) {
            wobble = Math.sin(p.wobbleTime * 25) * 0.08;
            p.wobbleTime -= delta;
          }

          const effectiveY = p.currentY;
          const effectiveX = p.posX + wobble * delta;

          // Dynamic Contact Shadow Diffusion: expands and softens when pedestal elevates
          const elevationHeight = Math.max(0, effectiveY - p.baseY);
          const shadowSpread = 1.0 + elevationHeight * 0.25;
          const shadowShrink = Math.max(0.1, 1.0 - elevationHeight * 0.4);

          this._scratchPos.set(effectiveX, 0.005, p.posZ);
          this._shadowScale.set(shadowSpread * shadowShrink, shadowSpread * shadowShrink, 1);
          this._scratchMat.compose(this._scratchPos, this._scratchRot, this._shadowScale);
          if (this.instancedShadows) {
            this.instancedShadows.setMatrixAt(i, this._scratchMat);
          }

          // Update Base Instance Matrix
          this._scratchPos.set(effectiveX, effectiveY, p.posZ);
          this._scratchScale.set(1, 1, 1);
          this._scratchMat.compose(this._scratchPos, this._scratchRot, this._scratchScale);
          if (this.instancedBases) {
            this.instancedBases.setMatrixAt(i, this._scratchMat);
          }

          // Update Ring Instance Matrix
          this._scratchPos.set(effectiveX, effectiveY + 0.18, p.posZ);
          this._scratchMat.compose(this._scratchPos, this._scratchRot, this._scratchScale);
          if (this.instancedRings) {
            this.instancedRings.setMatrixAt(i, this._scratchMat);
          }

          // Update Avatar Mesh position
          if (this.avatarMeshes[i]) {
            this.avatarMeshes[i].position.set(effectiveX, effectiveY + 0.19, p.posZ);
          }
        }
      }

      // 3. Central Plinth Subtle Rotation
      if (this.centralStage) {
        this.centralStage.rotation.y += delta * 0.2;
      }

      // 4. Ambient Particles Drift
      if (this.ambientParticles && this.ambientParticles.geometry) {
        const posAttr = this.ambientParticles.geometry.getAttribute('position');
        if (posAttr && posAttr.array) {
          const arr = posAttr.array;
          for (let i = 1; i < arr.length; i += 3) {
            arr[i] += delta * 0.6;
            if (arr[i] > 18) arr[i] = 0;
          }
          posAttr.needsUpdate = true;
        }
      }

      // 5. Instanced Confetti Physics Loop (1 Draw Call!)
      if (this.confettiActive && this.instancedConfetti) {
        let activeCount = 0;
        

        for (let i = 0; i < this.confettiData.length; i++) {
          const c = this.confettiData[i];
          if (c.life > 0) {
            c.life -= delta;
            c.vy -= 9.8 * delta; // Gravity
            c.x += c.vx * delta;
            c.y += c.vy * delta;
            c.z += c.vz * delta;
            c.rx += delta * 5;
            c.ry += delta * 3;

            this._confPos.set(c.x, c.y, c.z);
            this._confRot.set(c.rx, c.ry, 0);
            this._confMat.compose(this._confPos, this._confRot, this._confScale);
            this.instancedConfetti.setMatrixAt(i, this._confMat);
            activeCount++;
          } else {
            this._confPos.set(0, -50, 0); // Move out of view
            this._confMat.compose(this._confPos, this._confRot, this._confScale);
            this.instancedConfetti.setMatrixAt(i, this._confMat);
          }
        }

        if (activeCount === 0) {
          this.confettiActive = false;
          this.instancedConfetti.visible = false;
        }
      }

      // 6. WebGL Render Pass
      this.renderer.render(this.scene, this.camera);

      // 7. Track Performance Metrics
      this._updateMetrics();

      requestAnimationFrame(() => this._animate());
    }

    _updateMetrics() {
      this.metrics.framesCount++;
      const now = (typeof performance !== 'undefined' ? performance : Date).now();
      const elapsedMs = now - this.metrics.lastTime;

      if (elapsedMs >= 1000) {
        this.metrics.fps = Math.round((this.metrics.framesCount * 1000) / elapsedMs);
        this.metrics.frameTime = parseFloat((elapsedMs / this.metrics.framesCount).toFixed(2));
        this.metrics.framesCount = 0;
        this.metrics.lastTime = now;

        if (this.renderer && this.renderer.info) {
          this.metrics.drawCalls = this.renderer.info.render.calls || 0;
          this.metrics.triangles = this.renderer.info.render.triangles || 0;
          this.metrics.geometries = this.renderer.info.memory.geometries || 0;
          this.metrics.textures = this.renderer.info.memory.textures || 0;
        }
      }
    }

    getPerformanceMetrics() {
      return {
        isWebGLActive: this.isSupported,
        fps: this.metrics.fps,
        frameTimeMs: this.metrics.frameTime,
        drawCalls: this.metrics.drawCalls,
        triangles: this.metrics.triangles,
        geometries: this.metrics.geometries,
        textures: this.metrics.textures,
        qualityTier: this.qualityTier
      };
    }
  }

  global.Scene3DEngine = Scene3DEngine;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
