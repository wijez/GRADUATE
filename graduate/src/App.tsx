import { useState, useEffect, useMemo, useRef } from 'react'
import './App.css'
import Signature from './Signature.tsx'
import Wisher from './Wisher.tsx'
import GallerySection from './GallerySection.tsx'
import { VolumeX, Volume2 } from 'lucide-react'
import backgroundMusic from './assets/videoplayback.m4a'
import bgImage from './assets/8232006.jpg'

function App() {
  const targetDate = new Date('April 25, 2026 08:00:00').getTime()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft())
  
  const [isOpened, setIsOpened] = useState(false)

  function calculateTimeLeft() {
    const now = new Date().getTime()
    const distance = targetDate - now

    if (distance <= 0) {
      return null
    }

    return {
      days: Math.floor(distance / (1000 * 60 * 60 * 24)),
      hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((distance % (1000 * 60)) / 1000)
    }
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const googleCalendarUrl = useMemo(() => {
    const start = '20260425T010000Z'
    const end = '20260425T050000Z'
    const text = encodeURIComponent('Le tot nghiep')
    const details = encodeURIComponent('Hen gap ban tai buoi le tot nghiep!')
    const location = encodeURIComponent('Nha Hat Trung Vuong, Da Nang')
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&dates=${start}%2F${end}&text=${text}&details=${details}&location=${location}`
  }, [])

  const formatNumber = (num: number) => num.toString().padStart(2, '0')

  const toggleMusic = async () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }

    try {
      await audioRef.current.play()
      setIsPlaying(true)
    } catch {
      setIsPlaying(false)
    }
  }

  const handleOpenInvitation = async () => {
    setIsOpened(true) 
    
    if (audioRef.current) {
      try {
        await audioRef.current.play()
        setIsPlaying(true)
      } catch (error) {
        console.log("Lỗi phát nhạc:", error)
      }
    }
  }

  return (
    <div className="container"
    style={{ 
      backgroundImage: `url(${bgImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed' 
    }}>
      <audio ref={audioRef} loop preload="auto" src={backgroundMusic} />

      {!isOpened ? (
        <div className="splash-screen">
          <div className="envelope">
            <h2>🎓 Lễ Tốt Nghiệp 2026</h2>
            <p>Bạn nhận được một thư mời từ mình!</p>
            <button className="open-button" onClick={handleOpenInvitation} type="button">
              Nhấn để mở thiệp 💌
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="card fade-in">
            <h1>Thư Mời Tốt Nghiệp</h1>

            <div className="message">
              <p>Thân gửi bạn,</p>
              <p>Trân trọng kính mời bạn đến tham dự buổi lễ tốt nghiệp, cùng chia sẻ niềm vui và đánh dấu một cột mốc quan trọng trong chặng đường học vấn của mình.</p>
            </div>

            <button className="music-button" onClick={toggleMusic} type="button">
              {isPlaying ? <VolumeX /> : <Volume2 />}
            </button>

            {timeLeft ? (
              <div className="countdown-container">
                <div className="time-box">
                  <span>{formatNumber(timeLeft.days)}</span>
                  <small>Ngày</small>
                </div>
                <div className="time-box">
                  <span>{formatNumber(timeLeft.hours)}</span>
                  <small>Giờ</small>
                </div>
                <div className="time-box">
                  <span>{formatNumber(timeLeft.minutes)}</span>
                  <small>Phút</small>
                </div>
                <div className="time-box">
                  <span>{formatNumber(timeLeft.seconds)}</span>
                  <small>Giây</small>
                </div>
              </div>
            ) : (
              <h2 className="event-started">Buổi lễ đã chính thức bắt đầu! 🎉</h2>
            )}

            <div className="location">
              <h3>Thông tin sự kiện</h3>
              <p><strong>Thời gian:</strong> 08:00 Sáng, Thứ 7, 25/04/2026</p>
              <p><strong>Địa điểm:</strong> Nhà Hát Trưng Vương</p>
              <p><strong>Địa chỉ:</strong> 35A Phan Châu Trinh, Hải Châu, Đà Nẵng</p>
            </div>

            <div className="calendar-actions">
              <a href={googleCalendarUrl} rel="noreferrer" target="_blank">Thêm vào Google Calendar</a>
            </div>

            <GallerySection />

            <section className="map-section">
              <h3>Bản đồ chỉ đường</h3>
              <iframe
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3833.9309489272505!2d108.21807472515883!3d16.069072634610404!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31421833fca0ffff%3A0xea91c290cc7393ce!2zTmjDoCBIw6F0IFRyxrBuZyBWxrDGoW5nIMSQw6AgTuG6tW5n!5e0!3m2!1svi!2s!4v1776647466383!5m2!1svi!2s"
                title="Google Maps tới Nhà Hát Trưng Vương"
                width="100%"
                height="250"
                style={{ border: 0, borderRadius: '8px', marginTop: '10px' }}
              />
            </section>

            <section className="signature-section">
              <Signature />
            </section>

          </div>

          <div className="fade-in">
            <Wisher />
          </div>
        </>
      )}
    </div>
  )
}

export default App