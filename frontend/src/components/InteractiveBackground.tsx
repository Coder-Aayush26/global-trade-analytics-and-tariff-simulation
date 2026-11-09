import React, { useEffect, useRef } from 'react';

/**
 * InteractiveBackground
 * Renders a subtle, slow-moving ambient mesh gradient combined with a lightweight
 * canvas grid and micro-particles that gently react to mouse movement without
 * distracting from or hurting content readability.
 */
export default function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse coordinates with smooth interpolation
    let mouseX = width / 2;
    let mouseY = height / 2;
    let targetMouseX = width / 2;
    let targetMouseY = height / 2;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initParticles();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    // Subtle particles
    interface Particle {
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      size: number;
      vx: number;
      vy: number;
      opacity: number;
    }

    const particleCount = Math.min(45, Math.floor((width * height) / 25000));
    const particles: Particle[] = [];

    const initParticles = () => {
      particles.length = 0;
      for (let i = 0; i < particleCount; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        particles.push({
          x,
          y,
          baseX: x,
          baseY: y,
          size: Math.random() * 2 + 1.2,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          opacity: Math.random() * 0.25 + 0.12,
        });
      }
    };

    initParticles();

    // Subtle grid settings
    const gridSize = 48;

    const render = () => {
      // Smooth mouse lerp
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      ctx.clearRect(0, 0, width, height);

      // ── 1. Subtle Dot Grid with Gentle Mouse Reactivity ──
      const cols = Math.floor(width / gridSize) + 1;
      const rows = Math.floor(height / gridSize) + 1;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const gx = i * gridSize;
          const gy = j * gridSize;

          // Distance to mouse
          const dx = mouseX - gx;
          const dy = mouseY - gy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 180;

          let dotSize = 1.0;
          let dotAlpha = 0.06;

          if (dist < maxDist) {
            const factor = 1 - dist / maxDist;
            dotSize = 1.0 + factor * 1.8;
            dotAlpha = 0.06 + factor * 0.22;
          }

          ctx.fillStyle = `rgba(99, 102, 241, ${dotAlpha})`;
          ctx.beginPath();
          ctx.arc(gx, gy, dotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ── 2. Floating Micro-Particles ──
      for (let p of particles) {
        p.baseX += p.vx;
        p.baseY += p.vy;

        // Wrap around boundaries
        if (p.baseX < 0) p.baseX = width;
        if (p.baseX > width) p.baseX = 0;
        if (p.baseY < 0) p.baseY = height;
        if (p.baseY > height) p.baseY = 0;

        // Gentle spring reaction to mouse
        const dx = mouseX - p.baseX;
        const dy = mouseY - p.baseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const repelDist = 140;

        if (dist < repelDist) {
          const angle = Math.atan2(dy, dx);
          const force = (repelDist - dist) / repelDist;
          p.x = p.baseX - Math.cos(angle) * force * 15;
          p.y = p.baseY - Math.sin(angle) * force * 15;
        } else {
          p.x += (p.baseX - p.x) * 0.05;
          p.y += (p.baseY - p.y) * 0.05;
        }

        ctx.fillStyle = `rgba(79, 70, 229, ${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      {/* Slow-moving CSS ambient mesh gradient container */}
      <div className="ambient-mesh-background" />
      {/* Interactive mouse-reactive particle/grid canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
    </>
  );
}
