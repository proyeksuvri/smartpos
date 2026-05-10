import { useEffect, useState } from 'react'

/**
 * useOnlineStatus — mendeteksi status koneksi internet browser secara real-time.
 * Menggunakan navigator.onLine + event listener 'online'/'offline'.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)

  useEffect(() => {
    function setOnline()  { setIsOnline(true) }
    function setOffline() { setIsOnline(false) }

    window.addEventListener('online',  setOnline)
    window.addEventListener('offline', setOffline)

    return () => {
      window.removeEventListener('online',  setOnline)
      window.removeEventListener('offline', setOffline)
    }
  }, [])

  return isOnline
}
