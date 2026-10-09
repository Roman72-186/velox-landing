# сайт Алисы

## Подключение к общему мозгу workspace

Этот файл подключает существующий проект к общим правилам Codex и Claude Code. Локальная специфика проекта остаётся в этом каталоге, общие правила берутся уровнем выше.

1. Сначала читать [../../AGENTS.md](../../AGENTS.md) — главный источник правды workspace.
2. Для Claude Code совместимый вход — [CLAUDE.md](CLAUDE.md), но он должен вести к этому AGENTS.md.
3. Для общего мозга проекта — [../../CLAUDE.md](../../CLAUDE.md) (ai-clone, входная точка).
4. Для кода, отладки и деплоя читать [../../_brain/principles/code.md](../../_brain/principles/code.md).
5. Для продуктовых решений читать [../../_brain/principles/product.md](../../_brain/principles/product.md).
6. Для правил работы агентов читать [../../_brain/principles/working-with-claude.md](../../_brain/principles/working-with-claude.md).
7. Для уроков и повторяющихся ошибок читать [../../_brain/feedback/](../../_brain/feedback/) — для этого проекта особенно применимы: [never-touch-or-overwrite-secrets](../../_brain/feedback/never-touch-or-overwrite-secrets.md), [env-example-is-part-of-delivery](../../_brain/feedback/env-example-is-part-of-delivery.md), [always-backup-before-deploy](../../_brain/feedback/always-backup-before-deploy.md), [deploy-what-users-actually-open](../../_brain/feedback/deploy-what-users-actually-open.md), [change-only-files-the-task-touched](../../_brain/feedback/change-only-files-the-task-touched.md).
8. Планы этого проекта — в локальной папке `plans/`; для handoff между Codex и Claude Code использовать [session-handoffs/current.md](session-handoffs/current.md).

## Паритет Codex и Claude Code

Codex и Claude Code равноправны: любой из них может продолжить работу в этом проекте после другого.

- Проектная специфика живёт здесь, в AGENTS.md, и при необходимости в локальном CLAUDE.md или obsidian-vault/.
- Команда Сохранить сессию использует внешний протокол C:\Users\User\.agents\skills\save-session\SKILL.md и пишет в session-handoffs/current.md.
- Команда Прочитай сохранённую сессию начинает с session-handoffs/current.md, затем читает этот AGENTS.md.
- После значимых изменений в коде, деплоя или разбора бага применять правило workspace-brain-sync: локальное остаётся здесь, повторяющееся уходит в ../ai-clone/, процедуры — в skills.
- Нельзя держать важное правило только в истории чата одного агента.

## Локальная специфика проекта

Если в проекте уже есть подробный CLAUDE.md, считать его историческим локальным контекстом проекта. Новые общие требования не копировать сюда целиком: ссылаться на общий слой выше.

## Промт для нового чата

Когда владелец просит промт для нового чата: текст пишется в `session-handoffs/<сессия>-NEXT-CHAT-PROMPT.md` этого проекта, где `<сессия>` — короткое название текущей сессии без пробелов по теме работы (`links-fix`). Файл сразу коммитится — только он, по пути, в репозитории, которому принадлежит эта папка. В чат — одна строка в блоке кода для копирования: `Прочитай <полный путь к файлу>`, без пересказа промта. Полное правило — корневой `AGENTS.md`, раздел «Сохранение и восстановление сессии».

## Связь с другими файлами

- [[AGENTS]]
- [[CLAUDE]]
- [[code]]
- [[product]]
- [[working-with-claude]]