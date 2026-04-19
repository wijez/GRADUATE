import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { PencilLine, Eraser  } from 'lucide-react'
function Signature() {
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const signatureIsDrawingRef = useRef(false)
  const signatureLastPointRef = useRef<{ x: number; y: number } | null>(null)
  const [signatureTool, setSignatureTool] = useState<'pencil' | 'erase'>('pencil')
  const [signatureColor, setSignatureColor] = useState('#1a365d')
  const signatureStorageKey = 'graduate_signature_pad'

  const saveSignature = () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) {
      return
    }
    localStorage.setItem(signatureStorageKey, canvas.toDataURL('image/png'))
  }

  const setupSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) {
      return
    }

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.floor(rect.width * dpr))
    canvas.height = Math.max(1, Math.floor(rect.height * dpr))

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    context.scale(dpr, dpr)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, rect.width, rect.height)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = 2.5

    const saved = localStorage.getItem(signatureStorageKey)
    if (!saved) {
      return
    }

    const image = new Image()
    image.onload = () => {
      context.drawImage(image, 0, 0, rect.width, rect.height)
    }
    image.src = saved
  }

  const getCanvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current
    if (!canvas) {
      return null
    }
    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    const canvas = signatureCanvasRef.current
    if (!canvas) {
      return
    }
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    context.strokeStyle = signatureTool === 'erase' ? '#ffffff' : signatureColor
    context.lineWidth = signatureTool === 'erase' ? 18 : 2.5
    context.beginPath()
    context.moveTo(x1, y1)
    context.lineTo(x2, y2)
    context.stroke()
  }

  const startSignatureDraw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    const point = getCanvasPoint(event)
    if (!point) {
      return
    }
    signatureIsDrawingRef.current = true
    signatureLastPointRef.current = point
  }

  const continueSignatureDraw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!signatureIsDrawingRef.current) {
      return
    }
    event.preventDefault()

    const point = getCanvasPoint(event)
    const lastPoint = signatureLastPointRef.current
    if (!point || !lastPoint) {
      return
    }

    drawLine(lastPoint.x, lastPoint.y, point.x, point.y)
    signatureLastPointRef.current = point
  }

  const stopSignatureDraw = () => {
    if (!signatureIsDrawingRef.current) {
      return
    }
    signatureIsDrawingRef.current = false
    signatureLastPointRef.current = null
    saveSignature()
  }

  useEffect(() => {
    setupSignatureCanvas()

    const handleResize = () => {
      setupSignatureCanvas()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <>
      <h3>Bảng chữ ký</h3>
      <div className="signature-toolbar">
        <button className={signatureTool === 'pencil' ? 'active' : ''} onClick={() => setSignatureTool('pencil')} type="button"><PencilLine /></button>
        <button className={signatureTool === 'erase' ? 'active' : ''} onClick={() => setSignatureTool('erase')} type="button"><Eraser /></button>
        <input aria-label="Chọn màu bút" onChange={(event) => setSignatureColor(event.target.value)} type="color" value={signatureColor} />
      </div>
      <canvas
        className="signature-canvas"
        onPointerDown={startSignatureDraw}
        onPointerLeave={stopSignatureDraw}
        onPointerMove={continueSignatureDraw}
        onPointerUp={stopSignatureDraw}
        ref={signatureCanvasRef}
      />
    </>
  )
}

export default Signature
