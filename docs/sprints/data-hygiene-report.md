# Üretim veri hijyeni — tespit raporu (FS-17)

**Not:** Bu ortamdan üretim veritabanına doğrudan erişim yok. Aşağıdaki
liste yeni bir sorgudan değil, `Fikir-Sepeti-Analiz-Raporu.docx`'un
kendi canlı-ortam gözlemlerinden derlendi (20 Ağustos 2026 tarihli
analiz sırasında, oturum açılmış bir hesapla platform panelinde
görülenler). Silme yapılmadı — sadece tespit ve hazırlık.

## Tespit edilenler

### Test tenant'ı
- **"MCP Probe Co"** — platform panelinde görünen, 1 kullanıcılı,
  domain'siz bir tenant. Gerçek bir ekip/müşteri değil.

### Anlamsız / test başlıklı sepetler (Sepet havuzunda)
- "test"
- "aa"
- "adad"
- "nasıl yapacağım?"
- "drake nin adı arca olsun"

### Moderasyon kuralları
- **"arca"** — hassas: bir ekip üyesinin adı, engel/uyarı listesinde
  duruyor. Muhtemelen yanlışlıkla eklenmiş bir test kuralı.
- **"maaş"** — amacı belirsiz, gözden geçirilmeli.

## Etkisi
Bu kayıtlar analitik huniyi bozuyor ("Fikir girildi", "Üretime alınan"
sayıları test verisini de içeriyor) ve ürünü birine gösterirken ilk
görülen şey oluyor.

## Sıradaki adımlar (bu raporla birlikte hazırlandı, uygulanmadı)
1. `supabase/migrations/0021_demo_flag.sql` — `baskets.is_demo` kolonu
   ekler (varsayılan `false`, hiçbir satırı değiştirmez/silmez).
   Migration uygulandıktan **sonra** analitik sorgusuna
   `is_demo = false` filtresi eklenmesi ayrı bir adım — bu kolon
   üretimde yokken filtre eklenirse sorgu hata verir, o yüzden bilerek
   ayrı tutuldu.
2. `docs/sprints/data-hygiene-cleanup.sql` — yukarıdaki kayıtları
   temizleyecek SQL, hazır ama **çalıştırılmadı**. Gözden geçirip siz
   (ya da yetkili biri) çalıştırmalı.

## Kural
Bu ajan üretim verisi silmez. Temizlik SQL'i hazırlanır, incelenir,
onaylanırsa elle çalıştırılır.
