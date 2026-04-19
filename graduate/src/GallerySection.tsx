import { useEffect, useState, type FormEvent } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'

import { auth, db, storage } from './firebase'

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

  if (error.code === 'failed-precondition') {
    return 'Firestore/Storage chưa được bật cho project. Hãy vào Firebase Console để tạo.'
  }

  if (error.code === 'unavailable') {
    return 'Firebase tạm thời không phản hồi. Kiểm tra mạng và thử lại.'
  }

  return `Firebase lỗi: ${error.code}`
}

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
        if (galleryImages.length <= 1) {
          return 0
        }
        return (current + 1) % galleryImages.length
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
            if (!data.src) {
              return null
            }
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
          if (images.length === 0) {
            return 0
          }
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
      let sourceUrl = imageUrl

      if (selectedImageFile) {
        const safeName = selectedImageFile.name.replace(/\s+/g, '-').toLowerCase()
        const path = `gallery/${ownerUser.uid}/${Date.now()}-${safeName}`
        const fileRef = ref(storage, path)
        await uploadBytes(fileRef, selectedImageFile)
        sourceUrl = await getDownloadURL(fileRef)
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
      setOwnerError('')
    } catch (error) {
      setOwnerError(mapFirebaseError(error))
    } finally {
      setIsAddingImage(false)
    }
  }

  return (
    <section className="gallery">
      {galleryImages.length > 0 ? (
        <div className="gallery-frame">
          {galleryImages[activeImage].ownerEmail && (
            <div className="gallery-uploader-email">
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
        <h3 style={{ color: "blue", fontSize: "14px" }}>
          <span><strong>Note:</strong></span> Bạn có thể thêm hình ảnh ở đây
        </h3>
        {!ownerUser ? (
          <button className="google-login-button" disabled={isOwnerLoading} onClick={loginOwnerWithGoogle} type="button">
            {isOwnerLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        ) : (
          <form onSubmit={addGalleryImage}>
            <p className="owner-badge">Đã đăng nhập: {ownerUser.email}</p>
            <input onChange={(event) => setNewImageUrl(event.target.value)} placeholder="Link ảnh (https://...) - không bắt buộc nếu đã chọn file" value={newImageUrl} />
            <input accept="image/*" onChange={(event) => setSelectedImageFile(event.target.files?.[0] ?? null)} type="file" />
            <input onChange={(event) => setNewImageCaption(event.target.value)} placeholder="Mô tả ảnh (tuỳ chọn)" value={newImageCaption} />
            <div className="gallery-owner-actions">
              <button disabled={isAddingImage} type="submit">{isAddingImage ? 'Đang thêm ảnh...' : 'Thêm ảnh'}</button>
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