# Анализ структуры resend.com

## Технологии

- **Фреймворк:** Next.js (App Router) — видно по путям `/_next/image`, `/_next/static`
- **Рендеринг:** SSR (HTML приходит готовым, не SPA)
- **Стили:** CSS Modules (Next.js) — классы генерируются
- **Анимации:** MP4 видео (pre-rendered в Blender/Cinema 4D) — НЕ WebGL, НЕ Three.js
- **Изображения:** Next.js Image Optimization (`/_next/image?url=...&w=3840&q=100`)

---

## Структура страницы (порядок секций)

```
1. NAV
   - Лого Resend (слева)
   - Ссылки: Features / Company / Resources / Help / Docs / AI / Pricing
   - Кнопки: Log In / Get Started (справа)

2. HERO
   - Фон: bg-hero-1.jpg (тёмная текстура пола)
   - Анимация: cube.mp4 (MP4 видео, autoplay, loop, muted)
   - Fallback: cube-fallback.jpg (статичный скриншот)
   - Заголовок: "Email for developers" — КРУПНЫЙ, по центру, serif шрифт
   - Подзаголовок: текст
   - Кнопки: Get Started / Documentation
   - bg-light.png — световой луч поверх

3. LOGOS — Companies of all sizes trust Resend...
   - Warner Bros, Max, Raycast, Mistral AI, Replit, Anghami

4. INTEGRATE — Code snippet с переключателями языков
   - Node.js / Serverless / Ruby / Python / PHP / Go / Rust / Java...

5. FIRST-CLASS DX — анимированные HTTP 200 ответы

6. TEST MODE — симуляция событий

7. MODULAR WEBHOOKS
   - Анимация: 3d-broadcast.mp4

8. WRITE EDITOR — визуальный редактор писем

9. GO BEYOND EDITING — Audiences + Analytics скриншоты

10. DEVELOP WITH REACT — код react-email + превью

11. 3D REACT SECTION
    - Анимация: 3d-react.mp4

12. DELIVERABILITY — spam protection, DKIM, SPF...

13. CONTROL — 3d-control.mp4 + дашборд скриншот

14. TESTIMONIALS — цитата Guillermo Rauch (Vercel)

15. FOOTER
```

---

## Анимации (ВСЕ — MP4 видео, не код)

| Имя файла | Секция | Fallback |
|---|---|---|
| `/static/cube.mp4` | Hero (куб) | `cube-fallback.jpg` |
| `/static/landing-page/3d-broadcast.mp4` | Webhooks | `3d-broadcast-fallback.jpg` |
| `/static/landing-page/3d-react.mp4` | React section | `3d-react-fallback.jpg` |
| `/static/landing-page/3d-control.mp4` | Control section | `3d-control-fallback.jpg` |

**Все анимации — это pre-rendered видео из 3D редактора (Blender / Cinema4D).**
Никакого Three.js, никакого WebGL на главной странице.

---

## Цвета (визуально определённые)

```css
--bg:           #000000  /* чистый чёрный */
--text:         #ffffff  /* чистый белый */
--text-muted:   #888888  /* серый */
--bg-card:      #111111  /* тёмно-серый для карточек */
--border:       rgba(255,255,255,0.08)
--accent:       нет явного цветного акцента на главной
                (используется только белый/серый)
```

**Важно:** у Resend нет голубого акцента. Палитра строго ч/б.
Наш #40c4ff — наше собственное решение, не референс с Resend.

---

## Типографика

```
Заголовки:   Serif шрифт (похожий на Garamond/EB Garamond)
             — крупный, элегантный, НЕ geometric sans
Тело:        Sans-serif системный или Inter
Код:         Monospace (JetBrains Mono / Fira Code)
```

---

## Hero — точная структура

```html
<section class="hero">
  <!-- Фоновое изображение -->
  <img src="/static/landing-page/bg-hero-1.jpg" />
  
  <!-- Световой луч -->
  <img src="/static/landing-page/bg-light.png" />
  
  <!-- Заголовок + кнопки (по центру) -->
  <h1>Email for developers</h1>
  <p>The best way to reach humans...</p>
  <a>Get Started</a>
  <a>Documentation</a>
  
  <!-- Куб — просто видео тег -->
  <a href="/static/cube.mp4">
    <img src="/static/cube-fallback.jpg" /> <!-- видимо poster -->
  </a>
</section>
```

**Куб расположен ПО ЦЕНТРУ страницы над заголовком**, не справа в 2 колонки!

---

## Навигация

```
position: fixed (судя по поведению)
backdrop-filter: blur (стандарт для таких сайтов)
background: rgba(0,0,0,0.8) или similar
border-bottom: 1px solid rgba(255,255,255,0.08)
```

---

## Ключевые выводы для нашего проекта

| Параметр | Resend | Наш сайт |
|---|---|---|
| Hero layout | По центру, куб над текстом | Две колонки (по ТЗ) |
| Куб | MP4 видео из 3D редактора | Three.js (оригинальный) |
| Акцент | Нет (ч/б) | #40c4ff голубой |
| Шрифт заголовков | Serif (Garamond) | Syne (geometric sans) |
| Анимации | Только MP4 | Three.js + CSS кнопки |
| Цвет фона | #000000 | #080808 |

---

## Что взяли с Resend (дух, не копия)

✅ Тотально тёмный фон
✅ Минимализм, ничего лишнего
✅ Плавные переходы
✅ Технический стиль
✅ Идея 3D объекта в hero

## Что сделали своё

✅ Две колонки hero (по ТЗ)
✅ Голубой акцент #40c4ff
✅ Syne шрифт
✅ Three.js куб (не видео)
✅ Бегущий свет по кнопкам
✅ 10 языков i18n
