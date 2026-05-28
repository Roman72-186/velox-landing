# Интеграция анимации «Гироскоп-кольца» в сайт

## Что это

3D-анимация армиллярной сферы: 5 металлических колец с прямоугольным скруглённым сечением, каждое вращается вокруг своей уникальной оси. Бесшовный луп ~126 секунд. Используется Three.js r128 (CDN).

Исходный файл: `index.html` — полностью рабочий standalone. Ниже — инструкция по встраиванию в блок на странице сайта.

---

## 1. Зависимость

Подключить Three.js **до** скрипта анимации:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
```

Если на сайте уже есть Three.js — проверить версию (r128+). Двойное подключение не нужно.

---

## 2. HTML-разметка

Создать контейнер и canvas. Canvas должен иметь уникальный `id`:

```html
<section class="hero-3d" id="hero-3d">
  <canvas id="gyroscope-canvas"></canvas>
</section>
```

---

## 3. CSS контейнера

Анимация подстраивается под размер контейнера. Контейнер задаёт размеры блока:

```css
.hero-3d {
  position: relative;
  width: 100%;
  height: 100vh;       /* или фиксированная высота: 600px, 80vh и т.д. */
  overflow: hidden;
  background: #000;    /* фон сцены тоже чёрный — CONFIG.scene.background */
}

.hero-3d canvas {
  display: block;
  width: 100%;
  height: 100%;
}
```

**Если блок не на весь экран** (например, 600px), анимация корректно масштабируется — камера использует aspect ratio контейнера.

**Если поверх анимации нужен текст/UI:**

```css
.hero-3d .content-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;  /* чтобы не блокировать canvas */
}

.hero-3d .content-overlay * {
  pointer-events: auto;  /* вернуть клики для кнопок/ссылок */
}
```

---

## 4. JavaScript — встраивание

Ключевое отличие от standalone: вместо `window.innerWidth/Height` использовать размеры контейнера.

### 4.1. Изменения при интеграции

В скрипте анимации нужно заменить **4 места**, где используется `window.innerWidth / window.innerHeight`:

```javascript
// Вместо:
const canvas = document.getElementById("scene");

// Использовать:
const container = document.getElementById("hero-3d");
const canvas = document.getElementById("gyroscope-canvas");
```

```javascript
// Вместо (создание камеры):
window.innerWidth / window.innerHeight

// Использовать:
container.clientWidth / container.clientHeight
```

```javascript
// Вместо (создание рендерера):
renderer.setSize(window.innerWidth, window.innerHeight);

// Использовать:
renderer.setSize(container.clientWidth, container.clientHeight);
```

```javascript
// Вместо (resize):
window.addEventListener("resize", function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Использовать (ResizeObserver — реагирует на изменение контейнера, а не окна):
const resizeObserver = new ResizeObserver(() => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
resizeObserver.observe(container);
```

### 4.2. Прозрачный фон (если нужно)

Если фон блока не чёрный и нужно видеть фон страницы сквозь сцену:

```javascript
// Рендерер — включить alpha:
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  alpha: true          // <-- было false
});
renderer.setClearColor(0x000000, 0);  // прозрачный фон

// Убрать строку:
// scene.background = new THREE.Color(CONFIG.scene.background);
```

В CSS контейнера убрать `background: #000` или заменить на нужный.

---

## 5. Оптимизация производительности

### Остановка анимации вне viewport

Анимация работает через `requestAnimationFrame` — она уже не рендерит когда вкладка неактивна. Но если блок ниже на странице, стоит останавливать рендер когда он не виден:

```javascript
let animationId;
let isVisible = true;

const visibilityObserver = new IntersectionObserver((entries) => {
  isVisible = entries[0].isIntersecting;
  if (isVisible && !animationId) animate();
}, { threshold: 0.1 });

visibilityObserver.observe(container);

function animate() {
  if (!isVisible) {
    animationId = null;
    return;
  }
  animationId = requestAnimationFrame(animate);
  // ... остальной код animate
}
```

### Адаптация для мобильных

Геометрия колец тяжёлая (260 segments на кольцо × 5 колец). На слабых устройствах можно уменьшить:

```javascript
// В создании колец, вместо 260:
const isMobile = window.innerWidth < 768;
const ringSteps = isMobile ? 130 : 260;
```

---

## 6. Архитектура кода — что где лежит

```
CONFIG (строки 34–211)
├── scene.background     — цвет фона
├── camera               — FOV, позиция камеры (z=10)
├── lights               — 3 направленных + 1 точечный свет
├── ribbonGroupMotion    — [не используется сейчас, ленты выключены]
├── materials            — 2 металла (light/dark) + 1 лента (не используется)
├── rings[]              — 5 колец, каждое: radius, width, height, ось, скорость
└── outerRibbons[]       — [конфиг сохранён, создание выключено]

Создание объектов (строки 293–426)
├── CircleCurve          — кривая-путь для ExtrudeGeometry кольца
├── createRectShape()    — прямоугольник со скруглёнными углами (cornerRadius=0.06)
├── createRectRing()     — кольцо = Shape + CircleCurve + ExtrudeGeometry
└── Цикл CONFIG.rings    — создаёт 5 мешей, добавляет в scene

Анимация (строки 430–457)
├── LOOP_DURATION = 40π  — период бесшовного лупа (~126 сек)
├── loopT = t % LOOP     — зацикленное время
└── quaternion.copy(init).multiply(gimbalQuat) — абсолютный угол, без дрифта
```

---

## 7. Бесшовный луп — как работает

Скорости колец подобраны так, что за `40π` секунд каждое делает **целое** число оборотов:

| Кольцо | Скорость | Обороты за 40π сек |
|--------|----------|--------------------|
| 1      | 0.30     | 6                  |
| 2      | 0.25     | 5                  |
| 3      | 0.20     | 4                  |
| 4      | 0.35     | 7                  |
| 5      | 0.25     | 5                  |

Угол считается абсолютно: `angle = speed * (t % LOOP_DURATION)`, quaternion пересчитывается каждый кадр от начального состояния. Дрифта нет.

**Если менять скорости** — новая скорость должна быть кратна `0.05`, иначе луп сломается. Формула: `скорость × 40π = 2π × n`, где n — целое.

---

## 8. Включение лент обратно

Ленты выключены (код создания и анимации удалён, конфиг `outerRibbons` сохранён). Чтобы вернуть:

1. Раскомментировать/добавить создание `ribbonGroup` (Group) и добавить в scene
2. Создать меши из `CONFIG.outerRibbons` через `createRibbonFromPoints()`
3. Сохранить `originalPositions` (Float32Array копия `posAttr.array`) для волнового эффекта
4. В `animate()` добавить дрифт позиции/ротации + vertex displacement по синусоиде
5. Ленты в `ribbonGroup`, НЕ в scene напрямую (у группы своё вращение `ribbonGroupMotion`)

Полный рабочий код лент есть в git-истории этого файла.

---

## 9. Чеклист интеграции

- [ ] Three.js r128 подключён
- [ ] Canvas внутри контейнера с заданными размерами
- [ ] `window.innerWidth/Height` заменены на `container.clientWidth/Height`
- [ ] `resize` → `ResizeObserver` на контейнере
- [ ] Если нужен прозрачный фон: `alpha: true` + убрать `scene.background`
- [ ] IntersectionObserver для остановки рендера вне viewport
- [ ] На мобильных: уменьшить `steps` колец (260→130)
- [ ] Проверить: луп бесшовный (~126 сек), нет просадок FPS
