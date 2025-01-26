import { useEffect, useState } from "react"
import { toast } from "sonner";

export default function useOnline() {
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  useEffect(() => {
    const setOnlineTrue = () => setOnline(true);
    const setOnlineFalse = () => {
      toast.error("Offline");
      setOnline(false)
    };
    window.addEventListener('online', setOnlineTrue);
    window.addEventListener('offline', setOnlineFalse);
    return () => {
      window.removeEventListener('online', setOnlineTrue)
      window.removeEventListener('online', setOnlineFalse);
    }
  });
  return { online }
}