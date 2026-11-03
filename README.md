# Huquqiy yordamchi

O‘zbekiston huquqiy platformasi web-sayt, PWA va Windows desktop ilovasi sifatida ishlaydi.

## Web ilovani ishga tushirish

```bash
npm install
npm run import:legal
npm run dev
```

`npm run dev` API serverini (`http://localhost:4000`) va Vite frontendini birga ishga tushiradi.
LexUZ ma’lumotlarini yuklash uchun internet ulanishi kerak. Importni avval o‘zgartirishsiz
tekshirish uchun `node scripts/import-lexuz.js --dry-run` buyrug‘idan foydalaning.
Manbalar `data/lexuz-sources.json` faylida boshqariladi; bitta hujjatni yangilash uchun:

```bash
node scripts/import-lexuz.js --only=mehnat-kodeksi
```

Server va importer `database.db` SQLite faylidan foydalanadi. `source_checked_at` va
modda `updated_at` qiymatlari LexUZ sahifasi import vaqtida tekshirilganini bildiradi;
ular qonunning kuchga kirgan yoki o‘zgartirilgan sanasi emas.

## Talabalar akademiyasi

Akademiyaning kurslari, dars bajarilishi, test natijalari va sertifikat kodi; postlar,
izohlar, layklar, obunalar, shaxsiy xabarlar, kanallar, guruhlar, loyihalar, tadbirlar,
bildirishnomalar va XP SQLite’da saqlanadi. Akademiya amallari hisobga kirishni talab qiladi.
Server ishga tushganda versionlangan migration runner mavjud akademiya kanallarining
egalik, obuna va post ma’lumotlarini saqlab, kanal sozlamalari hamda rollar uchun
qo‘shimcha jadvallarni yaratadi. Yopiq kanal, a’zolik rollari, taklif havolalari,
qo‘shilish so‘rovlari, post izohlari/reaksiyalari/pinlari va kanal tahlili API orqali
boshqariladi. Yangi kanallar va postlar ham shu SQLite bazasida saqlanadi.
Migration serverni birinchi marta yangilangan kod bilan ishga tushirganda avtomatik
qo‘llanadi. Migratsiya va kanal API tekshiruvlarini `npm test` bilan, lint/build
tekshiruvlarini esa `npm run lint` va `npm run build` bilan ishga tushiring.
Boshlang‘ich huquqiy savodxonlik kursida matnli uch dars va yakuniy test bor.
Kursni tugatish uchun barcha darslarni bajarib, yakuniy testdan kamida 70% olish kerak.
Video darslar administrator kurs yaratishda taqdim etgan HTTPS/HTTP havolalar orqali ochiladi.

Administratorni tayinlash uchun foydalanuvchi avval ro‘yxatdan o‘tsin, so‘ng web
server ishlatayotgan SQLite bazasida quyidagini bajaring:

```bash
npm run academy:admin -- admin@example.com
```

Komanda standart `database.db` faylini yangilaydi. Boshqa bazani (masalan, desktop
ilovaning userData katalogidagi bazani) ko‘rsatish uchun `--db=C:\path\database.db`
argumentini bering. Ro‘yxatdan o‘tish so‘rovi administrator rolini o‘rnatolmaydi.
Admin sahifasidan kurs/test, guruh va tadbir qo‘shish, hamjamiyat postlarini moderatsiya
qilish va foydalanuvchilar ro‘yxatini ko‘rish mumkin. AI ustoz alohida AI model emas:
u faqat import qilingan LexUZ moddalaridan izlaydi, manba topilmasa javobni taxmin qilmaydi.

Arxitektura, akademiyaning mavjud imkoniyatlari va rejalashtirilgan channel/server/chat
modullari uchun [texnik arxitektura hujjati](./docs/academy-architecture.md)ni ko‘ring.

### Hozirgi manbalar doirasi

Hozircha tekshirilgan manbalar ro‘yxatida 11 ta hujjat bor: Konstitutsiya, Fuqarolik,
Jinoyat, Mehnat, Oila, Soliq, Ma’muriy javobgarlik, Jinoyat-protsessual, Fuqarolik
protsessual, Yer va Uy-joy kodekslari. Bu ro‘yxat platformada amaldagi qonunchilikning
to‘liq to‘plami mavjud degani emas: iste’molchilar huquqlarini himoya qilish qonuni
uchun alohida tasdiqlangan LexUZ manbasi hali qo‘shilmagan va boshqa qonunlar ham kiritilishi
kerak. Shu sabab tegishli hujjat topilmagan yo‘nalishlarda kabinet manba yo‘qligini bildiradi.

Importer takrorlangan modda raqamlarini saqlaydi. Moddalar asl LexUZ matni va manba
havolasi bilan ko‘rsatiladi; import qilingan hujjatlar bo‘yicha AI yordamchisi mos modda
topilmasa huquqiy xulosa bermaydi va muddatlarni taxmin qilmaydi.

## Windows desktop ilovasi

Ishlab chiqish rejimida:

```bash
npm run desktop:dev
```

Windows uchun o‘rnatuvchi fayl yaratish:

```bash
npm run desktop:build
```

O‘rnatuvchi `release` papkasida yaratiladi. Ilovaning API serveri avtomatik ishga tushadi, foydalanuvchi ma’lumotlar bazasi esa Windows foydalanuvchi ma’lumotlari papkasida saqlanadi.

## PWA o‘rnatish

Saytni brauzerda ochib, adres qatoridagi “Install” tugmasidan o‘rnatish mumkin. Service worker web-versiyadagi statik fayllarni keshlaydi.
