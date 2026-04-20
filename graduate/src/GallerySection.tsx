import { useEffect, useState, type FormEvent } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'

import { auth, db } from './firebase' 

type GalleryImage = {
  id: string
  src: string
  alt: string
  ownerEmail: string | undefined 
}

const mapFirebaseError = (error: unknown) => {
  if (!(error instanceof FirebaseError)) {
    return 'Kết nối Firebase thất bại. Vui lòng thử lại.'
  }
  if (error.code === 'permission-denied') {
    return 'Firebase đang chặn quyền đọc/ghi. Hãy mở Firestore Rules cho thư viện ảnh.'
  }
  return `Firebase lỗi: ${error.code}`
}

const compressImageToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; 
        const MAX_HEIGHT = 800; 
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Không thể khởi tạo Canvas 2D"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const base64String = canvas.toDataURL('image/jpeg', 0.7);
        resolve(base64String);
      };
      
      img.onerror = (error) => reject(error);
    };
    
    reader.onerror = (error) => reject(error);
  });
};

function GallerySection() {
  const [activeImage, setActiveImage] = useState(0)
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([])
  const [galleryError, setGalleryError] = useState('')
  const [ownerUser, setOwnerUser] = useState<User | null>(null)
  const [newImageUrl, setNewImageUrl] = useState('')
  const [newImageCaption, setNewImageCaption] = useState('')
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [ownerError, setOwnerError] = useState('')
  const [isOwnerLoading, setIsOwnerLoading] = useState(false)
  const [isAddingImage, setIsAddingImage] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setOwnerUser(user)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const slider = setInterval(() => {
      setActiveImage((current) => {
        if (galleryImages.length <= 1) return 0;
        return (current + 1) % galleryImages.length;
      })
    }, 5000)

    return () => clearInterval(slider)
  }, [galleryImages.length])

  useEffect(() => {
    const galleryQuery = query(collection(db, 'galleryImages'), orderBy('createdAt', 'desc'), limit(20))
    const unsubscribe = onSnapshot(
      galleryQuery,
      (snapshot) => {
        const images = snapshot.docs
          .map((doc) => {
            const data = doc.data() as { src?: string; alt?: string; ownerEmail?: string }
            if (!data.src) return null;
            return {
              id: doc.id,
              src: data.src,
              alt: data.alt ?? 'Anh ky yeu',
              ownerEmail: data.ownerEmail 
            }
          })
          .filter((item): item is GalleryImage => item !== null)

        setGalleryImages(images)
        setActiveImage((current) => {
          if (images.length === 0) return 0;
          return Math.min(current, images.length - 1)
        })
        setGalleryError('')
      },
      (error) => {
        setGalleryError(mapFirebaseError(error))
      }
    )

    return () => unsubscribe()
  }, [])

  const loginOwnerWithGoogle = async () => {
    try {
      setIsOwnerLoading(true)
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      setOwnerError('')
    } catch (error) {
      setOwnerError(mapFirebaseError(error))
    } finally {
      setIsOwnerLoading(false)
    }
  }

  const logoutOwner = async () => {
    try {
      await signOut(auth)
      setOwnerError('')
    } catch (error) {
      setOwnerError(mapFirebaseError(error))
    }
  }

  const addGalleryImage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!ownerUser) {
      setOwnerError('Bạn cần đăng nhập tài khoản chủ sở hữu để thêm ảnh.')
      return
    }

    const imageUrl = newImageUrl.trim()
    const imageCaption = newImageCaption.trim()
    if (!imageUrl && !selectedImageFile) {
      setOwnerError('Hãy nhập link ảnh hoặc chọn file ảnh.')
      return
    }

    try {
      setIsAddingImage(true)
      setOwnerError('')
      
      let sourceUrl = imageUrl

      if (selectedImageFile) {
        try {
          sourceUrl = await compressImageToBase64(selectedImageFile);
        } catch (err) {
          throw new Error("Lỗi khi xử lý hình ảnh. Vui lòng thử ảnh khác.");
        }
      }
      await addDoc(collection(db, 'galleryImages'), {
        src: sourceUrl,
        alt: imageCaption || 'Anh ky yeu',
        ownerUid: ownerUser.uid,
        ownerEmail: ownerUser.email,
        createdAt: serverTimestamp()
      })
      
      setNewImageUrl('')
      setNewImageCaption('')
      setSelectedImageFile(null)
      
      const fileInput = document.getElementById('gallery-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      if (error instanceof Error) {
        setOwnerError(error.message)
      } else {
        setOwnerError(mapFirebaseError(error))
      }
    } finally {
      setIsAddingImage(false)
    }
  }

  return (
    <section className="gallery">
      {galleryImages.length > 0 ? (
        <div className="gallery-frame">
          {galleryImages[activeImage].ownerEmail && (
            <div className="gallery-uploader-email" style={{
              position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.5)', 
              color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', zIndex: 10
            }}>
              Đăng bởi: {galleryImages[activeImage].ownerEmail}
            </div>
          )}
          
          <img alt={galleryImages[activeImage].alt} src={galleryImages[activeImage].src} />
          <button aria-label="Ảnh trước" onClick={() => setActiveImage((activeImage - 1 + galleryImages.length) % galleryImages.length)} type="button">
            ‹
          </button>
          <button aria-label="Ảnh sau" onClick={() => setActiveImage((activeImage + 1) % galleryImages.length)} type="button">
            ›
          </button>
        </div>
      ) : (
        <p className="gallery-empty">Chưa có ảnh nào trong thư viện.</p>
      )}
      {galleryError ? <p className="guestbook-error">{galleryError}</p> : null}

      <div className="gallery-admin">
        <h3 style={{ color: "blue", fontSize: "14px", margin: "0 0 10px 0" }}>
          <span><strong>Note:</strong></span> Bạn có thể thêm hình ảnh ở đây
        </h3>
        {!ownerUser ? (
          <button className="google-login-button" disabled={isOwnerLoading} onClick={loginOwnerWithGoogle} type="button">
            {isOwnerLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        ) : (
          <form onSubmit={addGalleryImage}>
            <p className="owner-badge">Đã đăng nhập: {ownerUser.email}</p>
            <input 
              onChange={(event) => setNewImageUrl(event.target.value)} 
              placeholder="Link ảnh (https://...) - không bắt buộc nếu đã chọn file" 
              value={newImageUrl} 
            />
            <input 
              id="gallery-file-input"
              accept="image/*" 
              onChange={(event) => setSelectedImageFile(event.target.files?.[0] ?? null)} 
              type="file" 
            />
            <input 
              onChange={(event) => setNewImageCaption(event.target.value)} 
              placeholder="Mô tả ảnh (tuỳ chọn)" 
              value={newImageCaption} 
            />
            <div className="gallery-owner-actions">
              <button disabled={isAddingImage} type="submit">{isAddingImage ? 'Đang tải lên...' : 'Thêm ảnh'}</button>
              <button onClick={logoutOwner} type="button">Đăng xuất</button>
            </div>
          </form>
        )}
        {ownerError ? <p className="guestbook-error">{ownerError}</p> : null}
      </div>
    </section>
  )
}

export default GallerySection