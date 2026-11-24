BIO-BONUS PWA — ogohlantirish tizimi qo‘shilgan demo
====================================================

FAYLLAR
- index.html              Ilova sahifalari va ID-kiosk oynasi
- styles.css              Dizayn, mobil moslashuv va ogohlantirishlar dizayni
- app.js                  Akkauntlar, 200 so‘m/kg bonus, ID, ogohlantirish va bloklash mantiqi
- pwa.js                  PWA o‘rnatish va service worker ro‘yxatdan o‘tkazish
- sw.js                   Oflayn ilova qobig‘i
- manifest.webmanifest    PWA sozlamalari
- icons/                  Ilova ikonkalari
- start-local-server.bat  Windows uchun mahalliy serverni ishga tushirish

YANGI QOIDALAR (DEMO)
- 1 kg tasdiqlangan toza organik chiqindi = 200 so‘m.
- Telefon ilovasidagi avtomat ID oynasida foydalanuvchining o‘z 8 xonali ID raqami ko‘rsatiladi. Foydalanuvchi shu ID ni haqiqiy avtomat monitoriga kiritadi; bonus uning akkauntiga yuboriladi.
- “Demo avtomat tekshiruvini boshlash” qo‘shimcha bo‘limida test natijasi tanlanadi; bu haqiqiy X-ray yoki AI kamera emas.
- Toza organik chiqindi uchun demo tarozi qiymati avtomatik olinadi; kg va summa qo‘lda tahrirlanmaydi.
- Begona material aniqlansa, ID kiritilgandan keyin ogohlantirish aynan shu demo akkauntga biriktiriladi; bonus berilmaydi.
- 1-qoidabuzarlik: ogohlantirish.
- 2-qoidabuzarlik: bonus olish 3 kunga bloklanadi.
- 3-qoidabuzarlik: 3 kunlik blokdan keyingi yangi ogohlantirish; keyingi holatda 7 kunlik blok haqida xabar beriladi.
- 4-va keyingi qoidabuzarlik: bonus olish 7 kunga bloklanadi.
- Blok vaqtida mavjud balans o‘chirilmaydi va saqlanadi. Blok tugamaguncha bonus do‘konida pul ishlatish ham, kartaga chiqarish ham yopiladi. Toza organik chiqindi qabul qilinishi mumkin, ammo blok davrida yangi bonus hisoblanmaydi. Blok tugagan paytda balansdan foydalanish avtomatik qayta ochiladi.
- ID tekshiruv natijasidan keyin 30 soniya ichida kiritilmasa, toza organik chiqindi saqlash bo‘limiga yo‘naltiriladi; aralash/begona chiqindi esa bioxomashyoni ifloslantirmasligi uchun demo karantin bo‘limiga yo‘naltiriladi. ID kiritilmagani uchun akkauntga ogohlantirish bog‘lanmaydi.
- Ogohlantirishlarim sahifasida xabarlar soni va blok muddati ko‘rinadi.

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
