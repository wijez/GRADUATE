import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { PencilLine, Eraser, Trash2, Send } from 'lucide-react'
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

type SavedSignature = {
  id: string;
  image: string; // Chuỗi Base64
  createdAt: string;
}

function Signature() {
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const signatureIsDrawingRef = useRef(false)
  const signatureLastPointRef = useRef<{ x: number; y: number } | null>(null)
  
  const [signatureTool, setSignatureTool] = useState<'pencil' | 'erase' | 'none'>('pencil')
  const [signatureColor, setSignatureColor] = useState('#1a365d')
  const [signaturesList, setSignaturesList] = useState<SavedSignature[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ĐỒNG BỘ CHỮ KÝ TỪ FIRESTORE
  useEffect(() => {
    const sigQuery = query(collection(db, 'signatures'), orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(sigQuery, (snapshot) => {
      const fetchedSigs = snapshot.docs.map(doc => ({
        id: doc.id,
        image: doc.data().image,
        createdAt: doc.data().createdAt?.toDate().toLocaleString('vi-VN') || 'Vừa xong'
      }))
      setSignaturesList(fetchedSigs)
    })
    return () => unsubscribe()
  }, [])

  // CÀI ĐẶT CANVAS BAN ĐẦU
  const setupSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    
    canvas.width = Math.max(1, Math.floor(rect.width * dpr))
    canvas.height = Math.max(1, Math.floor(rect.height * dpr))
    
    const context = canvas.getContext('2d')
    if (!context) return

    context.scale(dpr, dpr)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, rect.width, rect.height)
    context.lineCap = 'round'
    context.lineJoin = 'round'
  }

  useEffect(() => {
    setupSignatureCanvas()
    const handleResize = () => setupSignatureCanvas()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const preventScroll = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault();
      }
    };

    canvas.addEventListener('touchstart', preventScroll, { passive: false });
    canvas.addEventListener('touchmove', preventScroll, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', preventScroll);
      canvas.removeEventListener('touchmove', preventScroll);
    };
  }, []);

  const getCanvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    const canvas = signatureCanvasRef.current
    const context = canvas?.getContext('2d')
    if (!context) return

    context.strokeStyle = signatureTool === 'erase' ? '#ffffff' : signatureColor
    context.lineWidth = signatureTool === 'erase' ? 20 : 3
    context.beginPath()
    context.moveTo(x1, y1)
    context.lineTo(x2, y2)
    context.stroke()
  }

  const startSignatureDraw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (signatureTool === 'none') return
    event.preventDefault()
    const point = getCanvasPoint(event)
    if (!point) return
    signatureIsDrawingRef.current = true
    signatureLastPointRef.current = point
  }

  const continueSignatureDraw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!signatureIsDrawingRef.current || signatureTool === 'none') return
    event.preventDefault()
    const point = getCanvasPoint(event)
    const lastPoint = signatureLastPointRef.current
    if (!point || !lastPoint) return
    drawLine(lastPoint.x, lastPoint.y, point.x, point.y)
    signatureLastPointRef.current = point
  }

  const stopSignatureDraw = () => {
    signatureIsDrawingRef.current = false
    signatureLastPointRef.current = null
  }

  const clearCanvas = () => {
    setupSignatureCanvas()
  }

  const submitSignature = async () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return

    try {
      setIsSubmitting(true)
      const base64Image = canvas.toDataURL('image/png')
      
      await addDoc(collection(db, 'signatures'), {
        image: base64Image,
        createdAt: serverTimestamp()
      })

      clearCanvas()
    } catch (error) {
      console.error("Lỗi khi gửi chữ ký:", error)
      alert("Không thể gửi chữ ký. Vui lòng thử lại!")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>Lưu bút / Chữ ký</h3>
      </div>
      
      <div className="signature-toolbar">
        <button title="Bút vẽ" className={signatureTool === 'pencil' ? 'active' : ''} onClick={() => setSignatureTool('pencil')} type="button"><PencilLine size={18} /></button>
        <button title="Cục tẩy" className={signatureTool === 'erase' ? 'active' : ''} onClick={() => setSignatureTool('erase')} type="button"><Eraser size={18}/></button>
        <input title="Màu bút" aria-label="Chọn màu bút" onChange={(event) => setSignatureColor(event.target.value)} type="color" value={signatureColor} />
        
        <button 
          onClick={clearCanvas} 
          type="button" 
          title="Xóa trắng bảng"
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <Trash2 size={16} /> Nháp lại
        </button>
        
        <button 
          onClick={submitSignature} 
          disabled={isSubmitting}
          type="button" 
          style={{ 
            display: 'flex', alignItems: 'center', gap: '4px', 
            background: isSubmitting ? '#a0aec0' : '#db4437', 
            color: 'white', border: 'none' 
          }}
        >
          <Send size={16} /> {isSubmitting ? 'Đang gửi...' : 'Gửi'}
        </button>
      </div>

      <canvas
        className="signature-canvas"
        style={{ height: `220px`, touchAction: 'none' }}
        onPointerDown={startSignatureDraw}
        onPointerLeave={stopSignatureDraw}
        onPointerMove={continueSignatureDraw}
        onPointerUp={stopSignatureDraw}
        ref={signatureCanvasRef}
      />

      {signaturesList.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h4 style={{ color: '#2d3748', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
            Chữ ký của khách ({signaturesList.length})
          </h4>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
            gap: '12px', 
            marginTop: '12px' 
          }}>
            {signaturesList.map((sig) => (
              <div key={sig.id} style={{ 
                border: '1px solid #e2e8f0', 
                borderRadius: '8px', 
                padding: '4px', 
                background: '#fff' 
              }}>
                <img src={sig.image} alt="Signature" style={{ width: '100%', height: 'auto', display: 'block' }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export default Signature