# ЗАЦИКЛИВАНИЕ HERO-ВИДЕО
> Для: братан в VS Code
> Файл: `output.mp4` → `hero_rings_loop.mp4`

---

## ПОЧЕМУ НЕ РАБОТАЕТ ПРОСТО `loop`

Первый и последний кадр отличаются на 14% — фигура в разных положениях.
При зацикливании браузер делает резкий прыжок на стыке.

Правильное решение: **прямой crossfade** — последние 1.5с напрямую растворяются
в первые 1.5с через opacity blend. Без чёрного. Без reverse.

---

## КОМАНДА FFMPEG (одна команда, всё внутри)

```bash
ffmpeg -i output.mp4 \
       -i output.mp4 \
  -filter_complex "
    [0:v]trim=start=0:end=3.541,setpts=PTS-STARTPTS[clean];
    [0:v]trim=start=3.541:end=5.041,setpts=PTS-STARTPTS[tail];
    [1:v]trim=start=0:end=1.5,setpts=PTS-STARTPTS[head];
    [tail][head]blend=all_expr='A*(1-N/36)+B*(N/36)':shortest=1[blended];
    [clean][blended]concat=n=2:v=1[out]
  " \
  -map "[out]" \
  -t 5.041 \
  -c:v libx264 -crf 15 -preset slow \
  -pix_fmt yuv420p \
  -movflags +faststart \
  hero_rings_loop.mp4
```

### Что происходит внутри:

| Кусок | Что | Время |
|---|---|---|
| `[clean]` | Видео без изменений | 0 → 3.54с |
| `[tail]` | Конец исходника | 3.54 → 5.04с |
| `[head]` | Начало исходника (копия) | 0 → 1.5с |
| `[blended]` | tail + head через opacity blend | перекрывают друг друга |
| `[out]` | clean + blended склеены | итого 5с |

`N/36` = прогресс blend от 0 до 1 (36 кадров = 1.5с × 24fps)

### Проверить бесшовность:
```bash
ffplay -loop 0 hero_rings_loop.mp4
# Ctrl+C чтобы выйти
```

---

## УСТАНОВКА FFMPEG (если нет)

```bash
brew install ffmpeg        # macOS
sudo apt install ffmpeg    # Ubuntu/Debian
winget install ffmpeg      # Windows
```

---

## ВСТАВКА В index.html

### 1. Найти и удалить Three.js:

```html
<!-- УДАЛИТЬ: -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>

<!-- УДАЛИТЬ весь этот блок: -->
<script>
(function() {
  const canvas = document.getElementById('heroCanvas');
  const renderer = new THREE.WebGLRenderer...
  ...
})();
</script>
```

### 2. Найти canvas в hero, заменить на video:

```html
<!-- БЫЛО: -->
<div class="hero-cube-wrap">
  <canvas id="heroCanvas"></canvas>
</div>

<!-- СТАЛО: -->
<div class="hero-cube-wrap">
  <video
    id="heroVideo"
    autoplay
    loop
    muted
    playsinline
    preload="auto"
  >
    <source src="assets/hero_rings_loop.mp4" type="video/mp4">
  </video>
</div>
```

### 3. Найти CSS `#heroCanvas`, заменить на `#heroVideo`:

```css
/* БЫЛО: */
#heroCanvas {
  width: 480px;
  height: 480px;
  display: block;
}

/* СТАЛО: */
#heroVideo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
```

### 4. Положить видео:

```
project/
├── index.html
├── CLAUDE.md
└── assets/
    └── hero_rings_loop.mp4   ← сюда
```

---

## АТРИБУТЫ VIDEO — ВСЕ ОБЯЗАТЕЛЬНЫ

```
autoplay    — стартует сам при загрузке
loop        — браузер зациклит бесконечно
muted       — без него autoplay заблокирован в Chrome/Safari
playsinline — на iPhone не открывает fullscreen
preload="auto" — загружает заранее, нет задержки старта
```

---

## ИТОГ

```
Исходник:  output.mp4           5с, нет loop point
Результат: hero_rings_loop.mp4  5с, crossfade blend без чёрного
Стык:      последние 1.5с растворяются в первые 1.5с напрямую
```
