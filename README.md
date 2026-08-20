# Threads Unfollower (konsol aracı)

Threads'te **senin takip ettiğin ama seni takip etmeyen** kişileri listeleyip
toplu olarak takipten çıkaran tarayıcı-konsolu aracı. API/anahtar gerektirmez;
senin oturumunla, tarayıcıda çalışır.

## Kullanım
1. threads.com'da kendi profiline gir.
2. "X takip ediliyor" / "Following" yazısına tıkla (Following/Followers listesi açılsın).
3. F12 → Konsol.
4. `threads_unfollower.js` dosyasının TAMAMINI yapıştır, Enter'a bas.
5. Sağ üstteki panelden **TARA**'ya bas.
6. "Seni takip etmeyen" kişiler listelenir:
   - @kullanıcıya tıkla → profiline gider
   - "Çık" → sadece o kişiyi çıkarır
   - "TÜMÜNÜ ÇIKAR" → 3 sn arayla hepsini çıkarır
   - "DURDUR" → istediğin an durdurur

## Önemli
- **Popup izni ver:** Firefox'ta açılır pencere engelini kaldır
  (adres çubuğundaki simge → threads.com için izin ver).
- Aracı listeyi **modal içinde** tarar; arka plandaki akışa dokunmaz.
- Toplu çıkarma Meta tarafından "bot" sayılabilir; "action blocked"
  uyarısı çıkarsa DURDUR, 1 saat bekle, kaldığın yerden devam et.
- **Önce tek kişide test et**, sonra toplu çalıştır.

## Dosyalar
- `threads_unfollower.js` — konsola yapıştırılacak araç.

## Notlar / Sorun Giderme
- "anasayfayı tarıyor" görürsen: liste modal'i içinde taranmıyor demektir
  (kod güncel sürümde modal içi taramayı kullanır).
- "Popup engellendi": popup iznini ver.
- "profil yüklenemedi": sayfa yavaşsa yeniden dene.

## Yapımcı
- Threads: [@selcukar1kan](https://www.threads.com/@selcukar1kan) — takip edebilirsiniz!
