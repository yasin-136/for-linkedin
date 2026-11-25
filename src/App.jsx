import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight, Brush, Circle, Copy, Download, Eraser,
  Expand, Eye, EyeOff, Hand, Image as ImageIcon,
  Layers, Lock, MousePointer2, Move, Palette, Pencil, Plus, Redo2,
  RotateCcw, Settings, Square, Sun, Trash2,
  Undo2, Unlock, ZoomIn, ZoomOut, Pipette, Type, FolderOpen,
  SlidersHorizontal, AlignJustify, PanelLeftClose, PanelRightClose
} from 'lucide-react'
import './App.css'

const INITIAL_WIDTH = 900
const INITIAL_HEIGHT = 600

const TOOL_ITEMS = [
  { id: 'move', label: 'Move', icon: Move },
  { id: 'brush', label: 'Brush', icon: Brush },
  { id: 'pencil', label: 'Pencil', icon: Pencil },
  { id: 'eraser', label: 'Eraser', icon: Eraser },
  { id: 'line', label: 'Line', icon: ArrowUpRight },
  { id: 'rectangle', label: 'Rectangle', icon: Square },
  { id: 'ellipse', label: 'Ellipse', icon: Circle },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'fill', label: 'Fill bucket', icon: PaintBucketIcon },
  { id: 'eyedropper', label: 'Eyedropper', icon: Pipette },
  { id: 'hand', label: 'Hand', icon: Hand },
]

function PaintBucketIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m4 11 8-8 8 8-8 8Z" /><path d="M4 11h16M12 3v16M5 21h14" />
    </svg>
  )
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SketchSpacePro', 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function saveProject(project) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readwrite')
    tx.objectStore('projects').put(project)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function listProjects() {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction('projects').objectStore('projects').getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function deleteProject(id) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readwrite')
    tx.objectStore('projects').delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function App() {
  const canvasRef = useRef(null)
  const startSnapshot = useRef(null)
  const drawing = useRef(false)
  const lastPoint = useRef(null)
  const history = useRef([])
  const historyIndex = useRef(-1)
  const layerImages = useRef({})
  const toastTimeout = useRef(null)

  const [tool, setTool] = useState('brush')
  const [color, setColor] = useState('#8b5cf6')
  const [brushSize, setBrushSize] = useState(12)
  const [opacity, setOpacity] = useState(100)
  const [stabilization, setStabilization] = useState(30)
  const [zoom, setZoom] = useState(75)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [canvasSize, setCanvasSize] = useState({ width: INITIAL_WIDTH, height: INITIAL_HEIGHT })
  const [projectName, setProjectName] = useState('Untitled artwork')
  const [saveStatus, setSaveStatus] = useState('Saved')
  const [theme, setTheme] = useState(() => localStorage.getItem('sketch-theme') || 'dark')
  const [grid, setGrid] = useState(true)
  const [rulers, setRulers] = useState(false)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [projects, setProjects] = useState([])
  const [toast, setToast] = useState('')
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  const [layers, setLayers] = useState([
    { id: 'layer-1', name: 'Background', visible: true, locked: false, opacity: 100, blend: 'source-over' },
  ])
  const [activeLayerId, setActiveLayerId] = useState('layer-1')
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [saturation, setSaturation] = useState(100)
  const [fontSize, setFontSize] = useState(48)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('sketch-theme', theme)
  }, [theme])

  const showToast = useCallback((message) => {
    setToast(message)
    window.clearTimeout(toastTimeout.current)
    toastTimeout.current = window.setTimeout(() => setToast(''), 2200)
  }, [])

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    history.current = history.current.slice(0, historyIndex.current + 1)
    history.current.push(canvas.toDataURL())
    if (history.current.length > 40) history.current.shift()
    historyIndex.current = history.current.length - 1
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = canvasSize.width
    canvas.height = canvasSize.height
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    history.current = [canvas.toDataURL()]
    historyIndex.current = 0
  }, [canvasSize])

  const getPoint = (event) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
      pressure: event.pressure && event.pressure > 0 ? event.pressure : 0.5,
    }
  }

  const getCanvasData = () => canvasRef.current?.toDataURL() || ''

  const restoreSnapshot = (snapshot) => {
    if (!snapshot) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const image = new window.Image()
    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0)
    }
    image.src = snapshot
  }

  const undo = () => {
    if (historyIndex.current <= 0) return
    historyIndex.current -= 1
    restoreSnapshot(history.current[historyIndex.current])
  }

  const redo = () => {
    if (historyIndex.current >= history.current.length - 1) return
    historyIndex.current += 1
    restoreSnapshot(history.current[historyIndex.current])
  }

  const commitDrawing = () => {
    const data = getCanvasData()
    layerImages.current[activeLayerId] = data
    pushHistory()
    setSaveStatus('Unsaved changes')
  }

  const floodFill = (x, y) => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    x = Math.floor(x)
    y = Math.floor(y)
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = image.data
    const targetIndex = (y * canvas.width + x) * 4
    const target = [data[targetIndex], data[targetIndex + 1], data[targetIndex + 2], data[targetIndex + 3]]
    const fill = [
      parseInt(color.slice(1, 3), 16),
      parseInt(color.slice(3, 5), 16),
      parseInt(color.slice(5, 7), 16),
      Math.round(opacity * 2.55),
    ]
    if (target.every((value, index) => value === fill[index])) return
    const matches = (index) =>
      Math.abs(data[index] - target[0]) < 8 &&
      Math.abs(data[index + 1] - target[1]) < 8 &&
      Math.abs(data[index + 2] - target[2]) < 8 &&
      Math.abs(data[index + 3] - target[3]) < 8
    const setPixel = (index) => {
      data[index] = fill[0]; data[index + 1] = fill[1]; data[index + 2] = fill[2]; data[index + 3] = fill[3]
    }
    const stack = [[x, y]]
    while (stack.length) {
      const [px, py] = stack.pop()
      if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue
      const index = (py * canvas.width + px) * 4
      if (!matches(index)) continue
      setPixel(index)
      stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1])
    }
    ctx.putImageData(image, 0, 0)
  }

  const onPointerDown = (event) => {
    if (tool === 'hand') return
    const point = getPoint(event)
    setCursor(point)
    const active = layers.find((layer) => layer.id === activeLayerId)
    if (active?.locked) {
      showToast('This layer is locked')
      return
    }

    if (tool === 'eyedropper') {
      const ctx = canvasRef.current.getContext('2d')
      const pixel = ctx.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1).data
      setColor(`#${[pixel[0], pixel[1], pixel[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`)
      showToast('Color sampled')
      return
    }
    if (tool === 'fill') {
      floodFill(point.x, point.y)
      commitDrawing()
      return
    }
    if (tool === 'text') {
      const text = window.prompt('Enter text:')
      if (text) {
        const ctx = canvasRef.current.getContext('2d')
        ctx.globalAlpha = opacity / 100
        ctx.fillStyle = color
        ctx.font = `${fontSize}px Inter, sans-serif`
        ctx.fillText(text, point.x, point.y)
        ctx.globalAlpha = 1
        commitDrawing()
      }
      return
    }

    drawing.current = true
    startSnapshot.current = canvasRef.current.toDataURL()
    lastPoint.current = point
    canvasRef.current.setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event) => {
    const point = getPoint(event)
    setCursor(point)
    if (!drawing.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (tool === 'brush' || tool === 'pencil' || tool === 'eraser') {
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalAlpha = tool === 'eraser' ? 1 : opacity / 100
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
      ctx.lineWidth = tool === 'pencil' ? Math.max(1, brushSize * 0.45) : brushSize
      ctx.beginPath()
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
      const smoothing = 1 - stabilization / 100
      const mx = lastPoint.current.x + (point.x - lastPoint.current.x) * (0.35 + smoothing * 0.65)
      const my = lastPoint.current.y + (point.y - lastPoint.current.y) * (0.35 + smoothing * 0.65)
      ctx.quadraticCurveTo(lastPoint.current.x, lastPoint.current.y, mx, my)
      ctx.stroke()
      ctx.restore()
      lastPoint.current = point
      return
    }

    const image = new window.Image()
    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0)
      ctx.save()
      ctx.globalAlpha = opacity / 100
      ctx.strokeStyle = color
      ctx.fillStyle = `${color}55`
      ctx.lineWidth = brushSize
      ctx.beginPath()
      if (tool === 'line') {
        ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
        ctx.lineTo(point.x, point.y)
      } else if (tool === 'rectangle') {
        ctx.rect(lastPoint.current.x, lastPoint.current.y, point.x - lastPoint.current.x, point.y - lastPoint.current.y)
      } else if (tool === 'ellipse') {
        ctx.ellipse(
          (lastPoint.current.x + point.x) / 2,
          (lastPoint.current.y + point.y) / 2,
          Math.abs(point.x - lastPoint.current.x) / 2,
          Math.abs(point.y - lastPoint.current.y) / 2,
          0, 0, Math.PI * 2
        )
      }
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
    image.src = startSnapshot.current
  }

  const onPointerUp = () => {
    if (!drawing.current) return
    drawing.current = false
    commitDrawing()
  }

  const addLayer = () => {
    const id = `layer-${Date.now()}`
    setLayers((items) => [...items, { id, name: `Layer ${items.length + 1}`, visible: true, locked: false, opacity: 100, blend: 'source-over' }])
    setActiveLayerId(id)
  }

  const updateLayer = (id, patch) => setLayers((items) => items.map((layer) => layer.id === id ? { ...layer, ...patch } : layer))

  const duplicateLayer = (id) => {
    const source = layers.find((layer) => layer.id === id)
    if (!source) return
    const copy = { ...source, id: `layer-${Date.now()}`, name: `${source.name} Copy` }
    setLayers((items) => [...items, copy])
  }

  const deleteLayer = (id) => {
    if (layers.length === 1) return showToast('Keep at least one layer')
    setLayers((items) => items.filter((layer) => layer.id !== id))
    if (activeLayerId === id) setActiveLayerId(layers.find((layer) => layer.id !== id)?.id)
  }

  const saveCurrentProject = async (quiet = false) => {
    setSaveStatus('Saving')
    try {
      await saveProject({
        id: projectName,
        name: projectName,
        modified: Date.now(),
        width: canvasSize.width,
        height: canvasSize.height,
        thumbnail: getCanvasData(),
        canvas: getCanvasData(),
      })
      setSaveStatus('Saved')
      if (!quiet) showToast('Project saved')
    } catch {
      setSaveStatus('Unsaved changes')
      showToast('Unable to save project')
    }
  }

  useEffect(() => {
    if (saveStatus !== 'Unsaved changes') return
    const timer = window.setTimeout(() => saveCurrentProject(true), 2200)
    return () => window.clearTimeout(timer)
  }, [saveStatus])

  const openGallery = async () => {
    setProjects(await listProjects())
    setGalleryOpen(true)
  }

  const openProject = (project) => {
    setProjectName(project.name)
    setCanvasSize({ width: project.width, height: project.height })
    setGalleryOpen(false)
    const canvas = canvasRef.current
    window.setTimeout(() => {
      const image = new window.Image()
      image.onload = () => {
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(image, 0, 0)
        pushHistory()
      }
      image.src = project.canvas
    }, 50)
  }

  const newProject = () => {
    const width = window.prompt('Canvas width', '900')
    if (!width) return
    const height = window.prompt('Canvas height', '600')
    if (!height) return
    setCanvasSize({ width: Number(width), height: Number(height) })
    setProjectName('Untitled artwork')
  }

  const importImage = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const image = new window.Image()
      image.onload = () => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        const scale = Math.min(canvas.width / image.width, canvas.height / image.height)
        ctx.drawImage(image, (canvas.width - image.width * scale) / 2, (canvas.height - image.height * scale) / 2, image.width * scale, image.height * scale)
        commitDrawing()
        showToast('Image imported')
      }
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  }

  const exportArtwork = (format = 'png', quality = 0.92) => {
    const canvas = canvasRef.current
    const link = document.createElement('a')
    link.download = `${projectName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.${format}`
    link.href = canvas.toDataURL(`image/${format}`, quality)
    link.click()
    setExportOpen(false)
    showToast(`Exported ${format.toUpperCase()}`)
  }

  const applyEffects = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const snapshot = canvas.toDataURL()
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`
    const image = new window.Image()
    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0)
      ctx.filter = 'none'
      commitDrawing()
      showToast('Effects applied')
    }
    image.src = snapshot
  }

  useEffect(() => {
    const handler = (event) => {
      const tag = event.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        event.shiftKey ? redo() : undo()
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveCurrentProject()
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        newProject()
      } else if (event.key === 'b') setTool('brush')
        else if (event.key === 'e') setTool('eraser')
        else if (event.key === 'v') setTool('move')
        else if (event.key === 't') setTool('text')
        else if (event.key === '[') setBrushSize((value) => Math.max(1, value - 2))
        else if (event.key === ']') setBrushSize((value) => Math.min(100, value + 2))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  return (
    <div className="studio">
      <header className="topbar">
        <button className="brand" onClick={() => setGalleryOpen(true)} title="Open project gallery">
          <span className="brand-mark"><Palette size={18} /></span>
          <span>SketchSpace <b>Pro</b></span>
        </button>
        <div className="top-actions">
          <button className="icon-button" onClick={newProject} title="New project"><Plus size={18} /></button>
          <input className="project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} aria-label="Project name" />
          <span className={`save-status ${saveStatus === 'Unsaved changes' ? 'unsaved' : ''}`}><span />{saveStatus}</span>
          <button className="icon-button" onClick={undo} title="Undo"><Undo2 size={18} /></button>
          <button className="icon-button" onClick={redo} title="Redo"><Redo2 size={18} /></button>
        </div>
        <div className="top-actions right-actions">
          <button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Change theme"><Sun size={18} /></button>
          <button className="icon-button" onClick={() => setSettingsOpen(true)} title="Settings"><Settings size={18} /></button>
          <button className="export-button" onClick={() => setExportOpen(true)}><Download size={16} />Export</button>
        </div>
      </header>

      <main className="workspace">
        {leftOpen && (
          <aside className="left-toolbar">
            <button className="collapse-button" onClick={() => setLeftOpen(false)} title="Collapse toolbar"><PanelLeftClose size={16} /></button>
            {TOOL_ITEMS.map(({ id, label, icon: Icon }) => (
              <button key={id} className={`tool-button ${tool === id ? 'active' : ''}`} onClick={() => setTool(id)} title={label}>
                <Icon size={19} /><span>{label}</span>
              </button>
            ))}
          </aside>
        )}
        {!leftOpen && <button className="floating-side left" onClick={() => setLeftOpen(true)} title="Expand toolbar"><PanelRightClose size={17} /></button>}

        <section className={`canvas-area ${grid ? 'with-grid' : ''}`}>
          {rulers && <div className="ruler top">0 &nbsp;&nbsp;&nbsp; 200 &nbsp;&nbsp;&nbsp; 400 &nbsp;&nbsp;&nbsp; 600 &nbsp;&nbsp;&nbsp; 800</div>}
          {rulers && <div className="ruler left"><span>0</span><span>200</span><span>400</span><span>600</span></div>}
          <div className="canvas-viewport" style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
            <canvas
              ref={canvasRef}
              className={`artboard tool-${tool}`}
              style={{ width: `${canvasSize.width * zoom / 100}px`, height: `${canvasSize.height * zoom / 100}px` }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            />
          </div>
          <div className="canvas-controls">
            <button onClick={() => setZoom((value) => Math.max(25, value - 10))} title="Zoom out"><ZoomOut size={16} /></button>
            <span>{zoom}%</span>
            <button onClick={() => setZoom((value) => Math.min(200, value + 10))} title="Zoom in"><ZoomIn size={16} /></button>
            <button onClick={() => { setZoom(75); setPan({ x: 0, y: 0 }) }} title="Reset view"><RotateCcw size={16} /></button>
            <button onClick={() => document.documentElement.requestFullscreen?.()} title="Fullscreen"><Expand size={16} /></button>
          </div>
        </section>

        {rightOpen && (
          <aside className="right-panel">
            <div className="panel-tabs">
              <button className="active"><SlidersHorizontal size={16} />Properties</button>
              <button onClick={() => setLayers((items) => [...items])}><Layers size={16} />Layers</button>
              <button className="collapse-button" onClick={() => setRightOpen(false)}><PanelRightClose size={15} /></button>
            </div>
            <div className="panel-scroll">
              <section className="property-section">
                <h3>{tool[0].toUpperCase() + tool.slice(1)} settings</h3>
                <div className="color-row">
                  <label className="color-swatch" style={{ '--swatch': color }}>
                    <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
                  </label>
                  <input className="hex-input" value={color.toUpperCase()} onChange={(event) => /^#[0-9a-fA-F]{6}$/.test(event.target.value) && setColor(event.target.value)} />
                  <button className="mini-button" onClick={() => setTool('eyedropper')} title="Eyedropper"><Pipette size={14} /></button>
                </div>
                <label className="range-label"><span>Size</span><b>{brushSize}px</b></label>
                <input type="range" min="1" max="100" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
                <label className="range-label"><span>Opacity</span><b>{opacity}%</b></label>
                <input type="range" min="1" max="100" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} />
                <label className="range-label"><span>Stabilization</span><b>{stabilization}%</b></label>
                <input type="range" min="0" max="90" value={stabilization} onChange={(event) => setStabilization(Number(event.target.value))} />
              </section>

              <section className="property-section">
                <h3>Text</h3>
                <div className="text-controls">
                  <button onClick={() => setFontSize((value) => value - 2)}>-</button>
                  <span>{fontSize}px</span>
                  <button onClick={() => setFontSize((value) => value + 2)}>+</button>
                </div>
              </section>

              <section className="property-section">
                <div className="section-heading">
                  <h3>Layers</h3>
                  <div>
                    <button onClick={addLayer} title="Add layer"><Plus size={15} /></button>
                    <button onClick={() => duplicateLayer(activeLayerId)} title="Duplicate layer"><Copy size={15} /></button>
                  </div>
                </div>
                <div className="layer-list">
                  {[...layers].reverse().map((layer) => (
                    <div key={layer.id} className={`layer-row ${activeLayerId === layer.id ? 'active' : ''}`} onClick={() => setActiveLayerId(layer.id)}>
                      <button onClick={(event) => { event.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }) }} title={layer.visible ? 'Hide layer' : 'Show layer'}>
                        {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                      </button>
                      <div className="layer-thumb" />
                      <input value={layer.name} onChange={(event) => updateLayer(layer.id, { name: event.target.value })} onClick={(event) => event.stopPropagation()} />
                      <button onClick={(event) => { event.stopPropagation(); updateLayer(layer.id, { locked: !layer.locked }) }} title={layer.locked ? 'Unlock layer' : 'Lock layer'}>
                        {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
                      </button>
                      <button onClick={(event) => { event.stopPropagation(); deleteLayer(layer.id) }} title="Delete layer"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="property-section">
                <h3>Image adjustments</h3>
                {[
                  ['Brightness', brightness, setBrightness],
                  ['Contrast', contrast, setContrast],
                  ['Saturation', saturation, setSaturation],
                ].map(([label, value, setter]) => (
                  <div key={label}>
                    <label className="range-label"><span>{label}</span><b>{value}%</b></label>
                    <input type="range" min="0" max="200" value={value} onChange={(event) => setter(Number(event.target.value))} />
                  </div>
                ))}
                <button className="wide-button" onClick={applyEffects}>Apply adjustments</button>
              </section>

              <section className="property-section">
                <h3>Canvas</h3>
                <label className="toggle-row"><span>Show grid</span><input type="checkbox" checked={grid} onChange={(event) => setGrid(event.target.checked)} /></label>
                <label className="toggle-row"><span>Show rulers</span><input type="checkbox" checked={rulers} onChange={(event) => setRulers(event.target.checked)} /></label>
                <label className="import-button"><ImageIcon size={15} />Import image<input type="file" accept="image/*" onChange={importImage} /></label>
              </section>
            </div>
          </aside>
        )}
        {!rightOpen && <button className="floating-side right" onClick={() => setRightOpen(true)} title="Expand properties"><PanelLeftClose size={17} /></button>}
      </main>

      <footer className="statusbar">
        <div><MousePointer2 size={14} /><span>{tool[0].toUpperCase() + tool.slice(1)}</span></div>
        <div>X {Math.round(cursor.x)} &nbsp; Y {Math.round(cursor.y)}</div>
        <div>{canvasSize.width} × {canvasSize.height}px</div>
        <div className="status-actions">
          <button onClick={openGallery}><FolderOpen size={14} />Gallery</button>
          <button onClick={() => setShortcutsOpen(true)}><AlignJustify size={14} />Shortcuts</button>
        </div>
      </footer>

      {galleryOpen && (
        <Modal title="Project Gallery" onClose={() => setGalleryOpen(false)}>
          <div className="gallery-toolbar">
            <input placeholder="Search projects..." onChange={(event) => setProjects((items) => items.filter((project) => project.name.toLowerCase().includes(event.target.value.toLowerCase()) || !event.target.value))} />
            <button className="wide-button" onClick={newProject}><Plus size={15} />New project</button>
          </div>
          <div className="gallery-grid">
            {projects.map((project) => (
              <article className="project-card" key={project.id} onClick={() => openProject(project)}>
                <div className="project-preview">{project.thumbnail && <img src={project.thumbnail} alt="" />}</div>
                <div className="project-meta">
                  <b>{project.name}</b><span>{project.width} × {project.height}</span>
                  <small>{new Date(project.modified).toLocaleDateString()}</small>
                  <button onClick={(event) => { event.stopPropagation(); deleteProject(project.id).then(openGallery) }} title="Delete project"><Trash2 size={14} /></button>
                </div>
              </article>
            ))}
            {!projects.length && <div className="empty-state"><FolderOpen size={32} /><h3>No saved projects yet</h3><p>Save your artwork to see it here.</p></div>}
          </div>
        </Modal>
      )}

      {exportOpen && (
        <Modal title="Export artwork" onClose={() => setExportOpen(false)}>
          <div className="export-options">
            <label>Filename<input value={projectName} onChange={(event) => setProjectName(event.target.value)} /></label>
            <div className="export-format">
              <button onClick={() => exportArtwork('png')}><b>PNG</b><span>Lossless</span></button>
              <button onClick={() => exportArtwork('jpeg', 0.92)}><b>JPEG</b><span>High quality</span></button>
            </div>
          </div>
        </Modal>
      )}

      {settingsOpen && (
        <Modal title="Settings" onClose={() => setSettingsOpen(false)}>
          <label className="toggle-row"><span>Dark theme</span><input type="checkbox" checked={theme === 'dark'} onChange={(event) => setTheme(event.target.checked ? 'dark' : 'light')} /></label>
          <label className="toggle-row"><span>Show grid</span><input type="checkbox" checked={grid} onChange={(event) => setGrid(event.target.checked)} /></label>
          <label className="toggle-row"><span>Show rulers</span><input type="checkbox" checked={rulers} onChange={(event) => setRulers(event.target.checked)} /></label>
        </Modal>
      )}

      {shortcutsOpen && (
        <Modal title="Keyboard shortcuts" onClose={() => setShortcutsOpen(false)}>
          <div className="shortcut-list">
            {[['Undo', 'Ctrl/⌘ + Z'], ['Redo', 'Ctrl/⌘ + Shift + Z'], ['Save', 'Ctrl/⌘ + S'], ['New project', 'Ctrl/⌘ + N'], ['Brush', 'B'], ['Eraser', 'E'], ['Move', 'V'], ['Text', 'T'], ['Brush size', '[ or ]']].map(([name, keys]) => (
              <div key={name}><span>{name}</span><kbd>{keys}</kbd></div>
            ))}
          </div>
        </Modal>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal">
        <header><h2>{title}</h2><button onClick={onClose}>×</button></header>
        <div className="modal-content">{children}</div>
      </section>
    </div>
  )
}

export default App
