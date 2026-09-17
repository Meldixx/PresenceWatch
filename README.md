# PresenceWatch

PresenceWatch — плагин для Revenge, который показывает системные Android-уведомления при изменении Discord presence выбранных пользователей.

## Возможности

- наблюдение за одним или несколькими Discord ID;
- уведомление при переходе `offline → online / idle / dnd`;
- опциональные уведомления о выходе в `offline`;
- опциональные уведомления о смене активного статуса;
- страница настроек внутри Revenge;
- тестовое системное уведомление.

## Установка

После успешной публикации добавьте этот URL как репозиторий плагинов в Revenge:

`https://raw.githubusercontent.com/Meldixx/PresenceWatch/gh-pages/index.json`

Затем откройте список плагинов, найдите **PresenceWatch** и установите его.

## Ограничения

PresenceWatch видит только те presence-события, которые Discord передаёт вашему клиенту. Статус Invisible Discord представляет как offline. Если Android полностью остановит процесс Discord, отслеживание возобновится после запуска/пробуждения Discord.

## Исходники

Исходник плагина находится в `plugins/presencewatch/`. GitHub Actions собирает его на базе официального `revenge-mod/revenge-plugin-template` и публикует готовый Revenge plugin repository в ветку `gh-pages`.
