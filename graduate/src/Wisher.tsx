import { useEffect, useRef, useState, type FormEvent } from 'react'
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { FirebaseError } from 'firebase/app'
import { AnimatePresence, motion } from 'framer-motion'

import { db } from './firebase'

type Wish = {
  id: string
  name: string
  message: string
  createdAt: string
}

const mapFirebaseError = (error: unknown) => {
  if (!(error instanceof FirebaseError)) {
    return 'Kết nối Firebase thất bại. Vui lòng thử lại.'
  }

  if (error.code === 'permission-denied') {
    return 'Firebase đang chặn quyền đọc/ghi. Hãy mở Firestore Rules cho collection wishes.'
  }

  if (error.code === 'failed-precondition') {
    return 'Firestore chưa được bật cho project này. Hãy vào Firebase Console để tạo database.'
  }

  if (error.code === 'unavailable') {
    return 'Firebase tạm thời không phản hồi. Kiểm tra mạng và thử lại.'
  }

  return `Firebase lỗi: ${error.code}`
}

function Wisher() {
  const nextWishCursorRef = useRef(0)
  const [guestName, setGuestName] = useState('')
  const [wishText, setWishText] = useState('')
  const [wishes, setWishes] = useState<Wish[]>([])
  const [runnerWishes, setRunnerWishes] = useState<Wish[]>([])
  const [isGuestbookOpen, setIsGuestbookOpen] = useState(false)
  const [guestbookError, setGuestbookError] = useState('')
  const [isSubmittingWish, setIsSubmittingWish] = useState(false)
  const visibleWishCount = 5

  useEffect(() => {
    const wishesQuery = query(collection(db, 'wishes'), orderBy('createdAt', 'desc'), limit(20))
    const unsubscribe = onSnapshot(
      wishesQuery,
      (snapshot) => {
        const nextWishes = snapshot.docs.map((doc) => {
          const data = doc.data() as { name?: string; message?: string; createdAt?: { toDate: () => Date } }
          const createdDate = data.createdAt?.toDate?.()
          return {
            id: doc.id,
            name: data.name ?? 'Khách mời',
            message: data.message ?? '',
            createdAt: createdDate ? createdDate.toLocaleString('vi-VN') : 'Vừa xong'
          }
        })
        setWishes(nextWishes)
        setGuestbookError('')
      },
      (error) => {
        setGuestbookError(mapFirebaseError(error))
      }
    )

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (wishes.length === 0) {
      setRunnerWishes([])
      nextWishCursorRef.current = 0
      return
    }

    setRunnerWishes([wishes[0]])
    nextWishCursorRef.current = wishes.length > 1 ? 1 : 0

    const ticker = setInterval(() => {
      if (wishes.length <= 1) {
        return
      }

      const nextWish = wishes[nextWishCursorRef.current]
      nextWishCursorRef.current = (nextWishCursorRef.current + 1) % wishes.length

      setRunnerWishes((previous) => {
        const maxVisible = Math.min(visibleWishCount, wishes.length)
        const withoutDuplicate = previous.filter((item) => item.id !== nextWish.id)
        return [...withoutDuplicate, nextWish].slice(-maxVisible)
      })
    }, 4500)

    return () => clearInterval(ticker)
  }, [wishes])

  const submitWish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = guestName.trim()
    const trimmedWish = wishText.trim()
    if (!trimmedName || !trimmedWish) {
      return
    }

    try {
      setIsSubmittingWish(true)
      await addDoc(collection(db, 'wishes'), {
        name: trimmedName,
        message: trimmedWish,
        createdAt: serverTimestamp()
      })
      setGuestName('')
      setWishText('')
      setGuestbookError('')
    } catch (error) {
      setGuestbookError(mapFirebaseError(error))
    } finally {
      setIsSubmittingWish(false)
    }
  }

  return (
    <>
      <div className="wish-runner-wrapper">
        {runnerWishes.length > 0 ? (
          <motion.div className="wish-runner-list" layout>
            <AnimatePresence initial={false}>
              {runnerWishes.map((wish, index) => (
                <motion.article
                  animate={{ opacity: 1, y: 0 }}
                  className="wish-runner"
                  exit={{ opacity: 0, y: -40 }}
                  initial={{ opacity: 0, y: 40 }}
                  key={`${wish.id}-${index}`}
                  layout
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                >
                  <p className="wish-runner-message">{wish.message}</p>
                  <small>{wish.name} • {wish.createdAt}</small>
                </motion.article>
              ))}
            </AnimatePresence>
            {wishes.length > 1 ? <span className="wish-runner-hint">Lời chúc mới sẽ xuất hiện ở dưới và đẩy dần lên trên</span> : null}
          </motion.div>
        ) : (
          <div className="wish-runner-empty">Chưa có lời chúc nào.</div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isGuestbookOpen ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="guestbook-modal-overlay"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="guestbook-modal"
            transition={{ duration: 0.2 }}
          >
            <motion.section
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="guestbook-modal"
              exit={{ opacity: 0, y: 14, scale: 0.96 }}
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
            >
              <button aria-label="Đóng sổ lưu bút" className="guestbook-close" onClick={() => setIsGuestbookOpen(false)} type="button">
                ×
              </button>
              <div className="guestbook-heart-icon">🤍</div>
              <h3>Lời chúc</h3>
              <form onSubmit={submitWish}>
                <input onChange={(event) => setGuestName(event.target.value)} placeholder="Tên của bạn" value={guestName} />
                <textarea onChange={(event) => setWishText(event.target.value)} placeholder="Lời chúc của bạn" rows={4} value={wishText} />
                <button disabled={isSubmittingWish} type="submit">{isSubmittingWish ? 'Đang gửi...' : 'Gửi Lời Chúc'}</button>
              </form>
              {guestbookError ? <p className="guestbook-error">{guestbookError}</p> : null}
            </motion.section>
          </motion.div>
        ) : (
          <motion.button
            animate={{ opacity: 1, scale: 1 }}
            className="open-guestbook-button"
            initial={{ opacity: 0, scale: 0.6, y: 8 }}
            key="guestbook-open-button"
            onClick={() => setIsGuestbookOpen(true)}
            transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            type="button"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            💌
          </motion.button>
        )}
      </AnimatePresence>
    </>
  )
}

export default Wisher
