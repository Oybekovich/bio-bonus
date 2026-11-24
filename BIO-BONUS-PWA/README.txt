BIO-BONUS PWA — ogohlantirish tizimi qo‘shilgan demo
====================================================

FAYLLAR
- index.html              Ilova sahifalari va ID-kiosk oynasi
- styles.css              Dizayn, mobil moslashuv va ogohlantirishlar dizayni
- i18n.js                 UZ / RU / EN tarjimalar
- app.js                  Akkauntlar, 200 so‘m/kg bonus, ID, ogohlantirish va bloklash mantiqi
- pwa.js                  PWA o‘rnatish va service worker ro‘yxatdan o‘tkazish
- sw.js                   Oflayn ilova qobig‘i
- manifest.webmanifest    PWA sozlamalari
- icons/                  Ilova ikonkalari
- start-local-server.bat  Windows uchun mahalliy serverni ishga tushirish

YANGI QOIDALAR (DEMO)
- 1 kg tasdiqlangan toza organik chiqindi = 200 so‘m.
- Telefon ilovasidagi ID oynasida foydalanuvchining o‘z 8 xonali ID raqami ko‘rsatiladi.
- OGOHLANTIRISH VA BLOK:
  • Begona chiqindi birinchi marta aniqlansa — faqat ogohlantirish.
  • Ogohlantirishdan keyingi topshirishda ham (oraliqda toza chiqindi bo‘lmasa) yana begona chiqindi — blok.
    Masalan: bugun ogohlantirish oldi, ertaga yana begona chiqindi tashladi — blok.
  • Birinchi blok 3 kun, keyingi bloklar 7 kun.
  • Ogohlantirishdan keyin toza chiqindi topshirilsa, holat tiklanadi: 2–3 kundan keyin tasodifan
    begona narsa o‘tib ketsa, yana faqat ogohlantirish beriladi.
    Masalan: begona → toza → toza → begona = ogohlantirish (blok emas).
  • Blok tugagach ham holat yangidan boshlanadi.
- Blok vaqtida balans saqlanadi; bonus do‘koni va kartaga chiqarish yopiq; toza chiqindi qabul qilinadi, lekin bonus yozilmaydi.
- Kartaga chiqarish: faqat UZCARD (8600…) va HUMO (9860…), 16 xonali raqam, komissiya 0. To‘liq karta raqami saqlanmaydi — faqat oxirgi 4 raqam. Haqiqiy pul o‘tkazilmaydi.
- ID 30 soniyada kiritilmasa, chiqindi umumiy/karantin idishga yo‘naltiriladi va hech kimga ogohlantirish yozilmaydi.

SINOV
1. ZIPni chiqarib oling.
2. start-local-server.bat ni ishga tushiring yoki papkada `python -m http.server 8080` bajaring.
3. http://localhost:8080 manzilini oching.
4. Profil sahifasida demo ID va boshqa akkaunt yarating.
5. Bosh sahifadan “Avtomat ID orqali bonus olish”ni oching.
6. “Demo avtomat tekshiruvini boshlash” bo‘limini ochib, toza organik yoki begona material natijasini tanlang.
7. 8 xonali demo ID ni kiriting va tasdiqlang.
8. Ogohlantirishlarim sahifasida qoidabuzarlik va blok holatlarini ko‘ring.

DIQQAT — HAQIQIY QURILMA EMAS
Bu frontend demo. X-ray kamera, rentgen, elektron tarozi, real avtomatik bunker/klapan yoki server ulangan emas. Demo tekshiruv natijasi tanlangan sinov variantidan keladi. Haqiqiy X-ray uskunasi faqat sertifikatlangan, nurlanishdan himoyalangan sanoat modulidan va malakali mutaxassislar integratsiyasidan foydalanishi kerak. Arzonroq prototip uchun oddiy kamera va metall detektori sinovdan o‘tkazilishi mumkin, lekin ular barcha aralashmalarni 100% aniqlamaydi.

Ma’lumotlar localStorage’da, shu brauzerda saqlanadi. Turli telefonlar o‘rtasida umumiy ID/ogohlantirishlar uchun backend va ma’lumotlar bazasi zarur. Bankka haqiqiy pul o‘tkazilmaydi.


YANGI O‘ZGARISHLAR
- Bosh sahifadagi “Avtomat ID orqali bonus olish” tugmasi foydalanuvchining o‘z 8 xonali ID raqamini ko‘rsatadi; ID raqam nusxalanishi mumkin. Demo tekshiruv oqimi esa “Ogohlantirishlarim” sahifasidagi sinov bo‘limida qoladi.
- Hisob bloklanganida mavjud balans saqlanadi; bonus do‘koni va kartaga chiqarish blok muddati tugaguncha yopiladi.
- Blok muddati tugashi bilan ochilish holati avtomatik yangilanadi (sahifa faol bo‘lsa) yoki ilova qayta ochilganda yangilanadi.
