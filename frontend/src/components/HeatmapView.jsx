import React, { useState, useEffect, useRef } from 'react';

export default function HeatmapView() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState('');
  const [clicks, setClicks] = useState([]);
  
  // Track live synchronized document dimensions
  const [dimensions, setDimensions] = useState({ width: 1000, height: 1200 });
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Fetch initial unique tracking addresses
  useEffect(() => {
    fetch('/api/pages')
      .then(res => res.json())
      .then(data => {
        setPages(data.pages || []);
        if (data.pages && data.pages.length > 0) {
          setSelectedPage(data.pages[0]);
        }
      })
      .catch(err => console.error("Error processing pages dropdown listing:", err));
  }, []);

  // Gather coordinates on filter adjustments
  useEffect(() => {
    if (!selectedPage) return;
    fetch(`/api/heatmap?page_url=${encodeURIComponent(selectedPage)}`)
      .then(res => res.json())
      .then(data => setClicks(data.clicks || []))
      .catch(err => console.error("Error processing tracking coordinates:", err));
  }, [selectedPage]);

  // Read the true internal height of the website document once it loads
  const syncIframeDimensions = () => {
    const container = containerRef.current;
    if (!container) return;

    let targetWidth = container.clientWidth;
    let targetHeight = 1200;

    try {
      const iframe = container.querySelector('iframe');
      if (iframe && iframe.contentWindow && iframe.contentWindow.document) {
        const docElem = iframe.contentWindow.document.documentElement;
        targetHeight = Math.max(docElem.scrollHeight, docElem.offsetHeight, 1200);
      }
    } catch (e) {
      console.warn("Cross-origin boundary blocked dimension reading, falling back to default.", e);
    }

    setDimensions({ width: targetWidth, height: targetHeight });
  };

  // Re-paint maps whenever coordinates refresh OR layout dimensions shift
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Clear out any old drawings before paint cycle
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    clicks.forEach(point => {
      // 🌟 FIX: Read x_per from the document payload. Fallback to x_px if referencing old data.
      const percentageX = point.x_per !== undefined ? point.x_per : point.x_px;
      
      if (percentageX === undefined) return; // Skip corrupted items safely

      // Map percentage coordinate calculations from tracker to local responsive width
      const absoluteX = (percentageX / 100) * canvas.width;
      const absoluteY = point.y_px;

      // Draw specialized composite shadows to form smooth heat gradients
      const gradient = ctx.createRadialGradient(absoluteX, absoluteY, 2, absoluteX, absoluteY, 24);
      gradient.addColorStop(0, 'rgba(255, 0, 0, 1)');      // Hot core center
      gradient.addColorStop(0.2, 'rgba(255, 165, 0, 0.8)'); // Warm intermediate glow
      gradient.addColorStop(0.6, 'rgba(0, 255, 0, 0.4)');   // Outer cool rim bounds
      gradient.addColorStop(1, 'rgba(0, 0, 255, 0)');       // Fully dissolved transparency

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(absoluteX, absoluteY, 24, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [clicks, dimensions]);

  // Add a listener to handle window adjustments smoothly
  useEffect(() => {
    window.addEventListener('resize', syncIframeDimensions);
    return () => window.removeEventListener('resize', syncIframeDimensions);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: '20px' }}>
      {/* Upper Control Bar Block */}
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px', backgroundColor: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <label style={{ fontWeight: '600', fontSize: '14px', color: '#495057' }}>Select Targeted Interface Context:</label>
        <select 
          value={selectedPage} 
          onChange={(e) => setSelectedPage(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #ced4da', flex: 1, fontSize: '14px' }}
        >
          {pages.map((p, idx) => <option key={idx} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Outer Dashboard Scroll Container */}
      <div 
        style={{ flex: 1, position: 'relative', border: '1px solid #dee2e6', borderRadius: '8px', backgroundColor: '#fff', overflowY: 'auto' }} 
        ref={containerRef}
      >
        {/* Underlay Component: 🌟 FIX: Updated src to match the dynamically selected route */}
        <iframe 
          src={selectedPage || "/demo.html"} 
          title="Heatmap Viewport Underlay"
          onLoad={syncIframeDimensions} 
          scrolling="no" 
          style={{ width: '100%', height: `${dimensions.height}px`, border: 'none', display: 'block' }}
        />

        {/* Overlay Component: Locked 1:1 with canvas metrics */}
        <canvas 
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          style={{
            position: 'absolute', top: 0, left: 0, 
            width: `${dimensions.width}px`, height: `${dimensions.height}px`,
            pointerEvents: 'none', mixBlendMode: 'multiply'
          }}
        />
      </div>
    </div>
  );
}